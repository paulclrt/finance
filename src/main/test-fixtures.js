const FIXTURE_TIMESTAMP = "2026-04-30T12:00:00.000Z";

function buildTickerHistory(basePrice, dates) {
  return dates.map((date, index) => {
    const close = Number((basePrice + index * 1.75).toFixed(2));
    return {
      Date: `${date}T00:00:00.000Z`,
      Open: Number((close - 0.8).toFixed(2)),
      High: Number((close + 1.2).toFixed(2)),
      Low: Number((close - 1.4).toFixed(2)),
      Close: close,
    };
  });
}

function buildTickerInfo(symbol) {
  const upperSymbol = String(symbol || "AAPL").toUpperCase();

  if (upperSymbol === "MSFT") {
    return {
      longName: "Microsoft Corporation",
      shortName: "Microsoft",
      currency: "USD",
      quoteType: "EQUITY",
      longBusinessSummary: "Microsoft develops and licenses consumer and enterprise software products and cloud services.",
    };
  }

  if (upperSymbol === "EURUSD=X") {
    return {
      longName: "EUR/USD",
      shortName: "EUR/USD",
      currency: "USD",
      quoteType: "CURRENCY",
      longBusinessSummary: "Synthetic FX fixture payload for deterministic desktop end-to-end tests.",
    };
  }

  if (upperSymbol === "DX-Y.NYB") {
    return {
      longName: "US Dollar Index",
      shortName: "DXY",
      currency: "USD",
      quoteType: "INDEX",
      longBusinessSummary: "Synthetic US Dollar Index fixture payload for deterministic desktop end-to-end tests.",
    };
  }

  if (upperSymbol === "GC=F") {
    return {
      longName: "Gold Futures",
      shortName: "Gold",
      currency: "USD",
      quoteType: "FUTURE",
      longBusinessSummary: "Synthetic commodities fixture payload for deterministic desktop end-to-end tests.",
    };
  }

  return {
    longName: "Apple Inc.",
    shortName: "Apple",
    currency: "USD",
    quoteType: "EQUITY",
    longBusinessSummary: "Apple designs consumer electronics and software products for a global audience.",
  };
}

function buildTickerPayload(symbol = "AAPL", duration = "1mo") {
  const upperSymbol = String(symbol || "AAPL").toUpperCase();
  const history = buildTickerHistory(
    upperSymbol === "MSFT" ? 410 : upperSymbol === "EURUSD=X" ? 1.08 : upperSymbol === "DX-Y.NYB" ? 104.25 : upperSymbol === "GC=F" ? 2310 : 188,
    ["2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-04-29"]
  );

  return {
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    meta: {
      ticker: upperSymbol,
      fetchedAt: FIXTURE_TIMESTAMP,
      duration,
    },
    data: {
      info: buildTickerInfo(upperSymbol),
      history,
      calendar: [],
      analyst_price_targets: [],
      quarterly_income_stmt: [],
      options: [],
      description: buildTickerInfo(upperSymbol).longBusinessSummary,
      top_holdings: null,
    },
  };
}

function getCentralBankPayload() {
  return {
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    warnings: [],
    events: [
      {
        bank: "Fed",
        title: "FOMC announcement",
        date: "2099-06-17",
        location: "Washington, D.C.",
        details: "Regularly scheduled FOMC meeting end date.",
        sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      },
      {
        bank: "ECB",
        title: "Monetary policy meeting",
        date: "2099-06-18",
        location: "Frankfurt",
        details: "ECB Governing Council monetary policy meeting.",
        sourceUrl: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
      },
    ],
    currentFedRates: {
      targetLowerBound: 4.25,
      targetUpperBound: 4.5,
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
    },
    currentEcbRates: {
      depositFacility: 3.75,
      mainRefinancingOperations: 4.0,
      marginalLendingFacility: 4.25,
      sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
    },
    fedRatesHistory: [
      { effectiveDate: "2026-01-01", midpoint: 4.5 },
      { effectiveDate: "2026-03-01", midpoint: 4.375 },
      { effectiveDate: "2026-05-01", midpoint: 4.375 },
    ],
    ecbRatesHistory: [
      {
        effectiveDate: "2026-01-01",
        depositFacility: 4.0,
        mainRefinancingOperations: 4.25,
        marginalLendingFacility: 4.5,
      },
      {
        effectiveDate: "2026-03-01",
        depositFacility: 3.75,
        mainRefinancingOperations: 4.0,
        marginalLendingFacility: 4.25,
      },
    ],
  };
}

