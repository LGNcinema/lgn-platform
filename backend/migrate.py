#!/usr/bin/env python
"""Apply the SQL migrations in ./migrations to a Postgres database.

This replaces `supabase db push`. The migration files themselves are unchanged
plain SQL -- nothing about them was Supabase-specific -- so all this needs to do
is run them in order, once each, and remember which have run.

    uv run python migrate.py status     # what is applied, what is pending
    uv run python migrate.py up         # apply everything pending
    uv run python migrate.py seed       # apply ./seed.sql -- LOCAL DEV ONLY
    uv run python migrate.py baseline   # mark all as applied WITHOUT running them

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

import os
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
    if len(argv) != 2 or argv[1] not in COMMANDS:
        sys.exit(f"usage: {Path(argv[0]).name} {{{'|'.join(COMMANDS)}}}")

    url = database_url()
    # Host only -- never print the URL, it carries the password.
    host = url.split("@")[-1].split("/")[0] if "@" in url else "(local)"
    print(f"Database: {host}\n")

    conn = psycopg2.connect(url, connect_timeout=15)
    try:
        return COMMANDS[argv[1]](conn)
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
