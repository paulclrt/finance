#!/usr/bin/env python3
import argparse
import datetime as dt
import html
import json
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

FED_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
ECB_CALENDAR_URL = "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"
ECB_PRESS_URL = "https://www.ecb.europa.eu/press/press_conference/html/index.en.html"
CACHE_TTL_SECONDS = 12 * 60 * 60
USER_AGENT = "FinanceLabCentralBankFetcher/1.0 (+local desktop app)"

MONTH_TO_NUMBER = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def utc_now_iso():
    return utc_now().isoformat()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--refresh", action="store_true")
    return parser.parse_args()


def ensure_schema(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
          bank TEXT NOT NULL,
          title TEXT NOT NULL,
          event_date TEXT NOT NULL,
          location TEXT NOT NULL,
          details TEXT NOT NULL,
          source_url TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          PRIMARY KEY (bank, title, event_date)
        );
        """
    )
    conn.commit()


def get_metadata(conn, key):
    row = conn.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
    return row[0] if row else None


def set_metadata(conn, key, value):
    conn.execute(
        "INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def load_cached_events(conn):
    rows = conn.execute(
        """
        SELECT bank, title, event_date, location, details, source_url, fetched_at
        FROM events
        ORDER BY event_date, bank, title
        """
    ).fetchall()
    return [
        {
            "bank": row[0],
            "title": row[1],
            "date": row[2],
            "location": row[3],
            "details": row[4],
            "sourceUrl": row[5],
            "fetchedAt": row[6],
        }
        for row in rows
    ]


def store_events(conn, events, fetched_at):
    conn.execute("DELETE FROM events")
    conn.executemany(
        """
        INSERT INTO events(bank, title, event_date, location, details, source_url, fetched_at)
        VALUES(:bank, :title, :date, :location, :details, :sourceUrl, :fetchedAt)
        """,
        [
            {
                "bank": event["bank"],
                "title": event["title"],
                "date": event["date"],
                "location": event["location"],
                "details": event["details"],
                "sourceUrl": event["sourceUrl"],
                "fetchedAt": fetched_at,
            }
            for event in events
        ],
    )
    set_metadata(conn, "last_successful_refresh", fetched_at)
    conn.commit()


def cache_is_fresh(conn):
    raw = get_metadata(conn, "last_successful_refresh")
    if not raw:
        return False
    refreshed_at = dt.datetime.fromisoformat(raw)
    return (utc_now() - refreshed_at).total_seconds() < CACHE_TTL_SECONDS


def fetch_html(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")


def strip_to_text(document):
    without_scripts = re.sub(r"<script.*?</script>", " ", document, flags=re.IGNORECASE | re.DOTALL)
    without_styles = re.sub(r"<style.*?</style>", " ", without_scripts, flags=re.IGNORECASE | re.DOTALL)
    with_breaks = re.sub(r"</(p|div|li|tr|section|h1|h2|h3|h4|br|td|th|ul|ol)>", "\n", without_styles, flags=re.IGNORECASE)
    without_tags = re.sub(r"<[^>]+>", " ", with_breaks)
    unescaped = html.unescape(without_tags)
    collapsed = re.sub(r"[ \t\r\f\v]+", " ", unescaped)
    return re.sub(r"\n+", "\n", collapsed)


def parse_fed_events(document, year):
    text = strip_to_text(document)
    match = re.search(
        rf"{year} FOMC Meetings\s+(.+?)\s+{year - 1} FOMC Meetings",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    section = match.group(1) if match else text
    lines = [line.strip() for line in section.splitlines() if line.strip()]

    dates = []
    current_month = None
    for line in lines:
        lower = line.lower()
        if lower in MONTH_TO_NUMBER:
            current_month = MONTH_TO_NUMBER[lower]
            continue

        if current_month is None:
            continue

        range_match = re.match(r"(\d{1,2})-(\d{1,2})", line)
        if not range_match:
            continue

        end_day = int(range_match.group(2))
        event_date = dt.date(year, current_month, end_day).isoformat()
        if event_date not in dates:
            dates.append(event_date)

    if len(dates) < 6:
        raise RuntimeError("Unable to parse enough FED meeting dates from official calendar")

    return [
        {
            "bank": "Fed",
            "title": "FOMC announcement",
            "date": event_date,
            "location": "Washington, D.C.",
            "details": "Regularly scheduled FOMC meeting end date.",
            "sourceUrl": FED_CALENDAR_URL,
        }
        for event_date in sorted(dates)
    ]


def parse_ecb_calendar_events(document, year):
    text = strip_to_text(document)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    events = []
    for index, line in enumerate(lines[:-1]):
        if not re.fullmatch(rf"\d{{2}}/\d{{2}}/{year}", line):
            continue

        next_line = lines[index + 1]
        if "Governing Council of the ECB: monetary policy meeting" not in next_line:
            continue
        if "followed by press conference" not in next_line:
            continue

        event_date = dt.datetime.strptime(line, "%d/%m/%Y").date().isoformat()
        lowered = next_line.lower()
        location = "Frankfurt" if "frankfurt" in lowered else "ECB Governing Council"
        if "deutsche bundesbank" in lowered:
            location = "Deutsche Bundesbank host"

        details = re.sub(r"\s+", " ", next_line)
        events.append(
            {
                "bank": "ECB",
                "title": "Monetary policy decision",
                "date": event_date,
                "location": location,
                "details": details,
                "sourceUrl": ECB_CALENDAR_URL,
            }
        )

    return events


def parse_ecb_latest_press_event(document, year):
    text = strip_to_text(document)
    match = re.search(
        rf"latest monetary policy press conference\s+(\d{{1,2}}\s+[A-Za-z]+\s+{year})",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    event_date = dt.datetime.strptime(match.group(1), "%d %B %Y").date().isoformat()
    return {
        "bank": "ECB",
        "title": "Monetary policy decision",
        "date": event_date,
        "location": "Frankfurt",
        "details": "Latest ECB monetary policy press conference date.",
        "sourceUrl": ECB_PRESS_URL,
    }


def fetch_central_bank_events(year):
    fed_html = fetch_html(FED_CALENDAR_URL)
    ecb_calendar_html = fetch_html(ECB_CALENDAR_URL)
    ecb_press_html = fetch_html(ECB_PRESS_URL)

    merged = {}
    for event in parse_fed_events(fed_html, year):
        merged[(event["bank"], event["date"], event["title"])] = event
    for event in parse_ecb_calendar_events(ecb_calendar_html, year):
        merged[(event["bank"], event["date"], event["title"])] = event

    latest_ecb_event = parse_ecb_latest_press_event(ecb_press_html, year)
    if latest_ecb_event:
        merged[(latest_ecb_event["bank"], latest_ecb_event["date"], latest_ecb_event["title"])] = latest_ecb_event

    events = sorted(merged.values(), key=lambda item: (item["date"], item["bank"], item["title"]))
    if not events:
        raise RuntimeError("No central bank events were fetched")
    return events


def write_payload(payload):
    json.dump(payload, sys.stdout)


def main():
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        cached_events = load_cached_events(conn)

        if cached_events and cache_is_fresh(conn) and not args.refresh:
            write_payload(
                {
                    "events": cached_events,
                    "dbPath": str(db_path),
                    "servedFrom": "cache",
                    "generatedAt": utc_now_iso(),
                    "lastSuccessfulRefresh": get_metadata(conn, "last_successful_refresh"),
                    "warnings": [],
                }
            )
            return

        current_year = utc_now().year
        try:
            fetched_at = utc_now_iso()
            fresh_events = fetch_central_bank_events(current_year)
            normalized_events = [dict(event, fetchedAt=fetched_at) for event in fresh_events]
            store_events(conn, normalized_events, fetched_at)
            write_payload(
                {
                    "events": normalized_events,
                    "dbPath": str(db_path),
                    "servedFrom": "network",
                    "generatedAt": utc_now_iso(),
                    "lastSuccessfulRefresh": fetched_at,
                    "warnings": [],
                }
            )
        except Exception as error:
            if cached_events:
                write_payload(
                    {
                        "events": cached_events,
                        "dbPath": str(db_path),
                        "servedFrom": "stale-cache",
                        "generatedAt": utc_now_iso(),
                        "lastSuccessfulRefresh": get_metadata(conn, "last_successful_refresh"),
                        "warnings": [f"Refresh failed, serving cached data: {error}"],
                    }
                )
                return
            raise


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
