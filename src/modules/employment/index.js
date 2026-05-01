import { renderIcon } from "../../renderer/icons.js";
import { renderSourceIndicator } from "../ui/source-indicator.js";
import { addStyleSheet } from "../../utils/css-editor.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
const EMPLOYMENT_STYLESHEET_ID = "employment";
const EMPLOYMENT_STYLESHEET_PATH = "./employment-styles.css";
const MACRO_PANELS_STYLESHEET_ID = "macro-panels";
const MACRO_PANELS_STYLESHEET_PATH = "./macro-panels.css";

let chartLibraryPromise;
const employmentStateByContainer = new WeakMap();
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

function getEmploymentState(container) {
  let state = employmentStateByContainer.get(container);
  if (state) {
    return state;
  }

  state = {
    range: "5y",
    charts: [],
  };
  employmentStateByContainer.set(container, state);
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

function formatMonth(dateString) {
  if (!dateString) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateString}T00:00:00Z`));
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
}

function formatThousands(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(0)}k`;
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
          <p class="eyebrow">Employment</p>
          <h2>Labor market monitor</h2>
        </div>
        ${iconButton({
          icon: "refreshCw",
          label: "Refresh employment data",
          dataset: 'data-action="refresh-employment"',
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
    <section class="metric-grid metric-grid-compact inflation-metric-grid">
      <article class="metric-card">
        <span>NFP</span>
        <strong>Monthly change</strong>
        <p class="inflation-metric-value">${escapeHtml(formatThousands(latest.payrollChange?.value))}</p>
        <p class="muted">${escapeHtml(formatMonth(latest.payrollChange?.time))}</p>
      </article>
      <article class="metric-card">
        <span>US labor</span>
        <strong>Unemployment</strong>
        <p class="inflation-metric-value">${escapeHtml(formatPercent(latest.unemploymentRate?.value))}</p>
        <p class="muted">${escapeHtml(formatMonth(latest.unemploymentRate?.time))}</p>
      </article>
      <article class="metric-card">
        <span>JOLTS</span>
        <strong>Openings</strong>
        <p class="inflation-metric-value">${escapeHtml(formatThousands(latest.joltsOpenings?.value))}</p>
        <p class="muted">${escapeHtml(formatMonth(latest.joltsOpenings?.time))}</p>
      </article>
    </section>
  `;
}

function mountMiniChart(rootContainer, container, seriesConfig) {
  const points = seriesConfig?.points ?? [];
  if (!points.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Chart unavailable</strong>
        <p>No points available for this series.</p>
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
      });

      const series =
        seriesConfig.type === "histogram"
          ? chart.addSeries(LightweightCharts.HistogramSeries, {
              color: seriesConfig.color,
              priceLineVisible: false,
              lastValueVisible: false,
            })
          : chart.addSeries(LightweightCharts.LineSeries, {
              color: seriesConfig.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
            });

      series.setData(points);
      const state = getEmploymentState(rootContainer);
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

async function loadEmploymentData(container, refresh = false) {
  const state = getEmploymentState(container);
  state.charts = [];
  container.innerHTML = renderEmptyState(refresh ? "Refreshing employment data..." : "Loading employment data...");

  try {
    const payload = await window.financeDesktop.getEmploymentData({ refresh, years: 12 });
    const series = payload.series ?? {};

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Employment</p>
            <h2>NFP, unemployment and JOLTS</h2>
          </div>
          <div class="inline-actions">
            ${renderSourceIndicator(payload.servedFrom, formatTimestamp(payload.lastSuccessfulRefresh))}
            ${renderRangeSelector(state.range, "employment")}
            ${iconButton({
              icon: "refreshCw",
              label: "Refresh employment data",
              dataset: 'data-action="refresh-employment"',
            })}
          </div>
        </div>

        ${renderMetricCards(payload)}
        ${renderWarningList(payload.warnings)}

        <section class="employment-chart-grid">
          ${Object.entries(series)
            .map(
              ([key, item]) => `
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
                  <div class="chart-placeholder employment-chart" data-employment-chart="${escapeHtml(key)}"></div>
                </section>
              `,
            )
            .join("")}
        </section>
      </div>
    `;

    container.querySelector('[data-action="refresh-employment"]')?.addEventListener("click", () => {
      loadEmploymentData(container, true);
    });

    container.querySelectorAll("[data-employment-range]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextRange = button.getAttribute("data-employment-range");
        if (!nextRange) {
          return;
        }
        state.range = nextRange;
        container.querySelectorAll("[data-employment-range]").forEach((item) => {
          const isActive = item.getAttribute("data-employment-range") === nextRange;
          item.classList.toggle("active", isActive);
          item.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
        for (const chart of state.charts) {
          applyRangeToChart(chart, state.range);
        }
      });
    });

    await Promise.all(
      Object.entries(series).map(async ([key, item]) => {
        const chartContainer = container.querySelector(`[data-employment-chart="${key}"]`);
        if (chartContainer) {
          await mountMiniChart(container, chartContainer, item);
        }
      }),
    );
  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Unable to load employment data.");
  }
}

export function renderEmploymentModule(container) {
  addStyleSheet(MACRO_PANELS_STYLESHEET_PATH, MACRO_PANELS_STYLESHEET_ID);
  addStyleSheet(EMPLOYMENT_STYLESHEET_PATH, EMPLOYMENT_STYLESHEET_ID);
  loadEmploymentData(container);
}
