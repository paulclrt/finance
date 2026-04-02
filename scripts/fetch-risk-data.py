#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import math
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"
CNN_FEAR_GREED_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
CBOE_PUT_CALL_URL = "https://www.cboe.com/us/options/market_statistics/market/"
CACHE_TTL_HOURS = 4


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def utc_now_iso():
    return utc_now().replace(microsecond=0).isoformat()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--years", type=int, default=5)
    return parser.parse_args()


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS risk_cache (
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


def fetch_text(url, params=None, headers=None):
    params = params or {}
    full_url = f"{url}?{urllib.parse.urlencode(params)}" if params else url
    request = urllib.request.Request(
        full_url,
        headers={
            "User-Agent": "Mozilla/5.0 finance-lab/1.0",
            "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
            **(headers or {}),
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def fetch_fred_series(series_id, observation_start, api_key):
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
        points.append({"date": item["date"], "value": float(value)})
    return points


def rolling_std(values):
    if not values:
        return None
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return math.sqrt(variance)


def build_move_proxy_series(yield_series_map, window=21):
    diff_series_by_term = {}
    all_dates = set()

    for term, points in yield_series_map.items():
        diffs = []
        previous = None
        for point in points:
            if previous is None:
                previous = point
                continue
            daily_change_bps = (point["value"] - previous["value"]) * 100
            diffs.append({"date": point["date"], "value": daily_change_bps})
            previous = point
        diff_series_by_term[term] = diffs
        all_dates.update(item["date"] for item in diffs)

    aligned = []
    for current_date in sorted(all_dates):
        term_components = []
        for diffs in diff_series_by_term.values():
            trailing = [item["value"] for item in diffs if item["date"] <= current_date][-window:]
            if len(trailing) < window:
                continue
            vol = rolling_std(trailing)
            if vol is None:
                continue
            term_components.append(vol * math.sqrt(252))

        if term_components:
            aligned.append(
                {
                    "time": current_date,
                    "value": round(sum(term_components) / len(term_components), 2),
                }
            )

    return aligned


def fetch_fear_greed():
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Origin": "https://edition.cnn.com",
        "Pragma": "no-cache",
        "Referer": "https://edition.cnn.com/markets/fear-and-greed",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
    }

    last_error = None
    payload = None
    for url in (CNN_FEAR_GREED_URL, f"{CNN_FEAR_GREED_URL}/"):
        try:
            text = fetch_text(url, headers=headers)
            payload = json.loads(text)
            break
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError) as exc:
            last_error = exc

    if payload is None:
        raise RuntimeError(f"CNN Fear & Greed endpoint blocked or invalid response: {last_error}")

    historical = []
    for item in payload.get("fear_and_greed_historical", {}).get("data", []):
        timestamp = item.get("x")
        score = item.get("y")
        if timestamp is None or score is None:
            continue
        historical.append(
            {
                "time": dt.datetime.fromtimestamp(timestamp / 1000, tz=dt.timezone.utc).strftime("%Y-%m-%d"),
                "value": float(score),
                "rating": item.get("rating", ""),
            }
        )

    current_block = payload.get("fear_and_greed", {}) or payload.get("fear_and_greed_score", {})
    current_score = current_block.get("score")
    current_label = current_block.get("rating") or current_block.get("label") or ""

    if current_score is None and historical:
        current_score = historical[-1]["value"]
    if not current_label and historical:
        current_label = historical[-1].get("rating", "")

    return {
        "current": {
            "value": float(current_score) if current_score is not None else None,
            "label": current_label,
        },
        "series": [{"time": item["time"], "value": round(item["value"], 2)} for item in historical],
        "sourceUrl": "https://edition.cnn.com/markets/fear-and-greed",
    }


def strip_html(html):
    html = re.sub(r"<script.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<style.*?</style>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<[^>]+>", " ", html)
    html = html.replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", html).strip()


def fetch_put_call_ratio():
    text = fetch_text(CBOE_PUT_CALL_URL)
    plain = strip_html(text)
    section_match = re.search(
        r"Total\s+TIME\s+CALLS\s+PUTS\s+TOTAL\s+P/C RATIO\s+(.*?)\s+(?:Index Options|Equity Options|Cboe data is compiled)",
        plain,
        flags=re.IGNORECASE,
    )
    if not section_match:
        raise RuntimeError("Unable to parse Cboe put/call ratio.")

    rows = re.findall(r"(\d{2}:\d{2}\s+[AP]M)\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9.]+)", section_match.group(1))
    if not rows:
        raise RuntimeError("No Cboe put/call rows found.")

    latest_time, calls, puts, total, ratio = rows[-1]
    return {
        "value": round(float(ratio), 2),
        "calls": int(calls),
        "puts": int(puts),
        "total": int(total),
        "asOfLabel": latest_time,
        "sourceUrl": CBOE_PUT_CALL_URL,
    }


def classify_vix(value):
    if value is None:
        return "unavailable"
    if value > 30:
        return "stress"
    if value < 15:
        return "complacency"
    return "normal"


def classify_move_proxy(value):
    if value is None:
        return "unavailable"
    if value > 140:
        return "stress"
    if value < 80:
        return "calm"
    return "elevated"


def classify_put_call(value):
    if value is None:
        return "unavailable"
    if value > 1.0:
        return "defensive"
    if value < 0.7:
        return "complacent"
    return "balanced"


def classify_fear_greed(value):
    if value is None:
        return "unavailable"
    if value < 25:
        return "extreme fear"
    if value < 45:
        return "fear"
    if value <= 55:
        return "neutral"
    if value <= 75:
        return "greed"
    return "extreme greed"


def build_payload(years, api_key):
    observation_start = (utc_now().date() - dt.timedelta(days=365 * years + 60)).isoformat()
    warnings = []

    vix_points = fetch_fred_series("VIXCLS", observation_start, api_key)
    yield_series_map = {
        "2Y": fetch_fred_series("DGS2", observation_start, api_key),
        "10Y": fetch_fred_series("DGS10", observation_start, api_key),
        "30Y": fetch_fred_series("DGS30", observation_start, api_key),
    }
    move_proxy_points = build_move_proxy_series(yield_series_map)

    fear_greed = None
    put_call = None

    try:
        fear_greed = fetch_fear_greed()
    except Exception as exc:
        warnings.append(f"Fear & Greed refresh failed: {exc}")

    try:
        put_call = fetch_put_call_ratio()
    except Exception as exc:
        warnings.append(f"Put/Call refresh failed: {exc}")

    vix_latest = vix_points[-1] if vix_points else None
    move_latest = move_proxy_points[-1] if move_proxy_points else None
    fear_greed_latest = fear_greed["current"] if fear_greed else {"value": None, "label": ""}

    indicators = [
        {
            "id": "vix",
            "label": "VIX",
            "value": vix_latest["value"] if vix_latest else None,
            "displayValue": f"{vix_latest['value']:.2f}" if vix_latest else "--",
            "signal": classify_vix(vix_latest["value"] if vix_latest else None),
            "subtitle": ">30 stress, <15 complacency",
            "asOf": vix_latest["date"] if vix_latest else None,
            "sourceUrl": "https://fred.stlouisfed.org/series/VIXCLS",
        },
        {
            "id": "moveProxy",
            "label": "MOVE proxy",
            "value": move_latest["value"] if move_latest else None,
            "displayValue": f"{move_latest['value']:.2f}" if move_latest else "--",
            "signal": classify_move_proxy(move_latest["value"] if move_latest else None),
            "subtitle": "Treasury vol proxy from 2Y/10Y/30Y FRED yields",
            "asOf": move_latest["time"] if move_latest else None,
            "sourceUrl": "https://fred.stlouisfed.org",
        },
        {
            "id": "putCall",
            "label": "Put/Call ratio",
            "value": put_call["value"] if put_call else None,
            "displayValue": f"{put_call['value']:.2f}" if put_call else "--",
            "signal": classify_put_call(put_call["value"] if put_call else None),
            "subtitle": "Cboe total options put/call ratio",
            "asOf": put_call["asOfLabel"] if put_call else None,
            "sourceUrl": put_call["sourceUrl"] if put_call else CBOE_PUT_CALL_URL,
        },
        {
            "id": "fearGreed",
            "label": "CNN Fear & Greed",
            "value": fear_greed_latest["value"],
            "displayValue": f"{fear_greed_latest['value']:.0f}" if fear_greed_latest["value"] is not None else "--",
            "signal": classify_fear_greed(fear_greed_latest["value"]),
            "subtitle": fear_greed_latest.get("label") or "Sentiment composite",
            "asOf": fear_greed["series"][-1]["time"] if fear_greed and fear_greed["series"] else None,
            "sourceUrl": fear_greed["sourceUrl"] if fear_greed else "https://edition.cnn.com/markets/fear-and-greed",
        },
    ]

    chart_series = [
        {
            "id": "vix",
            "label": "VIX",
            "color": "#dc2626",
            "points": [{"time": item["date"], "value": round(item["value"], 2)} for item in vix_points],
            "valueSuffix": "",
            "sourceUrl": "https://fred.stlouisfed.org/series/VIXCLS",
        },
        {
            "id": "moveProxy",
            "label": "MOVE proxy",
            "color": "#7c3aed",
            "points": move_proxy_points,
            "valueSuffix": "",
            "sourceUrl": "https://fred.stlouisfed.org",
        },
    ]

    if fear_greed and fear_greed["series"]:
        chart_series.append(
            {
                "id": "fearGreed",
                "label": "Fear & Greed",
                "color": "#0f766e",
                "points": fear_greed["series"],
                "valueSuffix": "",
                "sourceUrl": fear_greed["sourceUrl"],
            }
        )

    return {
        "indicators": indicators,
        "chartSeries": chart_series,
        "warnings": warnings,
        "sources": [
            {"label": "FRED VIX", "url": "https://fred.stlouisfed.org/series/VIXCLS"},
            {"label": "FRED Treasuries", "url": "https://fred.stlouisfed.org"},
            {"label": "Cboe put/call", "url": CBOE_PUT_CALL_URL},
            {"label": "CNN Fear & Greed", "url": "https://edition.cnn.com/markets/fear-and-greed"},
        ],
    }


def load_cache(conn, cache_key):
    row = conn.execute(
        """
        SELECT payload_json, fetched_at, last_successful_refresh
        FROM risk_cache
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
        INSERT INTO risk_cache(cache_key, payload_json, fetched_at, last_successful_refresh)
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

    cache_key = f"risk:{args.years}"

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
                warnings.append(f"Risk refresh failed, serving cached data: {exc}")
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
