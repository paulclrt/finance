import { renderIcon } from "../../renderer/icons.js";
import { renderSourceIndicator } from "../ui/source-indicator.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";

let chartLibraryPromise;

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

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)}%`;
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

function renderMetricCards(latest, payload) {
  const items = latest ?? [];
  return `
    <section class="metric-grid metric-grid-compact inflation-metric-grid">
      ${items
        .map((item) => {
          const point = item.latestPoint;
          return `
            <article class="metric-card">
              <span>${escapeHtml(item.region)}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <p class="inflation-metric-value">${escapeHtml(formatPercent(point?.value))}</p>
              <p class="muted">${escapeHtml(formatMonth(point?.time))}</p>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderEmptyState(message) {

  return `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Inflation</p>
            <h2>CPI / PCE / HICP</h2>
          </div>
          <div class="inline-actions">
            ${iconButton({
              icon: "refreshCw",
              label: "Refresh inflation data",
              dataset: 'data-action="refresh-inflation"',
            })}
          </div>
        </div>
        <section class="status-note empty-state">
          <p>${escapeHtml(message)}</p>
        </section>
      </div>
    `;
}

function mountChart(container, payload) {
  const seriesPayload = (payload.series ?? []).filter((item) => item.points?.length);

  if (!seriesPayload.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Inflation unavailable</strong>
        <p>No CPI, PCE, or HICP points are available yet.</p>
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
          priceFormatter: (value) => `${value.toFixed(2)}%`,
        },
      });

      for (const item of seriesPayload) {
        const series = chart.addSeries(LightweightCharts.LineSeries, {
          color: item.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        series.setData(item.points);
      }

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

async function loadInflationData(container, refresh = false) {
  container.innerHTML = renderEmptyState(refresh ? "Refreshing inflation data..." : "Loading inflation data...");

  try {
    const payload = await window.financeDesktop.getInflationData({ refresh, years: 15 });
    const sources = [...new Map((payload.series ?? []).map((item) => [item.sourceUrl, item])).values()];

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Inflation</p>
            <h2>CPI / PCE / HICP</h2>
          </div>
          <div class="inline-actions">
            ${renderSourceIndicator(payload.servedFrom, formatTimestamp(payload.lastSuccessfulRefresh))}
            ${iconButton({
              icon: "refreshCw",
              label: "Refresh inflation data",
              dataset: 'data-action="refresh-inflation"',
            })}
          </div>
        </div>

        ${renderMetricCards(payload.latest, payload)}

        ${renderWarningList(payload.warnings)}

        <section class="chart-shell">
          <div class="chart-header">
            <div>
              <p class="eyebrow">FRED</p>
              <h3>YoY inflation</h3>
            </div>
            <div class="chart-legend">
              ${(payload.series ?? [])
                .map(
                  (item) => `
                    <span><i class="legend-dot" style="background: ${escapeHtml(item.color)}"></i> ${escapeHtml(item.label)}</span>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="chart-placeholder inflation-chart" data-inflation-chart></div>
        </section>

        <section class="source-strip">
          ${sources
            .map(
              (item) => `
                <a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">
                  ${escapeHtml(item.label)}
                </a>
              `
            )
            .join("")}
        </section>
      </div>
    `;

    container.querySelector('[data-action="refresh-inflation"]')?.addEventListener("click", () => {
      loadInflationData(container, true);
    });

    const chartContainer = container.querySelector("[data-inflation-chart]");
    if (chartContainer) {
      await mountChart(chartContainer, payload);
    }
  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Unable to load inflation data.");
    container.querySelector('[data-action="refresh-inflation"]')?.addEventListener("click", () => {
      loadInflationData(container, true);
    });
  }
}

export function renderInflationModule(container) {
  loadInflationData(container);
}
