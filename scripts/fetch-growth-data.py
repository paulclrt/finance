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
    "gdp_level": {
        "id": "GDPC1",
        "label": "Real GDP level",
        "source_url": "https://fred.stlouisfed.org/series/GDPC1",
    },
    "gdp_qoq": {
        "id": "A191RL1Q225SBEA",
        "label": "Real GDP QoQ",
        "source_url": "https://fred.stlouisfed.org/series/A191RL1Q225SBEA",
    },
    "gdp_now": {
        "id": "GDPNOW",
        "label": "GDPNow",
        "source_url": "https://fred.stlouisfed.org/series/GDPNOW",
    },
    "activity": {
        "id": "CFNAI",
        "label": "Chicago Fed activity",
        "source_url": "https://fred.stlouisfed.org/series/CFNAI",
    },
    "manufacturing_proxy": {
        "id": "INDPRO",
        "label": "Industrial production",
        "source_url": "https://fred.stlouisfed.org/series/INDPRO",
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
    parser.add_argument("--years", type=int, default=15)
    return parser.parse_args()


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS growth_cache (
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
            "order_by": "observation_date",
            "sort_order": "asc",
            "limit": 100000,
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


def build_yoy_series(points):
    if len(points) < 5:
        return []
    yoy = []
    for index in range(4, len(points)):
        previous = points[index - 4]["value"]
        current = points[index]["value"]
        if previous == 0:
            continue
        yoy.append({"time": points[index]["time"], "value": round(((current / previous) - 1) * 100, 3)})
    return yoy


def try_fetch_optional_series(series_id, observation_start, api_key):
    try:
        return fetch_series_points(series_id, observation_start, api_key), None
    except Exception as exc:
        return [], str(exc)


def build_payload(years, api_key):
    observation_start = (utc_now().date().replace(day=1) - dt.timedelta(days=365 * years + 90)).isoformat()

    gdp_level_points = fetch_series_points(SERIES["gdp_level"]["id"], observation_start, api_key)
    gdp_qoq_points = fetch_series_points(SERIES["gdp_qoq"]["id"], observation_start, api_key)
    gdp_now_points, gdp_now_error = try_fetch_optional_series(SERIES["gdp_now"]["id"], observation_start, api_key)
    activity_points, activity_error = try_fetch_optional_series(SERIES["activity"]["id"], observation_start, api_key)
    manufacturing_points, manufacturing_error = try_fetch_optional_series(SERIES["manufacturing_proxy"]["id"], observation_start, api_key)
    gdp_yoy_points = build_yoy_series(gdp_level_points)

    warnings = []
    if gdp_now_error:
        warnings.append(f"GDPNow could not be loaded from FRED: {gdp_now_error}")
    if activity_error:
        warnings.append(f"CFNAI could not be loaded from FRED: {activity_error}")
    if manufacturing_error:
        warnings.append(f"Manufacturing proxy could not be loaded from FRED: {manufacturing_error}")
    elif manufacturing_points:
        warnings.append("Manufacturing panel uses FRED industrial production as a stable proxy while the true ISM PMI source is not yet wired in.")

    latest = {
        "gdpQoq": gdp_qoq_points[-1] if gdp_qoq_points else None,
        "gdpYoy": gdp_yoy_points[-1] if gdp_yoy_points else None,
        "gdpNow": gdp_now_points[-1] if gdp_now_points else None,
        "activity": activity_points[-1] if activity_points else None,
        "manufacturingProxy": manufacturing_points[-1] if manufacturing_points else None,
    }

    return {
        "latest": latest,
        "series": {
            "gdpQoq": {
                "label": "GDP QoQ annualized",
                "unit": "%",
                "type": "line",
                "color": "#2563eb",
                "sourceUrl": SERIES["gdp_qoq"]["source_url"],
                "points": gdp_qoq_points,
            },
            "gdpYoy": {
                "label": "GDP YoY",
                "unit": "%",
                "type": "line",
                "color": "#0f766e",
                "sourceUrl": SERIES["gdp_level"]["source_url"],
                "points": gdp_yoy_points,
            },
            "gdpNow": {
                "label": "GDPNow",
                "unit": "%",
                "type": "line",
                "color": "#b45309",
                "sourceUrl": SERIES["gdp_now"]["source_url"],
                "points": gdp_now_points,
            },
            "activity": {
                "label": "Chicago Fed National Activity Index",
                "unit": "index",
                "type": "line",
                "color": "#7c3aed",
                "sourceUrl": SERIES["activity"]["source_url"],
                "points": activity_points,
            },
            "manufacturingProxy": {
                "label": "Industrial production",
                "unit": "index",
                "type": "line",
                "color": "#dc2626",
                "sourceUrl": SERIES["manufacturing_proxy"]["source_url"],
                "points": manufacturing_points,
            },
        },
        "warnings": warnings,
    }


def load_cache(conn, cache_key):
    row = conn.execute(
        """
        SELECT payload_json, fetched_at, last_successful_refresh
        FROM growth_cache
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
        INSERT INTO growth_cache(cache_key, payload_json, fetched_at, last_successful_refresh)
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

    cache_key = f"growth:{args.years}"
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
                warnings.append(f"Refresh failed, serving cached growth data: {exc}")
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