function getInflationPayload() {
  return {
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    warnings: [],
    latest: [
      { id: "usCpi", label: "US CPI", region: "US", latestPoint: { time: "2026-03-01", value: 2.9 } },
      { id: "usPce", label: "US PCE", region: "US", latestPoint: { time: "2026-03-01", value: 2.6 } },
      { id: "euHicp", label: "EU HICP", region: "EU", latestPoint: { time: "2026-03-01", value: 2.4 } },
    ],
    series: [
      {
        id: "usCpi",
        label: "US CPI",
        region: "US",
        sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
        color: "#2563eb",
        points: [
          { time: "2025-11-01", value: 3.2 },
          { time: "2026-01-01", value: 3.0 },
          { time: "2026-03-01", value: 2.9 },
        ],
      },
      {
        id: "usPce",
        label: "US PCE",
        region: "US",
        sourceUrl: "https://fred.stlouisfed.org/series/PCEPI",
        color: "#0f766e",
        points: [
          { time: "2025-11-01", value: 2.9 },
          { time: "2026-01-01", value: 2.7 },
          { time: "2026-03-01", value: 2.6 },
        ],
      },
      {
        id: "euHicp",
        label: "EU HICP",
        region: "EU",
        sourceUrl: "https://data.ecb.europa.eu/",
        color: "#f59e0b",
        points: [
          { time: "2025-11-01", value: 2.7 },
          { time: "2026-01-01", value: 2.5 },
          { time: "2026-03-01", value: 2.4 },
        ],
      },
    ],
  };
}

function getEmploymentPayload() {
  return {
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    warnings: [],
    latest: {
      payrollChange: { time: "2026-03-01", value: 215 },
      unemploymentRate: { time: "2026-03-01", value: 4.1 },
      joltsOpenings: { time: "2026-03-01", value: 8200 },
    },
    series: {
      payrollChange: {
        label: "Payroll change",
        unit: "k jobs",
        type: "histogram",
        color: "#2563eb",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2025-11-01", value: 185 },
          { time: "2026-01-01", value: 201 },
          { time: "2026-03-01", value: 215 },
        ],
      },
      unemploymentRate: {
        label: "Unemployment rate",
        unit: "%",
        type: "line",
        color: "#0f766e",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2025-11-01", value: 4.3 },
          { time: "2026-01-01", value: 4.2 },
          { time: "2026-03-01", value: 4.1 },
        ],
      },
      joltsOpenings: {
        label: "JOLTS openings",
        unit: "k openings",
        type: "line",
        color: "#f59e0b",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2025-11-01", value: 7900 },
          { time: "2026-01-01", value: 8040 },
          { time: "2026-03-01", value: 8200 },
        ],
      },
    },
  };
}

function getGrowthPayload() {
  return {
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    warnings: [],
    latest: {
      gdpQoq: { time: "2026-03-31", value: 1.8 },
      gdpYoy: { time: "2026-03-31", value: 2.3 },
      gdpNow: { time: "2026-03-31", value: 2.1 },
      activity: { time: "2026-03", value: 0.15 },
      manufacturingProxy: { time: "2026-03", value: 101.2 },
    },
    series: {
      gdpQoq: {
        label: "GDP QoQ",
        unit: "%",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2025-09-30", value: 1.2 },
          { time: "2025-12-31", value: 1.5 },
          { time: "2026-03-31", value: 1.8 },
        ],
      },
      gdpYoy: {
        label: "GDP YoY",
        unit: "%",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2025-09-30", value: 2.0 },
          { time: "2025-12-31", value: 2.1 },
          { time: "2026-03-31", value: 2.3 },
        ],
      },
      gdpNow: {
        label: "GDPNow",
        unit: "%",
        sourceUrl: "https://www.atlantafed.org/cqer/research/gdpnow",
        points: [
          { time: "2026-01-15", value: 1.4 },
          { time: "2026-02-15", value: 1.7 },
          { time: "2026-03-15", value: 2.1 },
        ],
      },
      activity: {
        label: "CFNAI",
        unit: "index",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2026-01-01", value: 0.02 },
          { time: "2026-02-01", value: 0.1 },
          { time: "2026-03-01", value: 0.15 },
        ],
      },
      manufacturingProxy: {
        label: "Industrial production",
        unit: "index",
        sourceUrl: "https://fred.stlouisfed.org/",
        points: [
          { time: "2026-01-01", value: 100.2 },
          { time: "2026-02-01", value: 100.8 },
          { time: "2026-03-01", value: 101.2 },
        ],
      },
    },
  };
}

