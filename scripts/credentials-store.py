#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path


def utc_now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def parse_args():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--db", required=True)

    get_parser = subparsers.add_parser("get")
    get_parser.add_argument("--db", required=True)
    get_parser.add_argument("--service-key", required=True)

    upsert_parser = subparsers.add_parser("upsert")
    upsert_parser.add_argument("--db", required=True)
    upsert_parser.add_argument("--service-key", required=True)
    upsert_parser.add_argument("--label", required=True)
    upsert_parser.add_argument("--credential-type", required=True)
    upsert_parser.add_argument("--email", default="")
    upsert_parser.add_argument("--password", default="")
    upsert_parser.add_argument("--api-key", default="")
    upsert_parser.add_argument("--notes", default="")

    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("--db", required=True)
    delete_parser.add_argument("--service-key", required=True)

    return parser.parse_args()


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS credentials (
          service_key TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          login_encrypted TEXT NOT NULL DEFAULT '',
          secret_encrypted TEXT NOT NULL DEFAULT '',
          notes_encrypted TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL
        )
        """
    )

    existing_columns = {
        row[1]
        for row in conn.execute("PRAGMA table_info(credentials)").fetchall()
    }
    required_columns = {
        "credential_type": "TEXT NOT NULL DEFAULT 'api_key'",
        "email_encrypted": "TEXT NOT NULL DEFAULT ''",
        "password_encrypted": "TEXT NOT NULL DEFAULT ''",
        "api_key_encrypted": "TEXT NOT NULL DEFAULT ''",
    }

    for column_name, column_spec in required_columns.items():
        if column_name not in existing_columns:
            conn.execute(
                f"ALTER TABLE credentials ADD COLUMN {column_name} {column_spec}"
            )

    conn.execute(
        """
        UPDATE credentials
        SET
          email_encrypted = CASE WHEN email_encrypted = '' THEN login_encrypted ELSE email_encrypted END,
          password_encrypted = CASE
            WHEN password_encrypted = '' AND credential_type = 'email_password' THEN secret_encrypted
            ELSE password_encrypted
          END,
          api_key_encrypted = CASE
            WHEN api_key_encrypted = '' AND credential_type = 'api_key' THEN secret_encrypted
            WHEN api_key_encrypted = '' AND credential_type NOT IN ('api_key', 'email_password') THEN secret_encrypted
            ELSE api_key_encrypted
          END,
          credential_type = CASE
            WHEN credential_type IN ('api_key', 'email_password') THEN credential_type
            WHEN login_encrypted != '' THEN 'email_password'
            ELSE 'api_key'
          END
        """
    )
    conn.commit()


def main():
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)

        if args.command == "list":
            rows = conn.execute(
                """
                SELECT service_key, label, credential_type, updated_at
                FROM credentials
                ORDER BY label COLLATE NOCASE ASC
                """
            ).fetchall()
            print(
                json.dumps(
                    [
                        {
                            "serviceKey": row[0],
                            "label": row[1],
                            "credentialType": row[2],
                            "updatedAt": row[3],
                        }
                        for row in rows
                    ]
                )
            )
            return

        if args.command == "get":
            row = conn.execute(
                """
                SELECT
                  service_key,
                  label,
                  credential_type,
                  email_encrypted,
                  password_encrypted,
                  api_key_encrypted,
                  notes_encrypted,
                  updated_at
                FROM credentials
                WHERE service_key = ?
                """,
                (args.service_key,),
            ).fetchone()
            print(
                json.dumps(
                    {
                        "serviceKey": row[0],
                        "label": row[1],
                        "credentialType": row[2],
                        "emailEncrypted": row[3],
                        "passwordEncrypted": row[4],
                        "apiKeyEncrypted": row[5],
                        "notesEncrypted": row[6],
                        "updatedAt": row[7],
                    }
                    if row
                    else None
                )
            )
            return

        if args.command == "delete":
            cursor = conn.execute(
                """
                DELETE FROM credentials
                WHERE service_key = ?
                """,
                (args.service_key,),
            )
            conn.commit()
            print(json.dumps({"deleted": cursor.rowcount > 0}))
            return

        conn.execute(
            """
            INSERT INTO credentials(
              service_key,
              label,
              login_encrypted,
              secret_encrypted,
              notes_encrypted,
              updated_at,
              credential_type,
              email_encrypted,
              password_encrypted,
              api_key_encrypted
            )
            VALUES(?, ?, '', '', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(service_key) DO UPDATE SET
              label = excluded.label,
              notes_encrypted = excluded.notes_encrypted,
              updated_at = excluded.updated_at,
              credential_type = excluded.credential_type,
              email_encrypted = excluded.email_encrypted,
              password_encrypted = excluded.password_encrypted,
              api_key_encrypted = excluded.api_key_encrypted
            """,
            (
                args.service_key,
                args.label,
                args.notes,
                utc_now_iso(),
                args.credential_type,
                args.email,
                args.password,
                args.api_key,
            ),
        )
        conn.commit()
        print(json.dumps({"stored": True}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
