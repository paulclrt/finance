#!/usr/bin/env python3
import argparse
import base64
import datetime as dt
import json
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

import pandas as pd
import yfinance as yf

CACHE_TTL_HOURS = 12


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def utc_now_iso():
    return utc_now().replace(microsecond=0).isoformat()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--duration", default="5d")
    parser.add_argument("--refresh", action="store_true")
    return parser.parse_args()


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS market_map_symbol_cache (
          symbol TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          last_successful_refresh TEXT NOT NULL
        )
        """
    )
    conn.commit()


def compress_payload(payload):
    raw = json.dumps(payload).encode("utf-8")
    return base64.b64encode(zlib.compress(raw)).decode("utf-8")


def decompress_payload(payload_str):
    return json.loads(zlib.decompress(base64.b64decode(payload_str.encode("utf-8"))).decode("utf-8"))


def is_cache_fresh(fetched_at_iso):
    try:
        fetched_at = dt.datetime.fromisoformat(fetched_at_iso)
    except Exception:
        return False
    return (utc_now() - fetched_at) < dt.timedelta(hours=CACHE_TTL_HOURS)


def load_cached_symbol(conn, symbol):
    row = conn.execute(
        """
        SELECT payload_json, fetched_at, last_successful_refresh
        FROM market_map_symbol_cache
        WHERE symbol = ?
        """,
        (symbol,),
    ).fetchone()
    if not row:
        return None
    return {
        "payload": decompress_payload(row[0]),
        "fetchedAt": row[1],
        "lastSuccessfulRefresh": row[2],
    }


def store_cached_symbol(conn, symbol, payload):
    timestamp = utc_now_iso()
    conn.execute(
        """
        INSERT INTO market_map_symbol_cache(symbol, payload_json, fetched_at, last_successful_refresh)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          payload_json = excluded.payload_json,
          fetched_at = excluded.fetched_at,
          last_successful_refresh = excluded.last_successful_refresh
        """,
        (symbol, compress_payload(payload), timestamp, timestamp),
    )
    conn.commit()
    return timestamp


def parse_group_node(element):
    label = element.attrib.get("label") or element.attrib.get("name") or element.attrib.get("sector") or "Group"
    children = []

    for child in element:
        tag = child.tag.lower()
        if tag in ("group", "sector", "category"):
            children.append(parse_group_node(child))
        elif tag in ("ticker", "symbol", "asset"):
            symbol = (child.attrib.get("symbol") or child.attrib.get("ticker") or (child.text or "")).strip().upper()
            if not symbol:
              continue
            children.append(
                {
                    "type": "ticker",
                    "symbol": symbol,
                    "label": child.attrib.get("label") or child.attrib.get("name") or symbol,
                }
            )

    return {"type": "group", "label": label, "children": children}


def parse_map_config(config_path):
    root = ET.parse(config_path).getroot()
    title = root.attrib.get("title") or root.attrib.get("name") or config_path.stem
    children = []

    for child in root:
        tag = child.tag.lower()
        if tag in ("group", "sector", "category"):
            children.append(parse_group_node(child))
        elif tag in ("ticker", "symbol", "asset"):
            symbol = (child.attrib.get("symbol") or child.attrib.get("ticker") or (child.text or "")).strip().upper()
            if symbol:
                children.append(
                    {
                        "type": "ticker",
                        "symbol": symbol,
                        "label": child.attrib.get("label") or child.attrib.get("name") or symbol,
                    }
                )

    return {"title": title, "tree": {"type": "group", "label": title, "children": children}}


def collect_symbols(node, output=None):
    if output is None:
        output = []
    if node["type"] == "ticker":
        output.append(node["symbol"])
        return output
    for child in node.get("children", []):
        collect_symbols(child, output)
    return output


def normalize_history(df):
    if df is None or df.empty:
        return []
    frame = df.reset_index()
    points = []
    for _, row in frame.iterrows():
        date_value = row.get("Date")
        close_value = row.get("Close")
        if pd.isna(date_value) or pd.isna(close_value):
            continue
        points.append({"date": pd.Timestamp(date_value).date().isoformat(), "close": round(float(close_value), 6)})
    return points


def fetch_symbol_payload(symbol, history):
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}
    return {
        "symbol": symbol,
        "shortName": info.get("shortName") or info.get("longName") or symbol,
        "longName": info.get("longName") or info.get("shortName") or symbol,
        "quoteType": info.get("quoteType") or "",
        "currency": info.get("currency") or "",
        "marketCap": info.get("marketCap") or 0,
        "history": history or [],
    }


def resolve_symbol_payload(conn, symbol, duration, batch_history=None, refresh=False):
    cached = load_cached_symbol(conn, symbol)
    if cached and not refresh and is_cache_fresh(cached["fetchedAt"]):
        payload = cached["payload"]
        if payload.get("duration") == duration:
            payload["servedFrom"] = "cache"
            payload["lastSuccessfulRefresh"] = cached["lastSuccessfulRefresh"]
            return payload

    try:
        history = []
        if batch_history and symbol in batch_history:
            history = batch_history[symbol]
        payload = fetch_symbol_payload(symbol, history)
        payload["duration"] = duration
        refreshed_at = store_cached_symbol(conn, symbol, payload)
        payload["servedFrom"] = "remote"
        payload["lastSuccessfulRefresh"] = refreshed_at
        return payload
    except Exception as exc:
        if cached and cached["payload"].get("duration") == duration:
            payload = cached["payload"]
            payload["servedFrom"] = "stale-cache"
            payload["lastSuccessfulRefresh"] = cached["lastSuccessfulRefresh"]
            payload["warning"] = f"Using cached data after refresh failure: {exc}"
            return payload
        raise


def fetch_histories_batch(symbols, duration):
    if not symbols:
        return {}

    frame = yf.download(
        tickers=list(symbols),
        period=duration,
        group_by="ticker",
        auto_adjust=False,
        progress=False,
        threads=True,
    )

    histories = {}
    if frame is None or frame.empty:
        return {symbol: [] for symbol in symbols}

    if isinstance(frame.columns, pd.MultiIndex):
        for symbol in symbols:
            if symbol not in frame.columns.get_level_values(0):
                histories[symbol] = []
                continue
            histories[symbol] = normalize_history(frame[symbol])
        return histories

    symbol = symbols[0]
    histories[symbol] = normalize_history(frame)
    return histories


def pick_start_date(duration):
    return None


def compute_change_percent(history, duration):
    if not history:
        return 0

    last_close = history[-1]["close"]
    first_close = history[0]["close"]

    if not first_close:
        return 0
    return round(((last_close - first_close) / first_close) * 100, 3)


def build_enriched_tree(node, symbol_payloads, duration):
    if node["type"] == "ticker":
        payload = symbol_payloads[node["symbol"]]
        return {
            "type": "ticker",
            "label": node["label"],
            "symbol": node["symbol"],
            "marketCap": payload.get("marketCap") or 1,
            "quoteType": payload.get("quoteType") or "",
            "changePercent": compute_change_percent(payload.get("history", []), duration),
            "lastPrice": payload.get("history", [{}])[-1].get("close") if payload.get("history") else None,
            "currency": payload.get("currency") or "",
            "servedFrom": payload.get("servedFrom") or "unknown",
            "lastSuccessfulRefresh": payload.get("lastSuccessfulRefresh"),
        }

    children = [build_enriched_tree(child, symbol_payloads, duration) for child in node.get("children", [])]
    total_market_cap = sum(child.get("marketCap", 0) for child in children)
    return {
        "type": "group",
        "label": node["label"],
        "marketCap": total_market_cap,
        "children": children,
    }


def main():
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    config_path = Path(args.config)
    parsed = parse_map_config(config_path)
    symbols = sorted(set(collect_symbols(parsed["tree"])))

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        batch_history = fetch_histories_batch(symbols, args.duration)
        symbol_payloads = {
            symbol: resolve_symbol_payload(conn, symbol, args.duration, batch_history=batch_history, refresh=args.refresh)
            for symbol in symbols
        }

    tree = build_enriched_tree(parsed["tree"], symbol_payloads, args.duration)
    sources = sorted(set(payload.get("servedFrom", "unknown") for payload in symbol_payloads.values()))

    print(
        json.dumps(
            {
                "title": parsed["title"],
                "duration": args.duration,
                "tree": tree,
                "symbolCount": len(symbols),
                "servedFrom": ", ".join(sources),
                "generatedAt": utc_now_iso(),
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
