"""IFRS taxonomy concept definitions."""

CONCEPT_MAP: dict[str, tuple[list[str], str]] = {
    # Income Statement
    "Revenue": (["Revenue"], "Revenue"),
    "CostOfRevenue": (["CostOfSales"], "Cost of Revenue"),
    "GrossProfit": (["GrossProfit"], "Gross Profit"),
    "ResearchAndDevelopmentExpense": (["ResearchAndDevelopmentExpense"], "R&D Expenses"),
    "SellingGeneralAndAdministrativeExpense": (["SalesAndMarketingExpense", "AdministrativeExpense"], "SG&A Expenses"),
    "OperatingIncomeLoss": (["ProfitLossFromOperatingActivities", "OperatingIncomeLoss"], "Operating Income (Loss)"),
    "InterestExpense": (["FinanceCosts", "InterestExpense"], "Interest Expense"),
    "IncomeTaxExpenseBenefit": (["IncomeTaxExpenseContinuingOperations", "IncomeTaxExpense"], "Income Tax Expense"),
    "NetIncomeLoss": (["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"], "Net Income"),
    "EarningsPerShareBasic": (["BasicEarningsLossPerShare"], "Basic EPS"),
    "EarningsPerShareDiluted": (["DilutedEarningsLossPerShare"], "Diluted EPS"),
    # Balance Sheet
    "CashAndCashEquivalentsAtCarryingValue": (["CashAndCashEquivalents"], "Cash & Equivalents"),
    "AccountsReceivableNetCurrent": (["TradeAndOtherCurrentReceivables", "TradeReceivables"], "Accounts Receivable"),
    "InventoryNet": (["Inventories"], "Inventory"),
    "AssetsCurrent": (["CurrentAssets"], "Current Assets"),
    "Assets": (["Assets"], "Total Assets"),
    "LiabilitiesCurrent": (["CurrentLiabilities"], "Current Liabilities"),
    "Liabilities": (["Liabilities"], "Total Liabilities"),
    "LongTermDebtNoncurrent": (["LongtermBorrowings", "LongTermBorrowings"], "Long-Term Debt"),
    "StockholdersEquity": (["Equity", "EquityAttributableToOwnersOfParent"], "Total Equity"),
    # Cash Flow
    "NetCashProvidedByUsedInOperatingActivities": (["CashFlowsFromUsedInOperatingActivities"], "Operating Cash Flow"),
    "NetCashProvidedByUsedInInvestingActivities": (["CashFlowsFromUsedInInvestingActivities"], "Investing Cash Flow"),
    "NetCashProvidedByUsedInFinancingActivities": (["CashFlowsFromUsedInFinancingActivities"], "Financing Cash Flow"),
    # CapEx (used for Free Cash Flow)
    "PaymentsToAcquirePropertyPlantAndEquipment": (
        ["PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets",
         "PaymentsToAcquirePropertyPlantAndEquipment",
         "AdditionsOtherThanThroughBusinessCombinationsPropertyPlantAndEquipment"],
        "CapEx",
    ),
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

TAXONOMY = "ifrs-full"
CURRENCY = "EUR"
