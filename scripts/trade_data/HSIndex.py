"""
HSIndex - HS comtrade lookup table object

Quickly get HS code from a name or the inverse
H1-6 level for full depth and granular details
Requires the official HS json list available here:
    https://unstats.un.org/unsd/classifications/Econ
"""

import json
import argparse
from pprint import pprint


class HSIndex:
    def __init__(self, json_path: str):
        """
        json_path = path to the official comtrade HS json code
        """

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                raw_json = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            raise ValueError(f"Invalid HS JSON file at {json_path}: {e}")
        except Exception as e:
            print(f"Invalid JSon file: {json_path}")
            print(f"{e}")
            exit(1)

        self.by_id = {}
        self.children = {}
        self._name_index = {}

        results = raw_json.get("results", [])

        # ---- build indexes ----
        for item in results:
            code = str(item["id"])
            text = item.get("text", "")

            self.by_id[code] = item

            # parent → children mapping
            parent = item.get("parent")
            if parent:
                parent = str(parent)
                self.children.setdefault(parent, []).append(code)

            # normalize name part ("0101 - Horses..." → "horses...")
            name = text.split(" - ", 1)[-1].strip().lower()
            self._name_index.setdefault(name, []).append(code)

    # -------------------------
    # FAST ACCESS BY CODE
    # -------------------------
    def get(self, code: str):
        item = self.by_id.get(code)
        if not item:
            return None

        return {
            "code": item["id"],
            "text": item["text"],
            "name": item["text"].split(" - ", 1)[-1].strip(),
            "parent": item.get("parent"),
            "is_leaf": item.get("isLeaf") == "1",
            "level": item.get("aggrlevel")
        }

    # -------------------------
    # CHILDREN (TREE NAVIGATION)
    # -------------------------
    def children_of(self, code: str):
        return [self.get(c) for c in self.children.get(code, [])]

    # -------------------------
    # EXACT NAME → CODE
    # -------------------------
    def get_code(self, name: str):
        name = name.strip().lower()
        return self._name_index.get(name, [])

    # -------------------------
    # FUZZY SEARCH (SIMPLE)
    # -------------------------
    def search(self, query: str, limit: int = 20):
        q = query.lower()
        out = []

        for item in self.by_id.values():
            if q in item.get("text", "").lower():
                out.append(self.get(item["id"]))
                if len(out) >= limit:
                    break

        return out

def print_table(data):
    if not data:
        print("No results")
        return

    if isinstance(data, dict):
        data = [data]

    headers = ["code", "name", "parent", "level"]

    def safe(v):
        # critical: never allow int coercion of HS codes
        if v is None:
            return ""
        return str(v)

    rows = []
    for item in data:
        rows.append([
            safe(item.get("code")),
            safe(item.get("name") or item.get("text", "")),
            safe(item.get("parent")),
            safe(item.get("level"))
        ])

    widths = [len(h) for h in headers]

    for r in rows:
        for i, v in enumerate(r):
            widths[i] = max(widths[i], len(v))

    header_row = " | ".join(headers[i].ljust(widths[i]) for i in range(len(headers)))
    print(header_row)
    print("-+-".join("-" * w for w in widths))

    for r in rows:
        print(" | ".join(r[i].ljust(widths[i]) for i in range(len(r))))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=False, help="path to the HS JSON document", default="./com_trade_HS_codes.json", type=str)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--search", help="Search for HScodes containing a word", type=str)
    group.add_argument("--get", help="Get description and name from IDcode", type=str)
    group.add_argument("--children", help="Get IDcode children", type=str)
    parser.add_argument("--hr", help="Human redable format (not raw json)", action="store_true")
    args = parser.parse_args()
    HStable = HSIndex(args.path)
    result = None
    if args.search:
        result = HStable.search(args.search)
    elif args.get:
        result = HStable.get(args.get)
    elif args.children:
        result = HStable.children_of(args.children)

    if args.hr:
        print_table(result)
    else:
        print(result)

if __name__ == "__main__":
    main()
