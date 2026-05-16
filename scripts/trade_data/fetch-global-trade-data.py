import ipaddress
import re
import argparse
import comtradeapicall
import importlib.metadata
from datetime import date, datetime

# local imports
from HSIndex import HSIndex, print_table
from ComCountries import ComCountries

HStable = HSIndex("./com_trade_HS_codes.json")
ComCountriesTable = ComCountries("./comtrade_reporters.json")

################################################
# Config global variables
################################################
EXPORT_CODE         =       "M"
IMPORT_CODE         =       "X"
RE_IMPORT_CODE      =       "RM"
RE_EXPORT_CODE      =       "RX"

COMMODITY_CODE      =       "C"
SERVICE_CODE        =       "S"

CLASSIFICATION_CODE =       "HS"

FREQ_CODE_MONTHLY   =       "M"
FREQ_CODE_ANNUALY   =       "A"

OUTPUT_FORMAT       =       "JSON"
################################################
# Argument function validator
################################################
def valid_date(s: str):
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"Invalid date '{s}'. Expected format: YYYY-MM-DD"
        )
def v_flow(s: str):
    imports = ["imports", "i", "import"]
    exports = ["exports", "e", "export"]
    valid_types = imports + exports
    if s.lower() not in valid_types:
        raise argparse.ArgumentTypeError(
                f"Invalid import/export type :'{s}'. Expected format: {"/".join(valid_types)}"
        )
    else:
        if s.lower() in imports:
            return IMPORT_CODE
        else:
            return EXPORT_CODE
def v_freq(s: str):
    annual = ["annual", "yearly", "year", "y", "an", "A"]
    monthly = ["month", "monthly", "M"]
    valid_types = annual + monthly
    if s.lower() not in valid_types:
        raise argparse.ArgumentTypeError(
                f"Invalid frequency type :'{s}'. Expected format: {"/".join(valid_types)}"
        )
    else:
        if s.lower() in monthly:
            return FREQ_CODE_MONTHLY
        else:
            return FREQ_CODE_ANNUALY
def v_type(s: str):
    commodities = ["commodity", "commodities", "c"]
    services = ["service", "services", "s"]
    valid_types = commodities + services
    if s.lower() not in valid_types:
        raise argparse.ArgumentTypeError(
                f"Invalid import/export type :'{s}'. Expected format: {"/".join(valid_types)}"
        )
    else:
        if s.lower() in commodities:
            return COMMODITY_CODE
        else:
            return SERVICE_CODE
def v_proxy(s: str):
    # expected format: host:port
    pattern = re.compile(r"^([^:]+):(\d{1,5})$")
    m = pattern.match(s)
    if not m:
        raise argparse.ArgumentTypeError("Invalid proxy format. Use host:port")

    host, port_str = m.groups()
    # validate port range
    port = int(port_str)
    if not (1 <= port <= 65535):
        raise argparse.ArgumentTypeError("Port must be 1-65535")
    # validate IP OR domain
    if not is_valid_ip(host):
        raise argparse.ArgumentTypeError("Invalid IP or domain")
    if not check_proxy(host, port):
        raise argparse.ArgumentTypeError("Could not ping proxy. Check again or find a way to override this filter")

    return host, port

# internal functions/validations
def is_valid_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False
def check_proxy(host, port, timeout=2.0):
    import socket
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False
def v_HSobject(s: str):

    if s.lower() == "total":
        return None

    list = []
    if "," in s.lower():
        list = s.split(",")
    else:
        list = [s]

    results = []
    for el in list:
        results_text = HStable.search(el)
        result_code = HStable.get(el)

        if not results_text and not result_code:
            raise argparse.ArgumentTypeError(
                f"No results found for {s}"
            )

        elif result_code:
            results.append(result_code["code"])
        elif len(results_text) > 1:
            results.append(results_text[0]["code"])
    return ",".join(results)
def v_country(s: str):
    results_text = ComCountriesTable.search(s.lower())
    results_code = ComCountriesTable.get(s.lower())

    if not results_code and not len(results_text) > 0:
        raise argparse.ArgumentTypeError(
                f"No results found for code {s}"
        )
    if len(results_text) > 0 and not results_code:
        return results_text[0]["reporterCode"]
    elif results_code and not results_text:
        return results_code["reporterCode"]

