const SAMPLE_MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<map title="US Mega Caps">
  <group label="Technology">
    <ticker symbol="AAPL" label="Apple" />
    <ticker symbol="MSFT" label="Microsoft" />
    <ticker symbol="NVDA" label="NVIDIA" />
    <ticker symbol="GOOGL" label="Alphabet" />
    <ticker symbol="META" label="Meta" />
  </group>
  <group label="Consumer">
    <ticker symbol="AMZN" label="Amazon" />
    <ticker symbol="TSLA" label="Tesla" />
    <ticker symbol="WMT" label="Walmart" />
    <ticker symbol="COST" label="Costco" />
  </group>
  <group label="Finance">
    <ticker symbol="JPM" label="JPMorgan" />
    <ticker symbol="BAC" label="Bank of America" />
    <ticker symbol="V" label="Visa" />
    <ticker symbol="MA" label="Mastercard" />
  </group>
  <group label="Healthcare">
    <ticker symbol="LLY" label="Eli Lilly" />
    <ticker symbol="JNJ" label="Johnson &amp; Johnson" />
    <ticker symbol="UNH" label="UnitedHealth" />
  </group>
</map>
`;

const WIDGET_MENU_GROUPS = [
  {
    id: "policy",
    label: "Politique monetaire",
    items: [
      {
        id: "centralBank",
        title: "Central Banks",
        description: "Fed and ECB key rates, calendar and policy path.",
      },
      {
        id: "yieldCurve",
        title: "Yield Curve",
        description: "US Treasuries 2Y, 10Y and 30Y. The 2Y/10Y inversion is a classic recession signal.",
      },
      {
        id: "fedFundsFutures",
        title: "Fed Funds Futures",
        description: "Market-implied view of what the Fed is expected to do next.",
      },
      {
        id: "balanceSheet",
        title: "Balance Sheet",
        description: "Fed and ECB balance sheet expansion or contraction for QE and QT tracking.",
      },
    ],
  },
  {
    id: "macro",
    label: "Macro reelle",
    items: [
      { id: "inflation", title: "Inflation", description: "CPI, PCE and HICP inflation tracking." },
      { id: "employment", title: "Employment", description: "NFP, unemployment and JOLTS labor market indicators." },
      { id: "growth", title: "Growth", description: "GDP, ISM and PMIs to monitor the cycle." },
      {
        id: "surpriseIndex",
        title: "Surprise Index",
        description: "Economic surprise gauge to explain market reactions versus expectations.",
      },
    ],
  },
  {
    id: "markets",
    label: "Marches financiers",
    items: [
      { id: "ticker", title: "Stock & Funds", description: "Explore Stocks and fund value over time" },
      { id: "equities", title: "Equities", description: "S&P 500, Nasdaq and Euro Stoxx 50 market dashboard." },
      { id: "fx", title: "FX", description: "DXY, EUR/USD and USD/JPY foreign-exchange monitor." },
      { id: "commodities", title: "Commodities", description: "WTI, Brent, Gold and Copper as global macro barometers." },
      {
        id: "creditSpreads",
        title: "Credit Spreads",
        description: "Investment grade versus high yield spread stress monitor.",
      },
    ],
  },
  {
    id: "risk",
    label: "Sentiment et risque",
    items: [
      {
        id: "risk",
        title: "Sentiment & Risk",
        description: "VIX, bond volatility, put/call ratio and fear versus greed.",
      },
    ],
  },
  {
    id: "correlations",
    label: "Correlations et causalite",
    items: [
      {
        id: "correlations",
        title: "Correlations Graph",
        description: "Dependency map between policy, rates, FX, gold, equities and banks.",
      },
    ],
  },
];

const DEFAULT_ENABLED_WIDGET_IDS = ["centralBank", "inflation"];

module.exports = {
  DEFAULT_ENABLED_WIDGET_IDS,
  SAMPLE_MAP_XML,
  WIDGET_MENU_GROUPS,
};
