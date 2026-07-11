#!/usr/bin/env python3
"""
SEC EDGAR Filing Comparator

Fetches financial data from the SEC EDGAR public API (free, no key required)
and produces well-formatted text reports for comparing filings across periods.

Usage:
    python fetcher.py -t AAPL                  # Latest 10-Q (US-GAAP)
    python fetcher.py -t AAPL -f 10-K -n 4     # Compare last 4 10-Ks
    python fetcher.py -t AAPL -o aapl.txt      # Save to file
    python fetcher.py --ifrs -t SAP             # IFRS taxonomy
    python fetcher.py --explain                 # Print glossary
"""

import argparse
import sys
import time
from datetime import datetime
from typing import Any

import requests


HEADERS = {"User-Agent": "SEC-Filing-Comparator/1.0 (paulclrt@gmail.com)"}

TICKER_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{:010d}.json"

CONCEPT_MAP: dict[str, tuple[list[str], str]] = {}
INCOME_KEYS: list[str] = []
BALANCE_KEYS: list[str] = []
CASHFLOW_KEYS: list[str] = []
TAXONOMY_NAME = ""
CURRENCY = ""


def main() -> None:
    args = parse_args()

    if args.explain:
        print_glossary()
        sys.exit(0)

    load_taxonomy(args.ifrs)

    try:
        cik = resolve_cik(args.ticker)
        print(f"Resolved {args.ticker} \u2192 CIK {cik:010d}", file=sys.stderr)

        facts = fetch_company_facts(cik)
        company_name = facts.get("entityName", args.ticker)
        print(f"Fetched data for {company_name}", file=sys.stderr)

        periods = build_report(facts, args.form)
        periods = [p for p in periods if p.get("Revenue") is not None][:args.count]

        if not periods:
            print(f"No {args.form} filings found for {args.ticker}", file=sys.stderr)
            sys.exit(1)

        output = format_report(periods, args.ticker, company_name, args.form)

        if args.output:
            with open(args.output, "w") as f:
                f.write(output)
            print(f"Saved to {args.output}", file=sys.stderr)
        else:
            print(output)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def load_taxonomy(ifrs: bool) -> None:
    global CONCEPT_MAP, INCOME_KEYS, BALANCE_KEYS, CASHFLOW_KEYS, TAXONOMY_NAME, CURRENCY
    if ifrs:
        import ifrs as t
    else:
        import us_gaap as t
    CONCEPT_MAP = t.CONCEPT_MAP
    INCOME_KEYS = t.INCOME_KEYS
    BALANCE_KEYS = t.BALANCE_KEYS
    CASHFLOW_KEYS = t.CASHFLOW_KEYS
    TAXONOMY_NAME = t.TAXONOMY
    CURRENCY = t.CURRENCY


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SEC Filing Comparator \u2014 fetch and compare 10-K / 10-Q financial data"
    )

    explain_or_fetch = parser.add_mutually_exclusive_group(required=True)
    explain_or_fetch.add_argument("-t", "--ticker", help="Stock ticker (e.g., AAPL)")
    explain_or_fetch.add_argument("-e", "--explain", action="store_true", help="Print financial terms glossary and exit")
    parser.add_argument("-f", "--form", choices=["10-K", "10-Q", "20-F"], default="10-Q", help="Filing type (default: 10-Q; 20-F for IFRS annual)")
    parser.add_argument("-n", "--count", type=int, default=1, help="Number of recent filings (default: 1)")
    parser.add_argument("-o", "--output", metavar="FILE", help="Write to file instead of stdout")
    parser.add_argument("--ifrs", action="store_true", help="Use IFRS taxonomy (instead of US-GAAP)")
    return parser.parse_args()


