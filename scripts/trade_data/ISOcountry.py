"""
ISOcountry - ISO-3166 lookup table object

Quickly get iso 3166 code from a name or the inverse
Source:
    https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes/blob/master/all/all.json
"""

import json
import argparse


class ISOCountry:
    def __init__(self, json_path: str):
        """
        json_path = path to ISO-3166 JSON file
        """

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                raw_json = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            raise ValueError(f"Invalid country JSON file at {json_path}: {e}")
        except Exception as e:
            print(f"Invalid JSON file: {json_path}")
            print(f"{e}")
            exit(1)

        self.by_code = {}
        self.by_alpha2 = {}
        self.by_alpha3 = {}
        self._name_index = {}

        # dataset is directly a list, not {"results": ...}
        for item in raw_json:

            code = str(item.get("country-code", "")).zfill(3)

            self.by_code[code] = item

            alpha2 = item.get("alpha-2")
            if alpha2:
                self.by_alpha2[alpha2.upper()] = item

            alpha3 = item.get("alpha-3")
            if alpha3:
                self.by_alpha3[alpha3.upper()] = item

            name = item.get("name", "").strip().lower()
            self._name_index.setdefault(name, []).append(code)

    # -------------------------
    # FAST ACCESS BY COUNTRY CODE
    # -------------------------
    def get(self, code: str):

        code = str(code).zfill(3)

        item = self.by_code.get(code)

        if not item:
            return None

        return {
            "name": item.get("name"),
            "country-code": item.get("country-code"),
            "alpha-2": item.get("alpha-2"),
            "alpha-3": item.get("alpha-3"),
            "region": item.get("region"),
            "sub-region": item.get("sub-region")
        }

    # -------------------------
    # EXACT NAME → COUNTRY CODE
    # -------------------------
    def get_code(self, name: str):

        name = name.strip().lower()

        return self._name_index.get(name, [])

    # -------------------------
    # SEARCH COUNTRY
    # -------------------------
    def search(self, query: str, limit: int = 20):

        q = query.lower()

        out = []

        for item in self.by_code.values():

            name = item.get("name", "").lower()

            if q in name:

                out.append({
                    "name": item.get("name"),
                    "country-code": item.get("country-code"),
                    "alpha-2": item.get("alpha-2"),
                    "alpha-3": item.get("alpha-3"),
                    "region": item.get("region"),
                    "sub-region": item.get("sub-region")
                })

                if len(out) >= limit:
                    break

        return out


def print_table(data):

    if not data:
        print("No results")
        return

    if isinstance(data, dict):
        data = [data]

    headers = [
        "country-code",
        "alpha-2",
        "alpha-3",
        "name",
        "region",
        "sub-region"
    ]

    def safe(v):
        if v is None:
            return ""
        return str(v)

    rows = []

    for item in data:

        rows.append([
            safe(item.get("country-code")).zfill(3),
            safe(item.get("alpha-2")),
            safe(item.get("alpha-3")),
            safe(item.get("name")),
            safe(item.get("region")),
            safe(item.get("sub-region"))
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
    parser.add_argument("--path", required=False, help="path to the ISO country JSON document", default="./country_codes.json", type=str)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--search", help="Search countries containing a word", type=str)
    group.add_argument("--get", help="Get country from numeric code", type=str)
    parser.add_argument("--hr", help="Human readable format", action="store_true")
    args = parser.parse_args()

    Countries = ISOCountry(args.path)
    result = None

    if args.search:
        result = Countries.search(args.search)
    elif args.get:
        result = Countries.get(args.get)
    if args.hr:
        print_table(result)
    else:
        print(result)


if __name__ == "__main__":
    main()
