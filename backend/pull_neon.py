#!/usr/bin/env python
"""Copy a Neon dev branch into a local SQLite file, read-only, over HTTPS.

For environments that can reach Neon's HTTPS API but not Postgres on port 5432
(Claude Code cloud sessions, locked-down networks). It reads every table through
Neon's SQL-over-HTTP endpoint and writes the rows into a fresh SQLite database
built from app/models.py, so the full app runs locally on real content:

    uv run python pull_neon.py                       # dev-local -> lgn_neon_copy.db
    uv run python pull_neon.py --branch dev-local --out lgn_neon_copy.db

    DATABASE_URL=sqlite:///./lgn_neon_copy.db DB_BOOTSTRAP=false \\
        uv run uvicorn app.main:app --port 8000

Safety:
  * It only ever runs SELECTs against Neon. Nothing is written back.
  * It refuses the project's default branch, any protected branch, and any
    branch named `main` -- point it at a dev branch, never production.
  * The connection string is fetched from the Neon API at run time and kept in
    memory. Nothing credential-bearing is written to disk or printed.

Auth: NEON_API_KEY in the environment. In a Claude Code cloud environment that
holds the key as a network secret for console.neon.tech, the proxy attaches it
and the variable can be left unset. Network access must allow *.neon.tech.

Writes to the SQLite copy stay in that file; delete it to start over.
"""

import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

NEON_API = "https://console.neon.tech/api/v2"
DEFAULT_PROJECT = "aged-poetry-97582017"  # lgn-platform
ROLE, DATABASE = "neondb_owner", "neondb"
BATCH = 5  # rows per request; capsule photos are a few hundred KB each


def api(path):
    req = urllib.request.Request(NEON_API + path, headers={"Accept": "application/json"})
    key = os.getenv("NEON_API_KEY")
    if key:
        req.add_header("Authorization", f"Bearer {key}")
    return json.load(urllib.request.urlopen(req, timeout=60))


def dev_branch_uri(project, name):
    branches = api(f"/projects/{project}/branches")["branches"]
    match = [b for b in branches if b["name"] == name]
    if not match:
        sys.exit(f"No Neon branch named {name!r}. Have: {', '.join(b['name'] for b in branches)}")
    branch = match[0]
    if branch.get("default") or branch.get("protected") or name == "main":
        sys.exit(f"Refusing {name!r}: it is the default/protected branch. Use a dev branch.")
    qs = urllib.parse.urlencode({"branch_id": branch["id"], "database_name": DATABASE,
                                 "role_name": ROLE, "pooled": "true"})
    return api(f"/projects/{project}/connection_uri?{qs}")["uri"]


def make_query(uri):
    host = uri.split("@", 1)[1].split("/", 1)[0]

    def query(sql):
        req = urllib.request.Request(
            f"https://{host}/sql",
            data=json.dumps({"query": sql, "params": []}).encode(),
            headers={"Neon-Connection-String": uri, "Content-Type": "application/json"},
        )
        return json.load(urllib.request.urlopen(req, timeout=120))["rows"]

    return query


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--branch", default="dev-local")
    ap.add_argument("--project", default=DEFAULT_PROJECT)
    ap.add_argument("--out", default="lgn_neon_copy.db")
    args = ap.parse_args()

    query = make_query(dev_branch_uri(args.project, args.branch))
    out = os.path.abspath(args.out)

    # app.config reads DATABASE_URL at import; keep it off any real database.
    os.environ["DATABASE_URL"] = "sqlite:///" + out
    from sqlalchemy import Date, DateTime, LargeBinary, create_engine, func, insert, select
    from app import models

    if os.path.exists(out):
        os.remove(out)
    engine = create_engine("sqlite:///" + out)
    models.Base.metadata.create_all(engine)

    def convert(col, value):
        if value is None:
            return None
        if isinstance(col.type, LargeBinary):  # bytea arrives as "\x<hex>"
            return bytes.fromhex(value[2:] if value.startswith("\\x") else value)
        if isinstance(col.type, DateTime):
            return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if isinstance(col.type, Date):
            return dt.date.fromisoformat(value)
        return value

    with engine.begin() as conn:  # one transaction: all tables or nothing
        for table in models.Base.metadata.sorted_tables:
            src_cols = {r["column_name"] for r in query(
                "select column_name from information_schema.columns "
                f"where table_schema='public' and table_name='{table.name}'")}
            cols = [c for c in table.columns if c.name in src_cols]
            missing = [c.name for c in table.columns if c.name not in src_cols]
            ids = [r["id"] for r in query(f"select id from {table.name} order by id")]
            for i in range(0, len(ids), BATCH):
                chunk = ",".join(str(int(x)) for x in ids[i:i + BATCH])
                rows = query(f"select {','.join(c.name for c in cols)} "
                             f"from {table.name} where id in ({chunk})")
                for row in rows:
                    conn.execute(insert(table).values(
                        **{c.name: convert(c, row[c.name]) for c in cols}))
            copied = conn.execute(select(func.count()).select_from(table)).scalar()
            note = f"  (not in Neon, left empty: {missing})" if missing else ""
            print(f"{table.name:24} neon={len(ids):4} copied={copied:4}{note}")

    rel = os.path.relpath(out)
    url = "sqlite:///" + (out if rel.startswith("..") else "./" + rel)
    print(f"\nWrote {out}\nRun the API on it with DATABASE_URL={url} DB_BOOTSTRAP=false")


if __name__ == "__main__":
    main()
