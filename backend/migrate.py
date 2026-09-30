#!/usr/bin/env python
"""Apply the SQL migrations in ./migrations to a Postgres database.

This replaces `supabase db push`. The migration files themselves are unchanged
plain SQL -- nothing about them was Supabase-specific -- so all this needs to do
is run them in order, once each, and remember which have run.

    uv run python migrate.py status     # what is applied, what is pending
    uv run python migrate.py up         # apply everything pending
    uv run python migrate.py seed       # apply ./seed.sql -- LOCAL DEV ONLY
    uv run python migrate.py baseline   # mark all as applied WITHOUT running them

Any of those against a Neon branch instead of the local database:

    uv run python migrate.py status --neon main                        # production
    uv run python migrate.py up --neon main
    uv run python migrate.py up --neon preview/campfire-redesign       # a preview

--neon asks the Neon CLI for that branch's direct connection string, so there
is no credential to copy and no environment variable left set in your shell
afterwards. It needs the CLI logged in once (`npx neon@latest auth`).

`seed` is local-development data and must never run against the hosted
database: it upserts a sample capsule and film keyed on `month`, which overwrites
real content. Nothing applies it automatically, and it is a separate command so
that using it is always a deliberate act.

`baseline` is for one case only: a database that already has the schema (a
pg_dump restore, or the old Supabase database) and just needs the tracking table
to agree. It runs no SQL against your tables.

Connection: prefers DATABASE_URL_UNPOOLED, falls back to DATABASE_URL. Neon's
Vercel integration sets both, and migrations should go through the direct
connection rather than PgBouncer -- a pooled connection can hand consecutive
statements to different backends, which is fine for the app's
one-transaction-per-request traffic and not something to trust DDL to.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import psycopg2

HERE = Path(__file__).resolve().parent
MIGRATIONS_DIR = HERE / "migrations"
SEED_FILE = HERE / "seed.sql"

# One row per applied file. `version` is the filename, so the on-disk name is the
# identity -- renaming an applied migration makes it look pending again.
TRACKING_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


def database_url():
    """The connection to migrate. Explicit env wins; otherwise app config."""
    url = os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL")
    if not url:
        # Falls back to backend/.env via pydantic-settings, so a local run needs
        # no extra arguments.
        from app.config import settings

        url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        sys.exit(
            "These migrations are Postgres. DATABASE_URL points at SQLite.\n"
            "Local SQLite dev gets its schema from SQLAlchemy's create_all() "
            "instead -- see app/main.py."
        )
    return url


# The Neon project this app lives in. Not secrets -- both appear in the Neon
# console's URLs -- and overridable for anyone pointing this at another project.
NEON_PROJECT_ID = os.getenv("NEON_PROJECT_ID", "aged-poetry-97582017")
NEON_ORG_ID = os.getenv("NEON_ORG_ID", "org-rough-paper-81489627")
# Neon's default branch is what the production site reads.
NEON_PRODUCTION_BRANCH = "main"


def neon_url(branch):
    """A Neon branch's DIRECT connection string, fetched from the Neon CLI.

    Direct rather than pooled: migrations do DDL, which should not go through
    PgBouncer. The URL is returned to the caller and never printed -- it
    carries the database password.
    """
    npx = shutil.which("npx")
    if not npx:
        sys.exit("--neon needs Node's npx on PATH (it runs the Neon CLI).")
    cmd = [
        npx, "--yes", "neon@latest", "connection-string", branch,
        "--project-id", NEON_PROJECT_ID, "--org-id", NEON_ORG_ID,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    url = lines[-1] if lines else ""
    if result.returncode != 0 or not url.startswith("postgres"):
        # stderr, not stdout: stdout is where a URL would have been.
        detail = result.stderr.strip().splitlines()[-1:] or ["no output"]
        sys.exit(
            f"Could not get a connection string for Neon branch {branch!r}: {detail[0]}\n"
            "Is the branch name right, and is the Neon CLI logged in? "
            "(npx neon@latest auth)"
        )
    if "-pooler." in url:
        sys.exit("The Neon CLI returned a pooled URL; migrations need the direct one.")
    return url


def migration_files():
    """Every .sql in ./migrations, in filename order (they are timestamp-prefixed)."""
    if not MIGRATIONS_DIR.is_dir():
        sys.exit(f"No migrations directory at {MIGRATIONS_DIR}")
    return sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)


def applied_versions(conn):
    with conn.cursor() as cur:
        cur.execute(TRACKING_TABLE)
        cur.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}


def cmd_status(conn):
    applied = applied_versions(conn)
    conn.commit()
    pending = 0
    for path in migration_files():
        if path.name in applied:
            print(f"  applied  {path.name}")
        else:
            print(f"  PENDING  {path.name}")
            pending += 1
    print(f"\n{len(applied)} applied, {pending} pending")
    return 0


def cmd_up(conn):
    applied = applied_versions(conn)
    conn.commit()

    pending = [p for p in migration_files() if p.name not in applied]
    if not pending:
        print("Nothing to apply.")
        return 0

    for path in pending:
        sql = path.read_text(encoding="utf-8").strip()
        # One empty file exists in this history. Record it so the sequence stays
        # intact, but do not hand an empty string to the server.
        try:
            with conn:
                with conn.cursor() as cur:
                    if sql:
                        cur.execute(sql)
                    cur.execute(
                        "INSERT INTO schema_migrations (version) VALUES (%s)",
                        (path.name,),
                    )
        except psycopg2.Error as e:
            # `with conn` already rolled this file back. Stop rather than
            # continue: later migrations assume this one landed.
            print(f"\nFAILED  {path.name}\n{e}", file=sys.stderr)
            print("Rolled back. No later migrations were attempted.", file=sys.stderr)
            return 1
        print(f"  applied  {path.name}" + ("  (empty)" if not sql else ""))

    print(f"\n{len(pending)} migration(s) applied.")
    return 0


def cmd_baseline(conn):
    applied = applied_versions(conn)
    conn.commit()

    marked = [p.name for p in migration_files() if p.name not in applied]
    if not marked:
        print("Already baselined -- every migration is recorded as applied.")
        return 0

    with conn:
        with conn.cursor() as cur:
            for name in marked:
                cur.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s)", (name,)
                )
    for name in marked:
        print(f"  marked applied (not run)  {name}")
    print(f"\n{len(marked)} migration(s) baselined. No schema was changed.")
    return 0


def cmd_seed(conn):
    if not SEED_FILE.is_file():
        sys.exit(f"No seed file at {SEED_FILE}")
    sql = SEED_FILE.read_text(encoding="utf-8").strip()
    if not sql:
        print("Seed file is empty.")
        return 0
    with conn:
        with conn.cursor() as cur:
            cur.execute(sql)
    print(f"Applied {SEED_FILE.name}.")
    return 0


COMMANDS = {
    "status": cmd_status,
    "up": cmd_up,
    "baseline": cmd_baseline,
    "seed": cmd_seed,
}


def main(argv):
    parser = argparse.ArgumentParser(prog=Path(argv[0]).name, description="Apply SQL migrations.")
    parser.add_argument("command", choices=COMMANDS)
    parser.add_argument(
        "--neon", metavar="BRANCH",
        help="run against this Neon branch (e.g. main, preview/<git-branch>) instead of the local database",
    )
    args = parser.parse_args(argv[1:])

    url = neon_url(args.neon) if args.neon else database_url()
    # Host only -- never print the URL, it carries the password.
    host = url.split("@")[-1].split("/")[0].split("?")[0] if "@" in url else "(local)"
    is_neon = host.endswith(".neon.tech")

    # seed.sql is development data. It upserts a sample capsule over whatever
    # shares its month (Lightpoles, in production) and inserts practices with no
    # conflict handling, so it would overwrite real content and duplicate rows.
    # Refuse it against Neon outright -- production and every preview branch,
    # which is a copy of production.
    if args.command == "seed" and is_neon:
        sys.exit(
            f"Refusing to seed {host}: seed.sql is local development data and must "
            "never run against a Neon database."
        )

    label = ""
    if args.neon:
        label = f"  (Neon branch: {args.neon}"
        label += " -- PRODUCTION)" if args.neon == NEON_PRODUCTION_BRANCH else ")"
    print(f"Database: {host}{label}\n")

    conn = psycopg2.connect(url, connect_timeout=15)
    try:
        return COMMANDS[args.command](conn)
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