def resolve_cik(ticker: str) -> int:
    resp = requests.get(TICKER_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    for entry in resp.json().values():
        if entry["ticker"].upper() == ticker.upper():
            return int(entry["cik_str"])
    raise ValueError(f"Ticker '{ticker}' not found")


def fetch_company_facts(cik: int) -> dict:
    url = FACTS_URL.format(cik)
    time.sleep(0.1)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    if resp.status_code == 404:
        raise ValueError(f"No data found for CIK {cik:010d}")
    resp.raise_for_status()
    return resp.json()


def build_report(facts: dict, form: str) -> list[dict]:
    tx_data = facts.get("facts", {}).get(TAXONOMY_NAME, {})
    if not tx_data:
        raise ValueError(f"No {TAXONOMY_NAME} financial data available")

    periods: dict[str, dict] = {}

    for concept_key, (tags, _) in CONCEPT_MAP.items():
        for tag in tags:
            concept = tx_data.get(tag)
            if not concept:
                continue

            is_eps = concept_key in ("EarningsPerShareBasic", "EarningsPerShareDiluted")

            for unit, entries in concept.get("units", {}).items():
                is_currency = any(c in unit for c in ("USD", "EUR", "GBP", "CHF", "JPY", "CNY"))

                for entry in entries:
                    if entry.get("form") != form:
                        continue
                    fp = entry.get("fp", "")
                    end = entry.get("end", "")
                    val = entry.get("val")
                    if not end or val is None:
                        continue

                    if form in ("10-K", "20-F") and fp not in ("FY",):
                        continue
                    if form == "10-Q" and fp not in ("Q1", "Q2", "Q3"):
                        continue

                    if end not in periods:
                        periods[end] = {"_end": end, "_fp": fp}

                    existing = periods[end].get(concept_key)
                    if is_eps:
                        if existing is None:
                            periods[end][concept_key] = val
                    elif is_currency:
                        val_in_m = val / 1_000_000
                        if existing is None or abs(val_in_m) > abs(existing):
                            periods[end][concept_key] = val_in_m

    sorted_periods = sorted(periods.keys(), reverse=True)
    return [periods[p] for p in sorted_periods]


# ─── Glossary ─────────────────────────────────────────────────────────

def print_glossary() -> None:
    sep = "\u2500" * 100
    print(sep)
    print(" SEC Filing Comparator \u2014 Financial Terms Glossary ".center(100))
    print(sep)
    print()

    def section(name: str):
        print(f" {name} ".ljust(80, "\u2501"))
        print()

    def entry(term: str, definition: str):
        print(f"  {term:30s} {definition}")

    section("INCOME STATEMENT")
    entry("Revenue", "Total income from sales of goods and services.")
    entry("Cost of Revenue", "Direct costs attributable to producing goods/services sold (COGS/COS).")
    entry("Gross Profit", "Revenue minus Cost of Revenue. Measures production efficiency.")
    entry("R&D Expenses", "Costs incurred for research and development activities.")
    entry("SG&A Expenses", "Selling, General & Administrative operating expenses.")
    entry("Operating Income (Loss)", "Profit from core business operations (EBIT).")
    entry("Interest Expense", "Cost of borrowing / interest on debt.")
    entry("Income Tax Expense", "Corporate income taxes.")
    entry("Net Income", "Bottom-line profit after all expenses and taxes.")
    entry("Basic EPS", "Net Income / Weighted Avg Basic Shares Outstanding.")
    entry("Diluted EPS", "Net Income / Weighted Avg Diluted Shares (incl. options, converts).")

    print()
    section("BALANCE SHEET")
    entry("Cash & Equivalents", "Cash on hand and short-term highly liquid investments.")
    entry("Accounts Receivable", "Money owed by customers.")
    entry("Inventory", "Raw materials, WIP, and finished goods.")
    entry("Current Assets", "Assets expected to convert to cash within 1 year.")
    entry("Total Assets", "All assets owned (Current + Non-current).")
    entry("Current Liabilities", "Obligations due within 1 year.")
    entry("Total Liabilities", "All debts and obligations (Current + Long-term).")
    entry("Long-Term Debt", "Debt obligations maturing beyond 1 year.")
    entry("Total Equity", "Assets minus Liabilities (book value / shareholders\u2019 equity).")

    print()
    section("CASH FLOW")
    entry("Operating Cash Flow", "Cash generated from core business operations.")
    entry("Investing Cash Flow", "Cash used in / generated from investments (PP&E, acquisitions).")
    entry("Financing Cash Flow", "Cash from / used in financing (debt, equity, dividends).")
    entry("Free Cash Flow", "Operating Cash Flow minus Capital Expenditures.")

    print()
    section("RATIOS")
    entry("Gross Margin", "Gross Profit / Revenue. Production profitability.")
    entry("Operating Margin", "Operating Income / Revenue. Operational profitability.")
    entry("Net Margin", "Net Income / Revenue. Overall profitability.")
    entry("Current Ratio", "Current Assets / Current Liabilities. Short-term liquidity.")
    entry("Debt-to-Equity", "Long-Term Debt / Total Equity. Leverage measure.")
    entry("ROE", "Net Income / Total Equity. Return to shareholders.")
    entry("ROA", "Net Income / Total Assets. Asset efficiency.")

    print()
    print(sep)
    print()


# ─── Formatting ───────────────────────────────────────────────────────

def fmt(val: Any, concept_key: str = "") -> str:
    if val is None:
        return "\u2014"
    if concept_key in ("EarningsPerShareBasic", "EarningsPerShareDiluted"):
        return f"{val:.2f}"
    if abs(val) >= 1000:
        return f"{val:,.0f}"
    if abs(val) >= 1:
        return f"{val:,.1f}"
    if isinstance(val, float):
        return f"{val:.2f}"
    return str(val)


def fmt_pct(val: float | None) -> str:
    if val is None:
        return "\u2014"
    return f"{val:.1%}"


def display_name(concept_key: str) -> str:
    return CONCEPT_MAP[concept_key][1]


def _ratio(a: float | None, b: float | None) -> float | None:
    if a is not None and b and b != 0:
        return a / b
    return None


def format_report(periods: list[dict], ticker: str, company_name: str, form: str) -> str:
    lines: list[str] = []
    n = len(periods)
    sep = "\u2500" * 100

    header = f"{ticker} \u2014 {company_name} \u2014 SEC {form}"
    if n > 1:
        header += f" (last {n})"

    currency_label = f"(in {CURRENCY} M)"

    lines.append(sep)
    lines.append(f" {header} ".center(100))
    lines.append(sep)
    lines.append("")

    if n > 1:
        lines.extend(_comparison_table(periods, currency_label))
    else:
        p = periods[0]
        period_end = p.get("_end", "")
        fp_label = p.get("_fp", "")
        lines.append(f"  Period end: {period_end}  |  Fiscal period: {fp_label}")
        lines.append("")
        lines.extend(_single_table(p, currency_label))

    lines.append("")
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("Source: data.sec.gov (SEC EDGAR API)")
    lines.append("")
    return "\n".join(lines)


def _section_header(label: str) -> list[str]:
    n = 96
    return ["", f" {label} " + "\u2501" * (n - len(label) - 2), ""]


def _single_table(p: dict, currency_label: str) -> list[str]:
    lines: list[str] = []

    lines.append(f"  INCOME STATEMENT {currency_label}" + " " + "\u2500" * (67 - len(currency_label)))
    for k in INCOME_KEYS:
        lines.append(f"    {display_name(k):42s} {fmt(p.get(k), k):>12s}")

    lines.append("")
    lines.append(f"  BALANCE SHEET {currency_label}" + " " + "\u2500" * (71 - len(currency_label)))
    for k in BALANCE_KEYS:
        lines.append(f"    {display_name(k):42s} {fmt(p.get(k), k):>12s}")

    lines.append("")
    lines.append(f"  CASH FLOW {currency_label}" + " " + "\u2500" * (76 - len(currency_label)))
    for k in CASHFLOW_KEYS:
        lines.append(f"    {display_name(k):42s} {fmt(p.get(k), k):>12s}")

    # Free Cash Flow
    ocf = p.get("NetCashProvidedByUsedInOperatingActivities")
    capex = p.get("PaymentsToAcquirePropertyPlantAndEquipment")
    fcf = (ocf - capex) if ocf is not None and capex is not None else None
    lines.append(f"    {'Free Cash Flow':42s} {fmt(fcf):>12s}")

    lines.append("")
    lines.append("  RATIOS" + " " + "\u2500" * 89)
    ratios = [
        ("Gross Margin", _ratio(p.get("GrossProfit"), p.get("Revenue"))),
        ("Operating Margin", _ratio(p.get("OperatingIncomeLoss"), p.get("Revenue"))),
        ("Net Margin", _ratio(p.get("NetIncomeLoss"), p.get("Revenue"))),
        ("Current Ratio", _ratio(p.get("AssetsCurrent"), p.get("LiabilitiesCurrent"))),
        ("Debt-to-Equity", _ratio(p.get("LongTermDebtNoncurrent"), p.get("StockholdersEquity"))),
        ("ROE", _ratio(p.get("NetIncomeLoss"), p.get("StockholdersEquity"))),
        ("ROA", _ratio(p.get("NetIncomeLoss"), p.get("Assets"))),
    ]
    for name, val in ratios:
        lines.append(f"    {name:42s} {fmt_pct(val):>12s}")

    return lines


def _comparison_table(periods: list[dict], currency_label: str) -> list[str]:
    col_w = 18
    lines: list[str] = []

    sections = [
        (f"KEY METRICS {currency_label}", ["Revenue", "CostOfRevenue", "GrossProfit", "OperatingIncomeLoss", "NetIncomeLoss", "EarningsPerShareDiluted"]),
        (f"BALANCE SHEET {currency_label}", ["CashAndCashEquivalentsAtCarryingValue", "AssetsCurrent", "Assets", "LiabilitiesCurrent", "Liabilities", "LongTermDebtNoncurrent", "StockholdersEquity"]),
        (f"CASH FLOW {currency_label}", ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInInvestingActivities", "NetCashProvidedByUsedInFinancingActivities"]),
    ]

    for section_name, keys in sections:
        lines.append("")
        lines.append(f"  {section_name}" + " " + "\u2500" * max(0, 80 - len(section_name)))

        header = f"  {'Metric':42s}"
        for p in periods:
            label = p.get("_end", "")
            header += f"  {label:>{col_w}s}"
        lines.append(header)

        ruler = "  " + "\u2500" * 42
        for _ in periods:
            ruler += "  " + "\u2500" * col_w
        lines.append(ruler)

        for k in keys:
            row = f"  {display_name(k):42s}"
            for p in periods:
                v = p.get(k)
                row += f"  {fmt(v, k):>{col_w}s}"
            lines.append(row)

        # Free Cash Flow row in CASH FLOW section
        if section_name.startswith("CASH FLOW"):
            row = f"  {'Free Cash Flow':42s}"
            for p in periods:
                ocf = p.get("NetCashProvidedByUsedInOperatingActivities")
                capex = p.get("PaymentsToAcquirePropertyPlantAndEquipment")
                fcf = (ocf - capex) if ocf is not None and capex is not None else None
                row += f"  {fmt(fcf):>{col_w}s}"
            lines.append(row)

        if section_name.startswith("KEY METRICS"):
            lines.append(ruler)
            for ratio_name, ratio_fn in [
                ("Gross Margin", lambda p: _ratio(p.get("GrossProfit"), p.get("Revenue"))),
                ("Operating Margin", lambda p: _ratio(p.get("OperatingIncomeLoss"), p.get("Revenue"))),
                ("Net Margin", lambda p: _ratio(p.get("NetIncomeLoss"), p.get("Revenue"))),
                ("Current Ratio", lambda p: _ratio(p.get("AssetsCurrent"), p.get("LiabilitiesCurrent"))),
                ("Debt-to-Equity", lambda p: _ratio(p.get("LongTermDebtNoncurrent"), p.get("StockholdersEquity"))),
            ]:
                row = f"  {ratio_name:42s}"
                for p in periods:
                    row += f"  {fmt_pct(ratio_fn(p)):>{col_w}s}"
                lines.append(row)

    return lines


if __name__ == "__main__":
    main()
