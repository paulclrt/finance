export const widgetCatalog = [
  {
    id: "centralBank",
    title: "Central Banks",
    categoryId: "policy",
    categoryLabel: "Politique monetaire",
    description: "Fed and ECB key rates, calendar and policy path.",
    implemented: true,
  },
  {
    id: "yieldCurve",
    title: "Yield Curve",
    categoryId: "policy",
    categoryLabel: "Politique monetaire",
    description: "US Treasuries 2Y, 10Y and 30Y. The 2Y/10Y inversion is a classic recession signal.",
    implemented: false,
  },
  {
    id: "fedFundsFutures",
    title: "Fed Funds Futures",
    categoryId: "policy",
    categoryLabel: "Politique monetaire",
    description: "Market-implied view of what the Fed is expected to do next.",
    implemented: false,
  },
  {
    id: "balanceSheet",
    title: "Balance Sheet",
    categoryId: "policy",
    categoryLabel: "Politique monetaire",
    description: "Fed and ECB balance sheet expansion or contraction for QE and QT tracking.",
    implemented: false,
  },
  {
    id: "inflation",
    title: "Inflation",
    categoryId: "macro",
    categoryLabel: "Macro reelle",
    description: "CPI, PCE and HICP inflation tracking.",
    implemented: true,
  },
  {
    id: "employment",
    title: "Employment",
    categoryId: "macro",
    categoryLabel: "Macro reelle",
    description: "NFP, unemployment and JOLTS labor market indicators.",
    implemented: true,
  },
  {
    id: "growth",
    title: "Growth",
    categoryId: "macro",
    categoryLabel: "Macro reelle",
    description: "GDP, ISM and PMIs to monitor the cycle.",
    implemented: true,
  },
  {
    id: "surpriseIndex",
    title: "Surprise Index",
    categoryId: "macro",
    categoryLabel: "Macro reelle",
    description: "Economic surprise gauge to explain market reactions versus expectations.",
    implemented: false,
  },
  {
    id: "ticker",
    title: "Stock Ticker",
    categoryId: "markets",
    categoryLabel: "Marches financiers",
    description: "Rechercher et afficher n'importe quel action avec graphique historique.",
    implemented: true,
  },
  {
    id: "equities",
    title: "Equities",
    categoryId: "markets",
    categoryLabel: "Marches financiers",
    description: "S&P 500, Nasdaq and Euro Stoxx 50 market dashboard.",
    implemented: false,
  },
  {
    id: "fx",
    title: "FX",
    categoryId: "markets",
    categoryLabel: "Marches financiers",
    description: "DXY, EUR/USD and USD/JPY foreign-exchange monitor.",
    implemented: false,
  },
  {
    id: "commodities",
    title: "Commodities",
    categoryId: "markets",
    categoryLabel: "Marches financiers",
    description: "WTI, Brent, Gold and Copper as global macro barometers.",
    implemented: false,
  },
  {
    id: "creditSpreads",
    title: "Credit Spreads",
    categoryId: "markets",
    categoryLabel: "Marches financiers",
    description: "Investment grade versus high yield spread stress monitor.",
    implemented: false,
  },
  {
    id: "risk",
    title: "Sentiment & Risk",
    categoryId: "risk",
    categoryLabel: "Sentiment et risque",
    description: "VIX, bond volatility, put/call ratio and fear versus greed.",
    implemented: false,
  },
  {
    id: "correlations",
    title: "Correlations Graph",
    categoryId: "correlations",
    categoryLabel: "Correlations et causalite",
    description: "Dependency map between policy, rates, FX, gold, equities and banks.",
    implemented: false,
  },
];

export const defaultEnabledWidgetIds = ["centralBank", "inflation"];

export const visiblePaneOrder = ["main", "rightTop", "rightBottom"];

export function getWidgetById(widgetId) {
  return widgetCatalog.find((widget) => widget.id === widgetId) ?? null;
}

export function getCatalogGroupedByCategory() {
  const groups = [];

  for (const widget of widgetCatalog) {
    let group = groups.find((item) => item.id === widget.categoryId);
    if (!group) {
      group = {
        id: widget.categoryId,
        label: widget.categoryLabel,
        items: [],
      };
      groups.push(group);
    }

    group.items.push(widget);
  }

  return groups;
}
