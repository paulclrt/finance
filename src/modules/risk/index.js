import { renderIcon } from "../../renderer/icons.js";
import { renderSourceIndicator } from "../ui/source-indicator.js";
import { addStyleSheet } from "../../utils/css-editor.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
const RISK_STYLESHEET_ID = "risk";
const RISK_STYLESHEET_PATH = "./styles.css";

let chartLibraryPromise;
let selectedChartId = "vix";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
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

function iconButton({ icon, label, dataset = "" }) {
  return `
    <button class="icon-button" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${dataset}>
      ${renderIcon(icon)}
    </button>
  `;
}

function formatValue(value, decimals = 2, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(decimals)}${suffix}`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }
  if (/^\d{2}:\d{2}\s+[AP]M$/.test(value)) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
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

function renderSignalTone(signal) {
  const normalized = String(signal || "").toLowerCase();
  if (["stress", "extreme fear", "fear", "defensive"].includes(normalized)) {
    return "risk-negative";
  }
  if (["greed", "extreme greed", "complacency", "complacent"].includes(normalized)) {
    return "risk-positive";
  }
  return "risk-neutral";
}

function getIndicatorScale(indicator) {
  switch (indicator.id) {
    case "vix":
      return { min: 0, max: 50 };
    case "moveProxy":
      return { min: 40, max: 200 };
    case "putCall":
      return { min: 0.4, max: 1.4 };
    case "fearGreed":
      return { min: 0, max: 100 };
    default:
      return { min: 0, max: 100 };
  }
}

function getIndicatorDescription(indicator) {
  switch (indicator.id) {
    case "vix":
      return "Implied S&P 500 volatility. Above 30 usually signals stress, below 15 often signals complacency.";
    case "moveProxy":
      return "Treasury volatility proxy built from FRED 2Y, 10Y and 30Y yield moves. Higher means more bond-market stress.";
    case "putCall":
      return "Cboe total options put/call ratio. Higher means more demand for downside protection.";
    case "fearGreed":
      return "CNN sentiment composite from several market internals. Low means fear, high means greed.";
    default:
      return indicator.subtitle || "";
  }
}

function getGaugePercent(indicator) {
  if (typeof indicator.value !== "number" || Number.isNaN(indicator.value)) {
    return 0;
  }

  const { min, max } = getIndicatorScale(indicator);
  const rawPercent = ((indicator.value - min) / (max - min)) * 100;
  return Math.min(Math.max(rawPercent, 0), 100);
}

function renderIndicatorCard(indicator) {
  const gaugePercent = getGaugePercent(indicator);
  const toneClass = renderSignalTone(indicator.signal);
  const description = getIndicatorDescription(indicator);
  return `
    <article class="metric-card risk-card" title="${escapeHtml(description)}">
      <div class="risk-card-head">
        <span>${escapeHtml(indicator.label)}</span>
        <i class="risk-chip ${toneClass}">${escapeHtml(indicator.signal)}</i>
      </div>
      <strong class="risk-card-value">${escapeHtml(indicator.displayValue)}</strong>
      <div class="risk-gauge" aria-hidden="true">
        <div class="risk-gauge-track">
          <div class="risk-gauge-fill ${toneClass}" style="width: ${gaugePercent}%"></div>
        </div>
      </div>
      <p class="muted">${escapeHtml(indicator.subtitle)}</p>
      <p class="muted">${escapeHtml(formatDate(indicator.asOf))}</p>
    </article>
  `;
}

function renderEmptyState(message) {
  return `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Risk</p>
          <h2>Stress monitor</h2>
        </div>
      </div>
      <section class="status-note empty-state">
        <p>${escapeHtml(message)}</p>
      </section>
    </div>
  `;
}

function renderChartControls(chartSeries) {
  return `
    <div class="risk-chart-controls">
      ${chartSeries
        .map(
          (item) => `
            <button class="risk-chart-tab ${item.id === selectedChartId ? "active" : ""}" type="button" data-chart-id="${escapeHtml(item.id)}">
              ${escapeHtml(item.label)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function mountChart(container, series) {
  if (!series?.points?.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Series unavailable</strong>
        <p>No chart data is available for this risk series.</p>
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
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        localization: {
          priceFormatter: (value) => formatValue(value, 2, series.valueSuffix || ""),
        },
      });

      const lineSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: series.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      lineSeries.setData(series.points);
      chart.timeScale().fitContent();
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

async function loadRiskData(container, refresh = false) {
  container.innerHTML = renderEmptyState(refresh ? "Refreshing risk data..." : "Loading risk data...");

  try {
    const payload = await window.financeDesktop.getRiskData({ refresh, years: 5 });
    const chartSeries = payload.chartSeries ?? [];
    const activeSeries = chartSeries.find((item) => item.id === selectedChartId) ?? chartSeries[0] ?? null;
    if (activeSeries) {
      selectedChartId = activeSeries.id;
    }

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Risk</p>
            <h2>Stress monitor</h2>
          </div>
          <div class="inline-actions">
            ${renderSourceIndicator(payload.servedFrom, formatTimestamp(payload.lastSuccessfulRefresh))}
            ${iconButton({
              icon: "refreshCw",
              label: "Refresh risk data",
              dataset: 'data-action="refresh-risk"',
            })}
          </div>
        </div>

        <section class="metric-grid metric-grid-compact risk-grid">
          ${(payload.indicators ?? []).map((indicator) => renderIndicatorCard(indicator)).join("")}
        </section>

        ${renderWarningList(payload.warnings)}

        <section class="chart-shell">
          <div class="chart-header">
            <div>
              <p class="eyebrow">Market sentiment</p>
              <h3>${escapeHtml(activeSeries?.label ?? "Risk series")}</h3>
            </div>
            ${renderChartControls(chartSeries)}
          </div>
          <div class="chart-placeholder risk-chart" data-risk-chart></div>
        </section>

        <section class="source-strip">
          ${(payload.sources ?? [])
            .map(
              (source) => `
                <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
                  ${escapeHtml(source.label)}
                </a>
              `,
            )
            .join("")}
        </section>
      </div>
    `;

    container.querySelector('[data-action="refresh-risk"]')?.addEventListener("click", () => {
      loadRiskData(container, true);
    });

    container.querySelectorAll("[data-chart-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedChartId = button.getAttribute("data-chart-id") || "vix";
        loadRiskData(container, false);
      });
    });

    const chartContainer = container.querySelector("[data-risk-chart]");
    if (chartContainer && activeSeries) {
      await mountChart(chartContainer, activeSeries);
    }
  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Unable to load risk data.");
  }
}

export function renderRiskModule(container) {
  addStyleSheet(RISK_STYLESHEET_PATH, RISK_STYLESHEET_ID, import.meta.url);
  loadRiskData(container);
}
