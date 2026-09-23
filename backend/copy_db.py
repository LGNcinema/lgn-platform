#!/usr/bin/env python
"""Copy every row from one Postgres database into another.

Written for the one-off Supabase -> Neon move. It exists because pg_dump is not
always on hand, and because this schema does not need it: nine tables of
Integer / String / Text / Boolean / DateTime, which psycopg2 reads and writes
back through the same type adapters with nothing lost in between.

    uv run python copy_db.py --from "<source url>" --to "<dest url>" --dry-run
    uv run python copy_db.py --from "<source url>" --to "<dest url>"

The destination must already have the schema -- run `migrate.py up` against it
first. This copies data only; it creates nothing.

Use DIRECT connections on both sides, not pooled ones (on Neon that is
DATABASE_URL_UNPOOLED). The whole copy runs in one destination transaction, so a
pooler that can hand statements to different backends is the wrong tool.

Safety: refuses to touch a destination table that already has rows unless
--truncate is passed. Nothing is committed until every table has copied.
"""

import argparse
import sys

import psycopg2

# Insert in an order that satisfies foreign keys; delete in the reverse. Derived
# from the destination's own catalog rather than hardcoded, so a table added
# later is not silently skipped.
DEPENDENCY_QUERY = """
SELECT
    c.relname       AS table_name,
    COALESCE(ref.relname, '') AS depends_on
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_constraint con
       ON con.conrelid = c.oid AND con.contype = 'f'
LEFT JOIN pg_class ref ON ref.oid = con.confrelid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname <> 'schema_migrations'
"""


def ordered_tables(conn):
    """Table names, parents before children. Raises on a dependency cycle."""
    deps = {}
    with conn.cursor() as cur:
        cur.execute(DEPENDENCY_QUERY)
        for table, parent in cur.fetchall():
            deps.setdefault(table, set())
            # A self-reference is not an ordering constraint.
            if parent and parent != table:
                deps[table].add(parent)

    ordered, remaining = [], dict(deps)
    while remaining:
        ready = sorted(t for t, parents in remaining.items() if not (parents - set(ordered)))
        if not ready:
            sys.exit(f"Circular foreign keys among: {sorted(remaining)}")
        ordered.extend(ready)
        for t in ready:
            del remaining[t]
    return ordered


def columns(conn, table):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        return [r[0] for r in cur.fetchall()]


def row_count(conn, table):
    with conn.cursor() as cur:
        cur.execute(f'SELECT count(*) FROM "{table}"')
        return cur.fetchone()[0]


def resync_sequences(dest, table):
    """Move each SERIAL sequence past the ids just inserted.

    Rows are copied with their original ids, which leaves the destination's
    sequence still at 1 -- the next insert from the app would collide on the
    primary key. This is the step that is easy to forget and painful to debug.
    """
    with dest.cursor() as cur:
        cur.execute(
            """
            SELECT a.attname, pg_get_serial_sequence(%s, a.attname)
            FROM pg_attribute a
            WHERE a.attrelid = %s::regclass
              AND a.attnum > 0
              AND NOT a.attisdropped
              AND pg_get_serial_sequence(%s, a.attname) IS NOT NULL
            """,
            (table, table, table),
        )
        for column, sequence in cur.fetchall():
            cur.execute(
                f'SELECT setval(%s, COALESCE((SELECT max("{column}") FROM "{table}"), 0) + 1, false)',
                (sequence,),
            )
            print(f"      sequence {sequence} resynced")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--from", dest="source", required=True, help="source connection URL")
    ap.add_argument("--to", dest="dest", required=True, help="destination connection URL")
    ap.add_argument("--dry-run", action="store_true", help="report only; write nothing")
    ap.add_argument(
        "--truncate",
        action="store_true",
        help="empty a non-empty destination table first (destructive)",
    )
    args = ap.parse_args()

    source = psycopg2.connect(args.source, connect_timeout=15)
    dest = psycopg2.connect(args.dest, connect_timeout=15)

    try:
        tables = ordered_tables(dest)
        print(f"{len(tables)} table(s), in dependency order:\n  {', '.join(tables)}\n")

        total = 0
        for table in tables:
            src_cols = set(columns(source, table))
            cols = [c for c in columns(dest, table) if c in src_cols]
            missing = src_cols - set(cols)
            if missing:
                # Source has a column the destination lacks: the schemas are not
                # the same shape, and silently dropping data is not this tool's call.
                sys.exit(
                    f"{table}: source columns {sorted(missing)} do not exist in the "
                    "destination. Run migrate.py up against the destination first."
                )

            with source.cursor() as cur:
                quoted = ", ".join(f'"{c}"' for c in cols)
                cur.execute(f'SELECT {quoted} FROM "{table}"')
                rows = cur.fetchall()

            existing = row_count(dest, table)
            print(f"  {table}: {len(rows)} row(s) in source, {existing} in destination")

            if existing and not args.truncate:
                sys.exit(
                    f"\n{table} already has {existing} row(s) in the destination.\n"
                    "Refusing to mix data. Re-run with --truncate to replace it."
                )

            if args.dry_run:
                total += len(rows)
                continue

            with dest.cursor() as cur:
                if existing:
                    cur.execute(f'TRUNCATE TABLE "{table}" CASCADE')
                    print(f"      truncated {existing} existing row(s)")
                if rows:
                    placeholders = ", ".join(["%s"] * len(cols))
                    quoted = ", ".join(f'"{c}"' for c in cols)
                    cur.executemany(
                        f'INSERT INTO "{table}" ({quoted}) VALUES ({placeholders})', rows
                    )
                    print(f"      inserted {len(rows)} row(s)")
            resync_sequences(dest, table)
            total += len(rows)

        if args.dry_run:
            dest.rollback()
            print(f"\nDry run: {total} row(s) would be copied. Nothing written.")
        else:
            # One commit for the whole copy -- a failure anywhere leaves the
            # destination exactly as it was.
            dest.commit()
            print(f"\nCopied {total} row(s) across {len(tables)} table(s).")
    except Exception:
        dest.rollback()
        raise
    finally:
        source.close()
        dest.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