################################################
# Argument definition
################################################
parser = argparse.ArgumentParser()
parser.add_argument("-c", "--country", help="country you want to see import/export of", type=v_country, required=True)
parser.add_argument("--p1", "--partner1", help="country it traded with 1", type=v_country, required=False, default=None)
parser.add_argument("--p2", "--partner2", help="country it traded with 2", type=v_country, required=False, default=None)
parser.add_argument("-t", "--type", help="'S' (service) or 'C' (commodity)", type=v_type, required=True)
parser.add_argument("-f", "--flow", help="export or imports", type=v_flow, required=True)
parser.add_argument("--freq", help="Frequency of data (annual/monthly)", type=v_freq, required=True)
parser.add_argument("-o", "--object", help="commodity/service name you are looking for", type=v_HSobject, default=None)
from_to = parser.add_mutually_exclusive_group(required=False)
from_to.add_argument("--from", help="country we import from")
from_to.add_argument("--to", help="country we export to")
parser.add_argument("--date-start", help="YYYY-MM-DD", type=valid_date, required=True)
parser.add_argument("--date-end", help="YYYY-MM-DD", type=valid_date, required=True)
parser.add_argument("-v", "--version", help="display comtradeapicall version used", required=False, action="store_true")
parser.add_argument("--output-dir", help="When downlaoading data, save it in the output dir", type=str, default="./output")
parser.add_argument("-j", "--key", help="comtrade subscruption key if premium functionality used", type=str)
parser.add_argument("-p", "--proxy", help="not implemented yet", type=str)
# parser.add_argument("-w", "--no-warnings", help="Only display the result", default=True, action="store_true")
args = parser.parse_args()



if args.version:
    version = importlib.metadata.version("comtradeapicall")
    print(f"comtradeapicall version: {version}")
    exit(0)



# not used
output_dir          =   args.output_dir
subscription_key    =   args.key
proxy_url           =   args.proxy #tuple


################################################
# Argument transformation
################################################

def comtrade_periods(start: date, end: date, freq: str = "M"):
    if start > end:
        raise ValueError("start date must be <= end date")

    periods = []
    if freq == FREQ_CODE_ANNUALY:
        for year in range(start.year, end.year + 1):
            periods.append(str(year))
        return ",".join(periods)
    elif freq == FREQ_CODE_MONTHLY:
        current = date(start.year, start.month, 1)
        end_month = date(end.year, end.month, 1)
        while current <= end_month:
            periods.append(f"{current.year}{current.month:02d}")
            # increment month safely
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)

    # ----------------------------
    # COMTRADE API LIMIT CHECK
    # ----------------------------
    if len(periods) == 0:
        raise ValueError("No periods generated")

    if len(periods) > 12:
        raise ValueError(
            f"Comtrade API limit exceeded: {len(periods)} periods requested (max 12). "
            f"Split your query into smaller date ranges."
        )
    return ",".join(periods)


period = comtrade_periods(
    args.date_start,
    args.date_end,
    freq=args.freq
)

mydf = comtradeapicall.previewFinalData(
    # ---- DATASET TYPE ----
    typeCode=args.type,
    # ---- TIME FREQUENCY ----
    freqCode=args.freq,
    # ---- PRODUCT CLASSIFICATION ----
    clCode=CLASSIFICATION_CODE,                   
    # ---- TIME PERIOD ----
    period=period,
    # ---- REPORTING COUNTRY ----
    reporterCode=args.country,
    # ---- PRODUCT / COMMODITY CODE ----
    cmdCode=args.object,
    # ---- TRADE FLOW ----
    flowCode=args.flow,
    # ---- TRADE PARTNER ----
    partnerCode=args.p1,      # None = All
    # ---- SECONDARY PARTNER ----
    partner2Code=args.p2,
    # ---- CUSTOMS PROCEDURE ----
    customsCode=None,             # customs regime filter
                                  # often unused
    # ---- MODE OF TRANSPORT ----
    motCode=None,                 # transport mode
                                  # examples: sea, air, rail, road
                                  # often unavailable/incomplete
    # ---- API OUTPUT LIMIT ----
    # maxRecords=501,
    # ---- OUTPUT FORMAT ----
    format_output=OUTPUT_FORMAT,
    # ---- AGGREGATION ----
    aggregateBy=None,             # aggregation level
                                  # None = default/raw structure
    # ---- DATA STRUCTURE ----
    breakdownMode='plus',
    # ---- COUNT ONLY ----
    countOnly=None,               # if True:
                                  # returns only number of matching rows
    # ---- HUMAN-READABLE LABELS ----
    includeDesc=False             # include descriptions:
                                  # country names, flow names, HS labels...
)
#
# reference = comtradeapicall.listReference()
#
#
# countries = reference[reference["variable"].str.contains("Partner|Reporter", case=False, na=False)]
#
# pandas.set_option("display.max_colwidth", None)
# for el in countries[["description", "fileuri"]]:
#     print(countries[el].to_string())

print(mydf.head(5))

mydf.to_csv("out.csv", index=False)
