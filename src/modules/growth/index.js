import { renderIcon } from "../../renderer/icons.js";
import { renderSourceIndicator } from "../ui/source-indicator.js";
import { addStyleSheet } from "../../utils/css-editor.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
const GROWTH_STYLESHEET_ID = "growth";
const GROWTH_STYLESHEET_PATH = "./styles.css";
const MACRO_PANELS_STYLESHEET_ID = "macro-panels";
const MACRO_PANELS_STYLESHEET_PATH = "../macro/styles.css";

let chartLibraryPromise;
const growthStateByContainer = new WeakMap();
const RANGE_OPTIONS = [
  { value: "1y", label: "1Y", years: 1 },
  { value: "3y", label: "3Y", years: 3 },
  { value: "5y", label: "5Y", years: 5 },
  { value: "10y", label: "10Y", years: 10 },
  { value: "all", label: "All", years: null },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function getGrowthState(container) {
  let state = growthStateByContainer.get(container);
  if (state) {
    return state;
  }

  state = {
    range: "5y",
    charts: [],
  };
  growthStateByContainer.set(container, state);
  return state;
}

function toBusinessDay(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function applyRangeToChart(chart, range) {
  const option = RANGE_OPTIONS.find((item) => item.value === range) ?? RANGE_OPTIONS[2];
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

function renderRangeSelector(selected, datasetKey) {
  return `
    <div class="module-range-selector" role="tablist" aria-label="Chart range">
      ${RANGE_OPTIONS.map(
        (option) => `
          <button
            class="module-range-option ${option.value === selected ? "active" : ""}"
            type="button"
            data-${datasetKey}-range="${escapeHtml(option.value)}"
            aria-pressed="${option.value === selected ? "true" : "false"}"
          >
            ${escapeHtml(option.label)}
          </button>
        `,
      ).join("")}
    </div>
  `;
}

function loadChartLibrary() {
  if (window.LightweightCharts) {
    return Promise.resolve(window.LightweightCharts);
  }

  if (!chartLibraryPromise) {
    chartLibraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-lightweight-charts]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.LightweightCharts), { once: true });
        existing.addEventListener("error", () => reject(new Error("Chart library failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = CHART_LIBRARY_URL;
      script.async = true;
      script.dataset.lightweightCharts = "true";
      script.onload = () => resolve(window.LightweightCharts);
      script.onerror = () => reject(new Error("Chart library failed to load."));
      document.head.append(script);
    });
  }

  return chartLibraryPromise;
}

function iconButton({ icon, label, dataset = "", href = "" }) {
  if (href) {
    return `
      <a class="icon-button" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        ${renderIcon(icon)}
      </a>
    `;
  }

  return `
    <button class="icon-button" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${dataset}>
      ${renderIcon(icon)}
    </button>
  `;
}

function formatTimestamp(dateString) {
  if (!dateString) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatQuarter(dateString) {
  if (!dateString) {
    return "Unknown";
  }
  const date = new Date(`${dateString}T00:00:00Z`);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
}

function formatIndex(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(1);
}

function renderWarningList(warnings) {
  if (!warnings?.length) {
    return "";
  }
  return `
    <section class="status-note warning-note">
      ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
    </section>
  `;
}

function renderEmptyState(message) {
  return `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Growth</p>
          <h2>GDP and activity monitor</h2>
        </div>
        ${iconButton({
          icon: "refreshCw",
          label: "Refresh growth data",
          dataset: 'data-action="refresh-growth"',
        })}
      </div>
      <section class="status-note empty-state">
        <p>${escapeHtml(message)}</p>
      </section>
    </div>
  `;
}

function renderMetricCards(payload) {
  const latest = payload.latest ?? {};
  return `
    <section class="metric-grid metric-grid-compact inflation-metric-grid growth-metric-grid">
      <article class="metric-card">
        <span>GDP</span>
        <strong>QoQ annualized</strong>
        <p class="inflation-metric-value">${escapeHtml(formatPercent(latest.gdpQoq?.value))}</p>
        <p class="muted">${escapeHtml(formatQuarter(latest.gdpQoq?.time))}</p>
      </article>
      <article class="metric-card">
        <span>GDP</span>
        <strong>YoY growth</strong>
        <p class="inflation-metric-value">${escapeHtml(formatPercent(latest.gdpYoy?.value))}</p>
        <p class="muted">${escapeHtml(formatQuarter(latest.gdpYoy?.time))}</p>
      </article>
      <article class="metric-card">
        <span>Atlanta Fed</span>
        <strong>GDPNow</strong>
        <p class="inflation-metric-value">${escapeHtml(formatPercent(latest.gdpNow?.value))}</p>
        <p class="muted">${escapeHtml(formatQuarter(latest.gdpNow?.time))}</p>
      </article>
      <article class="metric-card">
        <span>Activity</span>
        <strong>CFNAI</strong>
        <p class="inflation-metric-value">${escapeHtml(formatIndex(latest.activity?.value))}</p>
        <p class="muted">${escapeHtml(latest.activity?.time || "Unknown")}</p>
      </article>
      <article class="metric-card">
        <span>Manufacturing</span>
        <strong>Industrial production</strong>
        <p class="inflation-metric-value">${escapeHtml(formatIndex(latest.manufacturingProxy?.value))}</p>
        <p class="muted">${escapeHtml(latest.manufacturingProxy?.time || "Unavailable")}</p>
      </article>
    </section>
  `;
}

function mountLineChart(rootContainer, container, seriesList, formatter = (value) => value.toFixed(1)) {
  const usableSeries = seriesList.filter((series) => series.points?.length);
  if (!usableSeries.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Chart unavailable</strong>
        <p>No points available for this chart.</p>
      </div>
    `;
    return Promise.resolve();
  }

  return loadChartLibrary()
    .then((LightweightCharts) => {
      const chart = LightweightCharts.createChart(container, {
        autoSize: true,
        layout: {
          background: { color: "transparent" },
          textColor: "#667085",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "#eef2f6" },
          horzLines: { color: "#eef2f6" },
        },
        timeScale: {
          borderColor: "#e5e7eb",
          timeVisible: false,
        },
        rightPriceScale: {
          borderColor: "#e5e7eb",
          scaleMargins: { top: 0.14, bottom: 0.14 },
        },
        localization: {
          priceFormatter: formatter,
        },
      });

      for (const item of usableSeries) {
        const series = chart.addSeries(LightweightCharts.LineSeries, {
          color: item.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        series.setData(item.points);
      }

      const state = getGrowthState(rootContainer);
      state.charts.push(chart);
      applyRangeToChart(chart, state.range);
    })
    .catch((error) => {
      container.innerHTML = `
        <div class="chart-fallback">
          <strong>Chart unavailable</strong>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    });
}

async function loadGrowthData(container, refresh = false) {
  const state = getGrowthState(container);
  state.charts = [];
  container.innerHTML = renderEmptyState(refresh ? "Refreshing growth data..." : "Loading growth data...");

  try {
    const payload = await window.financeDesktop.getGrowthData({ refresh, years: 15 });
    const series = payload.series ?? {};

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Growth</p>
            <h2>GDP and activity monitor</h2>
          </div>
          <div class="inline-actions">
            ${renderSourceIndicator(payload.servedFrom, formatTimestamp(payload.lastSuccessfulRefresh))}
            ${renderRangeSelector(state.range, "growth")}
            ${iconButton({
              icon: "refreshCw",
              label: "Refresh growth data",
              dataset: 'data-action="refresh-growth"',
            })}
          </div>
        </div>

        ${renderMetricCards(payload)}
        ${renderWarningList(payload.warnings)}

        <section class="chart-shell">
          <div class="chart-header">
            <div>
              <p class="eyebrow">GDP</p>
              <h3>QoQ vs YoY</h3>
            </div>
            <div class="chart-legend">
              <span><i class="legend-dot" style="background: #2563eb"></i> GDP QoQ</span>
              <span><i class="legend-dot" style="background: #0f766e"></i> GDP YoY</span>
            </div>
          </div>
          <div class="chart-placeholder growth-chart" data-growth-chart="gdp"></div>
        </section>

        <section class="growth-chart-grid">
          ${["gdpNow", "activity", "manufacturingProxy"]
            .map((key) => series[key])
            .filter(Boolean)
            .map(
              (item) => `
                <section class="chart-shell">
                  <div class="chart-header">
                    <div>
                      <p class="eyebrow">${escapeHtml(item.unit || "series")}</p>
                      <h3>${escapeHtml(item.label)}</h3>
                    </div>
                    ${iconButton({
                      icon: "externalLink",
                      label: `Open ${item.label} source`,
                      href: item.sourceUrl,
                    })}
                  </div>
                  <div class="chart-placeholder growth-chart growth-chart-small" data-growth-mini-chart="${escapeHtml(item.label)}"></div>
                </section>
              `,
            )
            .join("")}
        </section>
      </div>
    `;

    container.querySelector('[data-action="refresh-growth"]')?.addEventListener("click", () => {
      loadGrowthData(container, true);
    });

    container.querySelectorAll("[data-growth-range]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextRange = button.getAttribute("data-growth-range");
        if (!nextRange) {
          return;
        }
        state.range = nextRange;
        container.querySelectorAll("[data-growth-range]").forEach((item) => {
          const isActive = item.getAttribute("data-growth-range") === nextRange;
          item.classList.toggle("active", isActive);
          item.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
        for (const chart of state.charts) {
          applyRangeToChart(chart, state.range);
        }
      });
    });

    const mainChart = container.querySelector('[data-growth-chart="gdp"]');
    if (mainChart) {
      await mountLineChart(container, mainChart, [series.gdpQoq, series.gdpYoy], (value) => `${value.toFixed(1)}%`);
    }

    await Promise.all(
      ["gdpNow", "activity", "manufacturingProxy"].map(async (key) => {
        const chartContainer = container.querySelector(`[data-growth-mini-chart="${series[key]?.label}"]`);
        if (chartContainer && series[key]) {
          await mountLineChart(container, chartContainer, [series[key]], (value) => value.toFixed(1));
        }
      }),
    );
  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Unable to load growth data.");
  }
}

export function renderGrowthModule(container) {
  addStyleSheet(MACRO_PANELS_STYLESHEET_PATH, MACRO_PANELS_STYLESHEET_ID, import.meta.url);
  addStyleSheet(GROWTH_STYLESHEET_PATH, GROWTH_STYLESHEET_ID, import.meta.url);
  loadGrowthData(container);
}
