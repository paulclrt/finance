"""
ComCountries - Comtrade country lookup table object

Fast lookup between:
- country name
- reporterCode (Comtrade internal numeric code)
- ISO alpha-2 / alpha-3
"""

import json
import argparse
from pprint import pprint


class ComCountries:
    def __init__(self, json_path: str):

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                raw_json = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            raise ValueError(f"Invalid country JSON file at {json_path}: {e}")

        self.by_code = {}
        self.by_name = {}
        self.by_iso2 = {}
        self.by_iso3 = {}

        results = raw_json.get("results", [])

        for item in results:
            code = str(item.get("reporterCode"))
            name = item.get("text", "").strip().lower()
            iso2 = item.get("reporterCodeIsoAlpha2", "").strip().upper()
            iso3 = item.get("reporterCodeIsoAlpha3", "").strip().upper()

            # main index (Comtrade code)
            self.by_code[code] = item

            # name index
            if name:
                self.by_name.setdefault(name, []).append(code)

            # ISO indices
            if iso2:
                self.by_iso2[iso2] = code
            if iso3:
                self.by_iso3[iso3] = code

    # -------------------------
    # GET BY CODE
    # -------------------------
    def get(self, code: str):
        code = str(code)
        return self.by_code.get(code)

    # -------------------------
    # GET BY NAME (exact or partial)
    # -------------------------
    def search(self, query: str, limit: int = 20):
        q = query.lower()
        out = []

        for item in self.by_code.values():
            if q in item.get("text", "").lower():
                out.append(item)
                if len(out) >= limit:
                    break

        return out

    # -------------------------
    # RESOLVE ANY INPUT → CODE
    # -------------------------
    def resolve(self, s: str):
        s = str(s).strip()

        # numeric code
        if s.isdigit():
            if s in self.by_code:
                return s

        # ISO alpha-2
        if len(s) == 2 and s.upper() in self.by_iso2:
            return self.by_iso2[s.upper()]

        # ISO alpha-3
        if len(s) == 3 and s.upper() in self.by_iso3:
            return self.by_iso3[s.upper()]

        # name fallback
        results = self.search(s)
        if results:
            return str(results[0]["reporterCode"])

        return None


# -------------------------
# TABLE PRINTER
# -------------------------
def print_table(data):
    if not data:
        print("No results")
        return

    if isinstance(data, dict):
        data = [data]

    headers = ["code", "name", "ISO2", "ISO3"]

    def safe(v):
        return "" if v is None else str(v)

    rows = []
    for item in data:
        rows.append([
            safe(item.get("reporterCode")),
            safe(item.get("text")),
            safe(item.get("reporterCodeIsoAlpha2")),
            safe(item.get("reporterCodeIsoAlpha3")),
        ])

    widths = [len(h) for h in headers]

    for r in rows:
        for i, v in enumerate(r):
            widths[i] = max(widths[i], len(v))

    header = " | ".join(headers[i].ljust(widths[i]) for i in range(len(headers)))
    print(header)
    print("-+-".join("-" * w for w in widths))

    for r in rows:
        print(" | ".join(r[i].ljust(widths[i]) for i in range(len(r))))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=False, help="path to the HS JSON document", default="./comtrade_reporters.json", type=str)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--search", help="Search for HScodes containing a word", type=str)
    group.add_argument("--get", help="Get description and name from IDcode", type=str)
    group.add_argument("--children", help="Get IDcode children", type=str)
    parser.add_argument("--hr", help="Human redable format (not raw json)", action="store_true")
    args = parser.parse_args()
    ComTable = ComCountries(args.path)
    result = None
    if args.search:
        result = ComTable.search(args.search)
    elif args.get:
        result = ComTable.get(args.get)

    if args.hr:
        print_table(result)
    else:
        print(result)

if __name__ == "__main__":
    main()