function getRiskPayload() {
  return {
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    warnings: [],
    indicators: [
      { id: "vix", label: "VIX", signal: "Fear", subtitle: "Equity volatility", displayValue: "21.40", value: 21.4, asOf: "2026-04-30" },
      { id: "moveProxy", label: "MOVE proxy", signal: "Neutral", subtitle: "Treasury volatility", displayValue: "96.20", value: 96.2, asOf: "2026-04-30" },
      { id: "putCall", label: "Put/Call", signal: "Defensive", subtitle: "Options hedging demand", displayValue: "0.92", value: 0.92, asOf: "2026-04-30" },
      { id: "fearGreed", label: "CNN Fear & Greed", signal: "Greed", subtitle: "Composite sentiment", displayValue: "68", value: 68, asOf: "2026-04-30" },
    ],
    chartSeries: [
      {
        id: "vix",
        label: "VIX",
        color: "#2563eb",
        valueSuffix: "",
        points: [
          { time: "2026-04-01", value: 24.5 },
          { time: "2026-04-15", value: 22.1 },
          { time: "2026-04-30", value: 21.4 },
        ],
      },
      {
        id: "fearGreed",
        label: "Fear & Greed",
        color: "#f59e0b",
        valueSuffix: "",
        points: [
          { time: "2026-04-01", value: 41 },
          { time: "2026-04-15", value: 57 },
          { time: "2026-04-30", value: 68 },
        ],
      },
    ],
    sources: [
      { label: "FRED VIX", url: "https://fred.stlouisfed.org/series/VIXCLS" },
      { label: "CNN Fear & Greed", url: "https://edition.cnn.com/markets/fear-and-greed" },
    ],
  };
}

function getMapConfigs() {
  return {
    selectedFile: "us-mega-caps.xml",
    groups: {
      default: [
        {
          id: "us-mega-caps.xml",
          fileName: "us-mega-caps.xml",
          title: "US Mega Caps",
          path: "/test/us-mega-caps.xml",
          exists: true,
          group: "default",
        },
      ],
      custom: [],
    },
  };
}

function getMapPayload(duration = "5d") {
  return {
    title: "US Mega Caps",
    duration,
    generatedAt: FIXTURE_TIMESTAMP,
    symbolCount: 6,
    servedFrom: "cache",
    lastSuccessfulRefresh: FIXTURE_TIMESTAMP,
    tree: {
      type: "group",
      label: "US Mega Caps",
      children: [
        {
          type: "group",
          label: "Technology",
          children: [
            { type: "ticker", label: "Apple", symbol: "AAPL", marketCap: 3200000000000, quoteType: "EQUITY", changePercent: 1.8, lastPrice: 188.63, currency: "USD", servedFrom: "cache", lastSuccessfulRefresh: FIXTURE_TIMESTAMP },
            { type: "ticker", label: "Microsoft", symbol: "MSFT", marketCap: 3050000000000, quoteType: "EQUITY", changePercent: 2.1, lastPrice: 421.15, currency: "USD", servedFrom: "cache", lastSuccessfulRefresh: FIXTURE_TIMESTAMP },
            { type: "ticker", label: "NVIDIA", symbol: "NVDA", marketCap: 2700000000000, quoteType: "EQUITY", changePercent: 3.5, lastPrice: 920.45, currency: "USD", servedFrom: "cache", lastSuccessfulRefresh: FIXTURE_TIMESTAMP },
          ],
        },
        {
          type: "group",
          label: "Finance",
          children: [
            { type: "ticker", label: "JPMorgan", symbol: "JPM", marketCap: 580000000000, quoteType: "EQUITY", changePercent: -0.8, lastPrice: 198.17, currency: "USD", servedFrom: "cache", lastSuccessfulRefresh: FIXTURE_TIMESTAMP },
            { type: "ticker", label: "Visa", symbol: "V", marketCap: 520000000000, quoteType: "EQUITY", changePercent: 0.6, lastPrice: 284.26, currency: "USD", servedFrom: "cache", lastSuccessfulRefresh: FIXTURE_TIMESTAMP },
            { type: "ticker", label: "Mastercard", symbol: "MA", marketCap: 470000000000, quoteType: "EQUITY", changePercent: 0.9, lastPrice: 462.89, currency: "USD", servedFrom: "cache", lastSuccessfulRefresh: FIXTURE_TIMESTAMP },
          ],
        },
      ],
    },
  };
}

module.exports = {
  FIXTURE_TIMESTAMP,
  buildTickerPayload,
  getCentralBankPayload,
  getInflationPayload,
  getEmploymentPayload,
  getGrowthPayload,
  getRiskPayload,
  getMapConfigs,
  getMapPayload,
};
