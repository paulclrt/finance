import { renderIcon } from "../../renderer/icons.js";

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
        existing.addEventListener("error", () => reject(new Error("Chart library failed to load.")), {
          once: true,
        });
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

function toUtcDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(toUtcDate(dateString));
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

function formatRate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)}%`;
}

function formatFedRange(currentRates) {
  if (!currentRates) {
    return "--";
  }
  return `${formatRate(currentRates.targetLowerBound)} - ${formatRate(currentRates.targetUpperBound)}`;
}

function iconButton({ icon, label, href, dataset = "" }) {
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

function buildCalendarUrl(event) {
  const start = event.date.replaceAll("-", "");
  const endDate = toUtcDate(event.date);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replaceAll("-", "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.bank} ${event.title}`,
    dates: `${start}/${end}`,
    details: `${event.details} Source: ${event.sourceUrl}`,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getUpcomingEvents(events) {
  const now = Date.now();
  return [...events]
    .filter((event) => toUtcDate(event.date).getTime() >= now)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function renderRateStrip(currentEcbRates, currentFedRates, payload) {
  if (!currentEcbRates && !currentFedRates) {
    return "";
  }

  return `
    <section class="rate-strip">
      <article class="rate-chip">
        <span>Deposit</span>
        <strong>${escapeHtml(formatRate(currentEcbRates?.depositFacility))}</strong>
      </article>
      <article class="rate-chip">
        <span>Main refi</span>
        <strong>${escapeHtml(formatRate(currentEcbRates?.mainRefinancingOperations))}</strong>
      </article>
      <article class="rate-chip">
        <span>Marginal</span>
        <strong>${escapeHtml(formatRate(currentEcbRates?.marginalLendingFacility))}</strong>
      </article>
      <article class="rate-chip">
        <span>Fed range</span>
        <strong>${escapeHtml(formatFedRange(currentFedRates))}</strong>
      </article>
      <article class="rate-chip rate-chip-meta">
        <span>Source / refresh</span>
        <strong>${escapeHtml(payload.servedFrom ?? "unknown")} · ${escapeHtml(formatTimestamp(payload.lastSuccessfulRefresh))}</strong>
      </article>
    </section>
  `;
}

function renderEventRow(event, currentEcbRates, currentFedRates) {
  let rateSummary = "no linked rate";
  if (event.bank === "ECB" && currentEcbRates) {
    rateSummary = `${formatRate(currentEcbRates.depositFacility)} / ${formatRate(currentEcbRates.mainRefinancingOperations)} / ${formatRate(currentEcbRates.marginalLendingFacility)}`;
  } else if (event.bank === "Fed" && currentFedRates) {
    rateSummary = formatFedRange(currentFedRates);
  }

  return `
    <article class="event-row">
      <div class="event-body">
        <div class="event-primary">
          <span class="bank-pill bank-pill-${escapeHtml(event.bank.toLowerCase())}">${escapeHtml(event.bank)}</span>
          <strong>${escapeHtml(event.title)}</strong>
        </div>
        <div class="event-secondary">
          <span>${escapeHtml(formatDate(event.date))}</span>
          <span>${escapeHtml(event.location)}</span>
          <span class="event-rate-tag">${escapeHtml(rateSummary)}</span>
        </div>
      </div>
      <div class="inline-actions">
        ${iconButton({
          icon: "calendarPlus",
          label: `Add ${event.bank} event to Google Calendar`,
          dataset: `data-calendar-url="${escapeHtml(buildCalendarUrl(event))}"`,
        })}
        ${iconButton({
          icon: "externalLink",
          label: `Open source for ${event.bank}`,
          href: event.sourceUrl,
        })}
      </div>
    </article>
  `;
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
          <p class="eyebrow">Rates</p>
          <h2>Fed / ECB policy monitor</h2>
        </div>
      </div>
      <section class="status-note empty-state">
        <p>${escapeHtml(message)}</p>
      </section>
    </div>
  `;
}

function buildRateSeries(rateHistory, key, upcomingEvents = []) {
  const series = [...rateHistory]
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
    .map((point) => ({
      time: point.effectiveDate,
      value: point[key],
    }));

  const lastPoint = series[series.length - 1];
  if (!lastPoint) {
    return series;
  }

  for (const event of upcomingEvents) {
    if (event.date > lastPoint.time) {
      series.push({
        time: event.date,
        value: lastPoint.value,
      });
    }
  }

  return series;
}

function mountChart(container, payload) {
  const ecbRateHistory = payload.ecbRatesHistory ?? [];
  const fedRateHistory = payload.fedRatesHistory ?? [];
  const upcomingEcbEvents = getUpcomingEvents(payload.events ?? [])
    .filter((event) => event.bank === "ECB")
    .slice(0, 4);
  const upcomingFedEvents = getUpcomingEvents(payload.events ?? [])
    .filter((event) => event.bank === "Fed")
    .slice(0, 4);

  if (!ecbRateHistory.length && !fedRateHistory.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Rates unavailable</strong>
        <p>No ECB or Fed rate history is available yet.</p>
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

      const fedSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#b45309",
        lineWidth: 2,
        lineStyle: 1,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      const depositSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      const mainSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#0f766e",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      const marginalSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#64748b",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const fedData = buildRateSeries(fedRateHistory, "targetMidpoint", upcomingFedEvents);
      const depositData = buildRateSeries(ecbRateHistory, "depositFacility", upcomingEcbEvents);
      const mainData = buildRateSeries(ecbRateHistory, "mainRefinancingOperations", upcomingEcbEvents);
      const marginalData = buildRateSeries(ecbRateHistory, "marginalLendingFacility", upcomingEcbEvents);

      fedSeries.setData(fedData);
      depositSeries.setData(depositData);
      mainSeries.setData(mainData);
      marginalSeries.setData(marginalData);
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

function attachExternalActions(container) {
  container.querySelectorAll("[data-calendar-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const url = button.getAttribute("data-calendar-url");
      if (!url) {
        return;
      }
      if (window.financeDesktop?.openExternal) {
        await window.financeDesktop.openExternal(url);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

async function loadCentralBankData(container, refresh = false) {
  container.innerHTML = renderEmptyState(refresh ? "Refreshing central bank data..." : "Loading central bank data...");

  try {
    const payload = await window.financeDesktop.getCentralBankEvents({ refresh });
    const events = [...(payload.events ?? [])].sort((left, right) => left.date.localeCompare(right.date));
    const upcoming = getUpcomingEvents(events).slice(0, 4);
    const currentEcbRates = payload.currentEcbRates ?? null;
    const currentFedRates = payload.currentFedRates ?? null;
    const sources = [
      ...new Map(
        [
          ...events.map((event) => [event.sourceUrl, { label: `${event.bank} calendar`, url: event.sourceUrl }]),
          [currentEcbRates?.sourceUrl, { label: "ECB rates", url: currentEcbRates?.sourceUrl }],
          [currentFedRates?.sourceUrl, { label: "Fed rates", url: currentFedRates?.sourceUrl }],
        ].filter(([url]) => Boolean(url))
      ).values(),
    ];

    if (!events.length) {
      container.innerHTML = renderEmptyState("No central bank events are available yet.");
      return;
    }

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Rates</p>
            <h2>Fed / ECB policy monitor</h2>
          </div>
          ${iconButton({
            icon: "refreshCw",
            label: "Refresh central bank data",
            dataset: 'data-action="refresh-central-banks"',
          })}
        </div>

        ${renderRateStrip(currentEcbRates, currentFedRates, payload)}

        ${renderWarningList(payload.warnings)}

        <section class="chart-shell">
          <div class="chart-header">
            <div>
              <p class="eyebrow">FED + ECB</p>
              <h3>Key rates</h3>
            </div>
            <div class="chart-legend">
              <span><i class="legend-dot legend-dot-fed"></i> Fed midpoint</span>
              <span><i class="legend-dot legend-dot-deposit"></i> Deposit</span>
              <span><i class="legend-dot legend-dot-main"></i> Main refi</span>
              <span><i class="legend-dot legend-dot-marginal"></i> Marginal</span>
            </div>
          </div>
          <div class="chart-placeholder central-bank-chart" data-central-bank-chart></div>
        </section>

        <section class="event-stack compact-section">
          <div class="section-head">
            <p class="eyebrow">Calendar</p>
            <h3>Next conferences</h3>
          </div>
          <div class="event-list">
            ${
              upcoming.length
                ? upcoming.map((event) => renderEventRow(event, currentEcbRates, currentFedRates)).join("")
                : '<p class="muted">No upcoming conference found.</p>'
            }
          </div>
        </section>

        <section class="source-strip">
          ${sources
            .map(
              (source) => `
                <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
                  ${escapeHtml(source.label)}
                </a>
              `
            )
            .join("")}
        </section>
      </div>
    `;

    container.querySelector("[data-action=\"refresh-central-banks\"]")?.addEventListener("click", () => {
      loadCentralBankData(container, true);
    });

    attachExternalActions(container);

    const chartContainer = container.querySelector("[data-central-bank-chart]");
    if (chartContainer) {
      await mountChart(chartContainer, payload);
    }
  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Unable to load central bank data.");
  }
}

export function renderCentralBankModule(container) {
  loadCentralBankData(container);
}
