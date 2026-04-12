const RANGE_OPTIONS = [
  { value: "1y", label: "1Y", years: 1 },
  { value: "3y", label: "3Y", years: 3 },
  { value: "5y", label: "5Y", years: 5 },
  { value: "10y", label: "10Y", years: 10 },
  { value: "all", label: "All", years: null },
];

let currentChartRange = "5y";
const registeredCharts = new Set();

function toBusinessDay(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getRangeOption(value) {
  return RANGE_OPTIONS.find((option) => option.value === value) ?? RANGE_OPTIONS[RANGE_OPTIONS.length - 1];
}

function applyChartRange(chart) {
  if (!chart?.timeScale) {
    return;
  }

  const option = getRangeOption(currentChartRange);
  if (!option.years) {
    chart.timeScale().fitContent();
    return;
  }

  const to = new Date();
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() - option.years);
  chart.timeScale().setVisibleRange({
    from: toBusinessDay(from),
    to: toBusinessDay(to),
  });
}

export function registerSharedRangeChart(chart) {
  if (!chart) {
    return chart;
  }
  registeredCharts.add(chart);
  applyChartRange(chart);
  return chart;
}

export function setSharedChartRange(value) {
  currentChartRange = getRangeOption(value).value;
  for (const chart of registeredCharts) {
    applyChartRange(chart);
  }
}

export function getSharedChartRange() {
  return currentChartRange;
}

export function getSharedChartRangeOptions() {
  return RANGE_OPTIONS;
}
