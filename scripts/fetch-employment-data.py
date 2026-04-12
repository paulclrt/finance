#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
import sqlite3
import sys
import urllib.parse
import urllib.request
from pathlib import Path

FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"
CACHE_TTL_HOURS = 12

SERIES = {
    "payrolls": {
        "id": "PAYEMS",
        "label": "NFP level",
        "source_url": "https://fred.stlouisfed.org/series/PAYEMS",
    },
    "unemployment": {
        "id": "UNRATE",
        "label": "Unemployment rate",
        "source_url": "https://fred.stlouisfed.org/series/UNRATE",
    },
    "jolts_openings": {
        "id": "JTSJOL",
        "label": "JOLTS openings",
        "source_url": "https://fred.stlouisfed.org/series/JTSJOL",
    },
    "jolts_rate": {
        "id": "JTSJOR",
        "label": "JOLTS rate",
        "source_url": "https://fred.stlouisfed.org/series/JTSJOR",
    },
}


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def utc_now_iso():
    return utc_now().replace(microsecond=0).isoformat()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--years", type=int, default=12)
    return parser.parse_args()


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS employment_cache (
          cache_key TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          last_successful_refresh TEXT NOT NULL
        )
        """
    )
    conn.commit()


def is_cache_fresh(fetched_at_iso):
    try:
        fetched_at = dt.datetime.fromisoformat(fetched_at_iso)
    except ValueError:
        return False
    return (utc_now() - fetched_at) < dt.timedelta(hours=CACHE_TTL_HOURS)


def fetch_text(url, params):
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        full_url,
        headers={"User-Agent": "finance-lab/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def fetch_series_points(series_id, observation_start, api_key):
    text = fetch_text(
        FRED_API_URL,
        {
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "observation_start": observation_start,
            "sort_order": "asc",
        },
    )
    payload = json.loads(text)
    points = []
    for item in payload.get("observations", []):
        value = item.get("value", ".")
        if value in ("", "."):
            continue
        points.append({"time": item["date"], "value": round(float(value), 4)})
    return points


def build_payroll_change(points):
    changes = []
    previous = None
    for point in points:
        if previous is not None:
            changes.append({"time": point["time"], "value": round(point["value"] - previous["value"], 3)})
        previous = point
    return changes


def build_payload(years, api_key):
    observation_start = (utc_now().date().replace(day=1) - dt.timedelta(days=365 * years + 60)).isoformat()
    payroll_points = fetch_series_points(SERIES["payrolls"]["id"], observation_start, api_key)
    unemployment_points = fetch_series_points(SERIES["unemployment"]["id"], observation_start, api_key)
    jolts_points = fetch_series_points(SERIES["jolts_openings"]["id"], observation_start, api_key)
    jolts_rate_points = fetch_series_points(SERIES["jolts_rate"]["id"], observation_start, api_key)
    payroll_change_points = build_payroll_change(payroll_points)

    warnings = []
    if not payroll_change_points:
        warnings.append("No NFP monthly change points could be built.")

    latest = {
        "payrollChange": payroll_change_points[-1] if payroll_change_points else None,
        "unemploymentRate": unemployment_points[-1] if unemployment_points else None,
        "joltsOpenings": jolts_points[-1] if jolts_points else None,
        "joltsRate": jolts_rate_points[-1] if jolts_rate_points else None,
    }

    return {
        "latest": latest,
        "series": {
            "payrollChange": {
                "label": "NFP monthly change",
                "unit": "k jobs",
                "type": "histogram",
                "color": "#2563eb",
                "sourceUrl": SERIES["payrolls"]["source_url"],
                "points": payroll_change_points,
            },
            "unemploymentRate": {
                "label": "Unemployment rate",
                "unit": "%",
                "type": "line",
                "color": "#b45309",
                "sourceUrl": SERIES["unemployment"]["source_url"],
                "points": unemployment_points,
            },
            "joltsOpenings": {
                "label": "JOLTS openings",
                "unit": "k openings",
                "type": "line",
                "color": "#0f766e",
                "sourceUrl": SERIES["jolts_openings"]["source_url"],
                "points": jolts_points,
            },
        },
        "warnings": warnings,
    }


def load_cache(conn, cache_key):
    row = conn.execute(
        """
        SELECT payload_json, fetched_at, last_successful_refresh
        FROM employment_cache
        WHERE cache_key = ?
        """,
        (cache_key,),
    ).fetchone()
    if not row:
        return None
    return {"payload": json.loads(row[0]), "fetchedAt": row[1], "lastSuccessfulRefresh": row[2]}


def store_cache(conn, cache_key, payload):
    timestamp = utc_now_iso()
    conn.execute(
        """
        INSERT INTO employment_cache(cache_key, payload_json, fetched_at, last_successful_refresh)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          fetched_at = excluded.fetched_at,
          last_successful_refresh = excluded.last_successful_refresh
        """,
        (cache_key, json.dumps(payload), timestamp, timestamp),
    )
    conn.commit()
    return timestamp


def main():
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    api_key = os.environ.get("FRED_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("FRED API key is missing. Store it in credentials under service key 'fredapikey'.")

    cache_key = f"employment:{args.years}"
    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        cached = load_cache(conn, cache_key)

        if cached and not args.refresh and is_cache_fresh(cached["fetchedAt"]):
            payload = cached["payload"]
            payload["servedFrom"] = "cache"
            payload["lastSuccessfulRefresh"] = cached["lastSuccessfulRefresh"]
            print(json.dumps(payload))
            return

        try:
            payload = build_payload(args.years, api_key)
            refreshed_at = store_cache(conn, cache_key, payload)
            payload["servedFrom"] = "remote"
            payload["lastSuccessfulRefresh"] = refreshed_at
            print(json.dumps(payload))
            return
        except Exception as exc:
            if cached:
                payload = cached["payload"]
                warnings = list(payload.get("warnings", []))
                warnings.append(f"Refresh failed, serving cached employment data: {exc}")
                payload["warnings"] = warnings
                payload["servedFrom"] = "stale-cache"
                payload["lastSuccessfulRefresh"] = cached["lastSuccessfulRefresh"]
                print(json.dumps(payload))
                return
            raise


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
