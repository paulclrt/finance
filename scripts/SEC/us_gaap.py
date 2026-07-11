"""US-GAAP taxonomy concept definitions."""

CONCEPT_MAP: dict[str, tuple[list[str], str]] = {
    # Income Statement
    "Revenue": (
        ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "Revenue", "SalesRevenueNet"],
        "Revenue",
    ),
    "CostOfRevenue": (["CostOfRevenue", "CostOfGoodsSold", "CostOfServices", "CostOfGoodsAndServicesSold"], "Cost of Revenue"),
    "GrossProfit": (["GrossProfit"], "Gross Profit"),
    "ResearchAndDevelopmentExpense": (["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcess"], "R&D Expenses"),
    "SellingGeneralAndAdministrativeExpense": (["SellingGeneralAndAdministrativeExpense", "SellingAndMarketingExpense"], "SG&A Expenses"),
    "OperatingIncomeLoss": (["OperatingIncomeLoss"], "Operating Income (Loss)"),
    "InterestExpense": (["InterestExpense", "InterestExpenseDebt"], "Interest Expense"),
    "IncomeTaxExpenseBenefit": (["IncomeTaxExpenseBenefit", "IncomeTaxes"], "Income Tax Expense"),
    "NetIncomeLoss": (["NetIncomeLoss", "NetIncome"], "Net Income"),
    "EarningsPerShareBasic": (["EarningsPerShareBasic"], "Basic EPS"),
    "EarningsPerShareDiluted": (["EarningsPerShareDiluted"], "Diluted EPS"),
    # Balance Sheet
    "CashAndCashEquivalentsAtCarryingValue": (["CashAndCashEquivalentsAtCarryingValue", "CashAndCashEquivalents"], "Cash & Equivalents"),
    "AccountsReceivableNetCurrent": (["AccountsReceivableNetCurrent", "AccountsReceivableNet"], "Accounts Receivable"),
    "InventoryNet": (["InventoryNet", "Inventory"], "Inventory"),
    "AssetsCurrent": (["AssetsCurrent"], "Current Assets"),
    "Assets": (["Assets"], "Total Assets"),
    "LiabilitiesCurrent": (["LiabilitiesCurrent"], "Current Liabilities"),
    "Liabilities": (["Liabilities"], "Total Liabilities"),
    "LongTermDebtNoncurrent": (["LongTermDebtNoncurrent", "LongTermDebt"], "Long-Term Debt"),
    "StockholdersEquity": (
        ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
        "Total Equity",
    ),
    # Cash Flow
    "NetCashProvidedByUsedInOperatingActivities": (["NetCashProvidedByUsedInOperatingActivities"], "Operating Cash Flow"),
    "NetCashProvidedByUsedInInvestingActivities": (["NetCashProvidedByUsedInInvestingActivities"], "Investing Cash Flow"),
    "NetCashProvidedByUsedInFinancingActivities": (["NetCashProvidedByUsedInFinancingActivities"], "Financing Cash Flow"),
    # CapEx (used for Free Cash Flow)
    "PaymentsToAcquirePropertyPlantAndEquipment": (["PaymentsToAcquirePropertyPlantAndEquipment"], "CapEx"),
}

INCOME_KEYS = [
    "Revenue",
    "CostOfRevenue",
    "GrossProfit",
    "ResearchAndDevelopmentExpense",
    "SellingGeneralAndAdministrativeExpense",
    "OperatingIncomeLoss",
    "InterestExpense",
    "IncomeTaxExpenseBenefit",
    "NetIncomeLoss",
    "EarningsPerShareBasic",
    "EarningsPerShareDiluted",
]

BALANCE_KEYS = [
    "CashAndCashEquivalentsAtCarryingValue",
    "AccountsReceivableNetCurrent",
    "InventoryNet",
    "AssetsCurrent",
    "Assets",
    "LiabilitiesCurrent",
    "Liabilities",
    "LongTermDebtNoncurrent",
    "StockholdersEquity",
]

CASHFLOW_KEYS = [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInInvestingActivities",
    "NetCashProvidedByUsedInFinancingActivities",
]

TAXONOMY = "us-gaap"
CURRENCY = "USD"
