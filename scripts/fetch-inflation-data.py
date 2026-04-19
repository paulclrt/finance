#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import io
import json
import os
import sqlite3
import sys
import urllib.parse
import urllib.request
from pathlib import Path

FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"
ECB_DATA_API_URL = "https://data-api.ecb.europa.eu/service/data"
CACHE_TTL_HOURS = 12

US_SERIES = [
    {
        "id": "CPIAUCSL",
        "label": "US CPI",
        "region": "US",
        "source_url": "https://fred.stlouisfed.org/series/CPIAUCSL",
        "color": "#2563eb",
    },
    {
        "id": "PCEPI",
        "label": "US PCE",
        "region": "US",
        "source_url": "https://fred.stlouisfed.org/series/PCEPI",
        "color": "#b45309",
    },
]

EU_SERIES = [
    {
        "id": "eu_hicp",
        "flow_ref": "HICP",
        "series_key": "M.U2.N.000000.4D0.ANR",
        "fallback_flow_ref": "ICP",
        "fallback_series_key": "M.U2.N.000000.4.ANR",
        "label": "EU HICP",
        "region": "EU",
        "source_url": "https://data.ecb.europa.eu/data/datasets/HICP/HICP.M.U2.N.000000.4D0.ANR",
        "color": "#0f766e",
    },
    {
        "id": "eu_core_hicp",
        "flow_ref": "HICP",
        "series_key": "M.U2.N.XEF000.4D0.ANR",
        "fallback_flow_ref": "ICP",
        "fallback_series_key": "M.U2.N.XEF000.4.ANR",
        "label": "EU Core HICP",
        "region": "EU",
        "source_url": "https://data.ecb.europa.eu/data/datasets/HICP/HICP.M.U2.N.XEF000.4D0.ANR",
        "color": "#059669",
    },
]


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def utc_now_iso():
    return utc_now().replace(microsecond=0).isoformat()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--years", type=int, default=15)
    return parser.parse_args()


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS inflation_cache (
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


def fetch_text(url, params, accept="application/json"):
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        full_url,
        headers={
            "User-Agent": "finance-lab/1.0",
            "Accept": accept,
        },
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
    raw_points = []
    for item in payload.get("observations", []):
        value = item.get("value", ".")
        if value in ("", "."):
            continue
        raw_points.append(
            {
                "date": item["date"],
                "value": float(value),
            }
        )
    return raw_points


def build_yoy_series(raw_points):
    points_by_date = {point["date"]: point["value"] for point in raw_points}
    yoy_points = []
    for point in raw_points:
        current_date = dt.date.fromisoformat(point["date"])
        previous_year_date = current_date.replace(year=current_date.year - 1).isoformat()
        previous_value = points_by_date.get(previous_year_date)
        if previous_value in (None, 0):
            continue
        yoy_points.append(
            {
                "time": point["date"],
                "value": round(((point["value"] / previous_value) - 1) * 100, 3),
            }
        )
    return yoy_points


def normalize_month_period(value):
    if not value:
        return ""

    if len(value) == 7:
        return f"{value}-01"
    return value


def parse_ecb_csv_series(text):
    reader = csv.DictReader(io.StringIO(text))
    raw_points = []
    for row in reader:
        time_period = normalize_month_period(row.get("TIME_PERIOD", ""))
        value = row.get("OBS_VALUE", "")
        if not time_period or value in ("", "."):
            continue
        raw_points.append(
            {
                "time": time_period,
                "value": round(float(value), 3),
            }
        )
    return raw_points


def fetch_ecb_series_points(config, start_period):
    attempts = [
        (config["flow_ref"], config["series_key"]),
        (config.get("fallback_flow_ref"), config.get("fallback_series_key")),
    ]

    errors = []
    for flow_ref, series_key in attempts:
        if not flow_ref or not series_key:
            continue

        try:
            text = fetch_text(
                f"{ECB_DATA_API_URL}/{flow_ref}/{series_key}",
                {
                    "startPeriod": start_period[:7],
                    "format": "csvdata",
                    "detail": "dataonly",
                },
                accept="text/csv,application/json;q=0.9,*/*;q=0.8",
            )
            return parse_ecb_csv_series(text)
        except Exception as exc:
            errors.append(f"{flow_ref}/{series_key}: {exc}")

    raise RuntimeError(f"ECB series fetch failed for {config['label']}: {'; '.join(errors)}")


def build_payload(years, api_key):
    observation_start = (utc_now().date().replace(day=1) - dt.timedelta(days=365 * years + 40)).isoformat()
    dataset = []
    latest = []

    for config in US_SERIES:
        raw_points = fetch_series_points(config["id"], observation_start, api_key)
        yoy_points = build_yoy_series(raw_points)
        latest_point = yoy_points[-1] if yoy_points else None
        dataset.append(
            {
                "id": config["id"],
                "label": config["label"],
                "region": config["region"],
                "sourceUrl": config["source_url"],
                "color": config["color"],
                "points": yoy_points,
            }
        )
        latest.append(
            {
                "id": config["id"],
                "label": config["label"],
                "region": config["region"],
                "sourceUrl": config["source_url"],
                "latestPoint": latest_point,
            }
        )

    for config in EU_SERIES:
        yoy_points = fetch_ecb_series_points(config, observation_start)
        latest_point = yoy_points[-1] if yoy_points else None
        dataset.append(
            {
                "id": config["id"],
                "label": config["label"],
                "region": config["region"],
                "sourceUrl": config["source_url"],
                "color": config["color"],
                "points": yoy_points,
            }
        )
        latest.append(
            {
                "id": config["id"],
                "label": config["label"],
                "region": config["region"],
                "sourceUrl": config["source_url"],
                "latestPoint": latest_point,
            }
        )

    warnings = []
    if not any(series["points"] for series in dataset):
        warnings.append("No inflation series could be built from FRED and ECB observations.")

    return {
        "series": dataset,
        "latest": latest,
        "warnings": warnings,
    }


def load_cache(conn, cache_key):
    row = conn.execute(
        """
        SELECT payload_json, fetched_at, last_successful_refresh
        FROM inflation_cache
        WHERE cache_key = ?
        """,
        (cache_key,),
    ).fetchone()
    if not row:
        return None
    return {
        "payload": json.loads(row[0]),
        "fetchedAt": row[1],
        "lastSuccessfulRefresh": row[2],
    }


def store_cache(conn, cache_key, payload):
    timestamp = utc_now_iso()
    conn.execute(
        """
        INSERT INTO inflation_cache(cache_key, payload_json, fetched_at, last_successful_refresh)
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
    api_key = os.environ.get("FRED_API_KEY", "").strip() #bad
    if not api_key:
        raise RuntimeError("FRED API key is missing. Store it in credentials under service key 'fredapikey'.")

    cache_key = f"inflation:{args.years}"

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
                warnings.append(f"Refresh failed, serving cached inflation data: {exc}")
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
