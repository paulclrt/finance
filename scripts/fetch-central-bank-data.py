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
FED_RATES_URL = "https://www.federalreserve.gov/monetarypolicy/openmarket.htm?os=av"
ECB_CALENDAR_URL = "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"
ECB_PRESS_URL = "https://www.ecb.europa.eu/press/press_conference/html/index.en.html"
ECB_RATES_URL = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html"
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

MONTH_ABBR_TO_NUMBER = {
    "Jan.": 1,
    "Feb.": 2,
    "Mar.": 3,
    "Apr.": 4,
    "May.": 5,
    "Jun.": 6,
    "Jul.": 7,
    "Aug.": 8,
    "Sep.": 9,
    "Oct.": 10,
    "Nov.": 11,
    "Dec.": 12,
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


def load_cached_ecb_rates(conn):
    raw_history = get_metadata(conn, "ecb_rates_history")
    raw_current = get_metadata(conn, "ecb_current_rates")
    history = json.loads(raw_history) if raw_history else []
    current = json.loads(raw_current) if raw_current else (history[-1] if history else None)
    return history, current


def load_cached_fed_rates(conn):
    raw_history = get_metadata(conn, "fed_rates_history")
    raw_current = get_metadata(conn, "fed_current_rates")
    history = json.loads(raw_history) if raw_history else []
    current = json.loads(raw_current) if raw_current else (history[-1] if history else None)
    return history, current


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


def store_ecb_rates(conn, history, fetched_at):
    current = history[-1] if history else None
    set_metadata(conn, "ecb_rates_history", json.dumps(history))
    set_metadata(conn, "ecb_current_rates", json.dumps(current))
    set_metadata(conn, "ecb_rates_last_successful_refresh", fetched_at)
    conn.commit()


def store_fed_rates(conn, history, fetched_at):
    current = history[-1] if history else None
    set_metadata(conn, "fed_rates_history", json.dumps(history))
    set_metadata(conn, "fed_current_rates", json.dumps(current))
    set_metadata(conn, "fed_rates_last_successful_refresh", fetched_at)
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


def parse_ecb_rate_history(document):
    text = strip_to_text(document)
    matches = re.finditer(
        r"(?P<year>20\d{2})\s+(?P<day>\d{1,2})\s+(?P<month>[A-Z][a-z]{2}\.)\s+"
        r"(?P<deposit>\d+\.\d+)\s+(?P<main>\d+\.\d+)\s+(?:-|\d+\.\d+)\s+(?P<marginal>\d+\.\d+)",
        text,
    )

    history = []
    seen_dates = set()
    for match in matches:
        month_name = match.group("month")
        month = MONTH_ABBR_TO_NUMBER.get(month_name)
        if not month:
            continue

        effective_date = dt.date(
            int(match.group("year")),
            month,
            int(match.group("day")),
        ).isoformat()
        if effective_date in seen_dates:
            continue

        seen_dates.add(effective_date)
        history.append(
            {
                "effectiveDate": effective_date,
                "depositFacility": float(match.group("deposit")),
                "mainRefinancingOperations": float(match.group("main")),
                "marginalLendingFacility": float(match.group("marginal")),
                "sourceUrl": ECB_RATES_URL,
            }
        )

    history.sort(key=lambda item: item["effectiveDate"])
    if len(history) < 3:
        raise RuntimeError("Unable to parse ECB key interest rates from official source")

    return history


def parse_fed_rate_history(document):
    text = strip_to_text(document)
    history = []
    seen_dates = set()
    current_year = None
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    month_names = "|".join(name.capitalize() for name in MONTH_TO_NUMBER)

    index = 0
    while index < len(lines):
        line = lines[index]

        if re.fullmatch(r"20\d{2}", line):
            current_year = int(line)
            index += 1
            continue

        if current_year is None:
            index += 1
            continue

        match = re.fullmatch(rf"(?P<month>{month_names})\s+(?P<day>\d{{1,2}})(?:\s+\*)?", line)
        if not match:
            index += 1
            continue

        if index + 3 >= len(lines):
            break

        month = MONTH_TO_NUMBER.get(match.group("month").lower())
        level = lines[index + 3]
        level_match = re.fullmatch(r"(?P<low>\d+(?:\.\d+)?)(?:-(?P<high>\d+(?:\.\d+)?))?", level)
        if not month or not level_match:
            index += 1
            continue

        effective_date = dt.date(current_year, month, int(match.group("day"))).isoformat()
        if effective_date in seen_dates:
            index += 4
            continue

        lower = float(level_match.group("low"))
        upper = float(level_match.group("high") or level_match.group("low"))
        history.append(
            {
                "effectiveDate": effective_date,
                "targetLowerBound": lower,
                "targetUpperBound": upper,
                "targetMidpoint": round((lower + upper) / 2, 4),
                "sourceUrl": FED_RATES_URL,
            }
        )
        seen_dates.add(effective_date)
        index += 4

    history.sort(key=lambda item: item["effectiveDate"])
    if len(history) < 3:
        raise RuntimeError("Unable to parse Fed target range history from official source")

    return history


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


def fetch_ecb_rate_history():
    rates_html = fetch_html(ECB_RATES_URL)
    return parse_ecb_rate_history(rates_html)


def fetch_fed_rate_history():
    rates_html = fetch_html(FED_RATES_URL)
    return parse_fed_rate_history(rates_html)


def write_payload(payload):
    json.dump(payload, sys.stdout)


def main():
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        cached_events = load_cached_events(conn)
        cached_ecb_rates_history, cached_current_ecb_rates = load_cached_ecb_rates(conn)
        cached_fed_rates_history, cached_current_fed_rates = load_cached_fed_rates(conn)

        if cached_events and cached_ecb_rates_history and cached_fed_rates_history and cache_is_fresh(conn) and not args.refresh:
            write_payload(
                {
                    "events": cached_events,
                    "ecbRatesHistory": cached_ecb_rates_history,
                    "currentEcbRates": cached_current_ecb_rates,
                    "fedRatesHistory": cached_fed_rates_history,
                    "currentFedRates": cached_current_fed_rates,
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
            fresh_ecb_rates_history = fetch_ecb_rate_history()
            fresh_fed_rates_history = fetch_fed_rate_history()
            normalized_events = [dict(event, fetchedAt=fetched_at) for event in fresh_events]
            store_events(conn, normalized_events, fetched_at)
            store_ecb_rates(conn, fresh_ecb_rates_history, fetched_at)
            store_fed_rates(conn, fresh_fed_rates_history, fetched_at)
            write_payload(
                {
                    "events": normalized_events,
                    "ecbRatesHistory": fresh_ecb_rates_history,
                    "currentEcbRates": fresh_ecb_rates_history[-1] if fresh_ecb_rates_history else None,
                    "fedRatesHistory": fresh_fed_rates_history,
                    "currentFedRates": fresh_fed_rates_history[-1] if fresh_fed_rates_history else None,
                    "dbPath": str(db_path),
                    "servedFrom": "network",
                    "generatedAt": utc_now_iso(),
                    "lastSuccessfulRefresh": fetched_at,
                    "warnings": [],
                }
            )
        except Exception as error:
            if cached_events or cached_ecb_rates_history or cached_fed_rates_history:
                write_payload(
                    {
                        "events": cached_events,
                        "ecbRatesHistory": cached_ecb_rates_history,
                        "currentEcbRates": cached_current_ecb_rates,
                        "fedRatesHistory": cached_fed_rates_history,
                        "currentFedRates": cached_current_fed_rates,
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
