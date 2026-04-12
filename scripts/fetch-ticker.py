#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import sqlite3
import pandas as pd
from pandas import Timestamp
import re
import zlib
import pprint
import base64
from pathlib import Path
import yfinance as yf

CACHE_TTL_HOURS = 12
debug = False

def utc_now():
    return dt.datetime.now(dt.timezone.utc)

def utc_now_iso():
    return utc_now().replace(microsecond=0).isoformat()

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--debug", type=bool, default=False)
    parser.add_argument("--duration", type=str, default='1mo', help="Time duration from today to Xmo/Yy/Zd in the past (ex: 1mo, 2y)", required=True)
    parser.add_argument("--ticker", type=str, help="Stock ticker", required=True)
    return parser.parse_args()

def ensure_schema(conn):    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ticker_cache (
          cache_key TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          last_successful_refresh TEXT NOT NULL
        )
    """)
    conn.commit()

def is_cache_fresh(fetched_at_iso):
    try:
        fetched_at = dt.datetime.fromisoformat(fetched_at_iso)
    except Exception:
        return False
    return (utc_now() - fetched_at) < dt.timedelta(hours=CACHE_TTL_HOURS)

def df_to_json_safe(df):
    """Convert a pandas DataFrame to JSON-safe list of dicts with string keys and ISO datetimes."""
    if df is None or df.empty:
        return []

    df = df.reset_index()

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ["_".join([str(c) if c is not pd.NaT else "" for c in col]).strip("_") for col in df.columns.values]

    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]) or pd.api.types.is_timedelta64_dtype(df[col]):
            df[col] = df[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)

    return df.to_dict(orient="records")

def history_to_json(ticker_obj, duration: str):
    df = ticker_obj.history(period=duration)
    return df_to_json_safe(df)

def sanitize_for_json(obj):
    """Recursively convert dict/list to JSON-safe structure (keys as str, datetimes to ISO)."""
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, pd.DataFrame):
        return df_to_json_safe(obj)
    elif isinstance(obj, (dt.date, dt.datetime, pd.Timestamp)):
        return obj.isoformat()
    else:
        return obj

def fetch_ticker_full(ticker: str, duration: str):
    if not re.match(r"^([0-9]+(mo|y|d)|max|ytd)$", duration):
        raise ValueError("Invalid duration")

    t = yf.Ticker(ticker)

    payload = {
        "meta": {"ticker": ticker, "fetchedAt": utc_now_iso()},
        "data": {}
    }

    # Sanitize all objects recursively
    payload["data"]["info"] = sanitize_for_json(t.info)
    payload["data"]["calendar"] = sanitize_for_json(t.calendar)
    quarter = [] # quarter is very different... need to manually sanitize pandas timestamps
    for row in sanitize_for_json(t.quarterly_income_stmt):
        temp_obj = {}
        for k,v in row.items():
            if type(k) == Timestamp:
                k = k.to_pydatetime().isoformat()
            temp_obj[k] = v
        quarter.append(temp_obj)
    payload["data"]["analyst_price_targets"] = sanitize_for_json(quarter)

    payload["data"]["quarterly_income_stmt"] = sanitize_for_json(quarter)
    payload["data"]["history"] = sanitize_for_json(history_to_json(t, duration))
    payload["data"]["options"] = sanitize_for_json(t.options)

    if isinstance(payload["data"]["options"], list) and payload["data"]["options"]:
        first = payload["data"]["options"][0]
        option_chain = t.option_chain(first)
        payload["data"]["option_chain"] = {
            "calls": sanitize_for_json(option_chain.calls),
            "puts": sanitize_for_json(option_chain.puts),
        }

    payload["data"]["description"] = sanitize_for_json(t.info.get("longBusinessSummary"))
    # top_holdings only for funds, skip for stocks
    try:
        payload["data"]["top_holdings"] = sanitize_for_json(getattr(t.funds_data, "top_holdings", None))
    except Exception:
        payload["data"]["top_holdings"] = None

    return payload

def compress_payload(payload: dict) -> str:
    raw = json.dumps(payload).encode("utf-8")
    compressed = zlib.compress(raw)
    return base64.b64encode(compressed).decode("utf-8")

def decompress_payload(payload_str: str) -> dict:
    compressed = base64.b64decode(payload_str.encode("utf-8"))
    raw = zlib.decompress(compressed)
    return json.loads(raw.decode("utf-8"))

def load_cache(conn, cache_key):
    row = conn.execute("""
        SELECT payload_json, fetched_at, last_successful_refresh
        FROM ticker_cache
        WHERE cache_key = ?
    """, (cache_key,)).fetchone()

    if not row:
        return None

    return {
        "payload": decompress_payload(row[0]),
        "fetchedAt": row[1],
        "lastSuccessfulRefresh": row[2],
    }

def store_cache(conn, cache_key, payload):
    timestamp = utc_now_iso()
    compressed_payload = compress_payload(payload)

    conn.execute("""
        INSERT INTO ticker_cache(cache_key, payload_json, fetched_at, last_successful_refresh)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          fetched_at = excluded.fetched_at,
          last_successful_refresh = excluded.last_successful_refresh
    """, (cache_key, compressed_payload, timestamp, timestamp))
    conn.commit()
    return timestamp

def main():
    args = parse_args()
    global debug
    debug = args.debug
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    cache_key = f"ticker:{args.ticker}-{args.duration}"

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        cached = load_cache(conn, cache_key)

        if cached and not args.refresh and is_cache_fresh(cached["fetchedAt"]):
            payload = cached["payload"]
            payload["servedFrom"] = "cache"
            payload["lastSuccessfulRefresh"] = cached["lastSuccessfulRefresh"]
            print(json.dumps(payload))
            return

        payload = fetch_ticker_full(args.ticker, args.duration)
        refreshed_at = store_cache(conn, cache_key, payload)
        payload["servedFrom"] = "remote"
        payload["lastSuccessfulRefresh"] = refreshed_at
        print(json.dumps(payload))

if __name__ == "__main__":
    main()