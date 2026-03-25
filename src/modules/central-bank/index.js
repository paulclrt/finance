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
    dateStyle: "full",
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

function getCountdown(dateString) {
  const diffMs = toUtcDate(dateString).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return "Today";
  }

  if (days === 1) {
    return "In 1 day";
  }

  return `In ${days} days`;
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

function getNextByBank(events) {
  const upcoming = getUpcomingEvents(events);
  const nextByBank = new Map();
  for (const event of upcoming) {
    if (!nextByBank.has(event.bank)) {
      nextByBank.set(event.bank, event);
    }
  }
  return [...nextByBank.values()];
}

function renderEventCard(event, eyebrow) {
  return `
    <article class="event-card next-event-card">
      <div class="event-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h3>${escapeHtml(event.bank)} · ${escapeHtml(event.title)}</h3>
        </div>
        <span class="bank-pill bank-pill-${escapeHtml(event.bank.toLowerCase())}">${escapeHtml(event.bank)}</span>
      </div>

      <div class="event-grid">
        <div>
          <span class="event-label">Date</span>
          <strong>${escapeHtml(formatDate(event.date))}</strong>
        </div>
        <div>
          <span class="event-label">Countdown</span>
          <strong>${escapeHtml(getCountdown(event.date))}</strong>
        </div>
        <div>
          <span class="event-label">Location</span>
          <strong>${escapeHtml(event.location)}</strong>
        </div>
      </div>

      <p class="muted">${escapeHtml(event.details)}</p>

      <div class="log-actions">
        <button class="button" type="button" data-calendar-url="${escapeHtml(buildCalendarUrl(event))}">
          Add to Google Calendar
        </button>
        <a class="button button-secondary" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">
          Open source
        </a>
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
          <p class="eyebrow">Central banks</p>
          <h2>FED and ECB tracker</h2>
        </div>
      </div>
      <section class="status-note empty-state">
        <p>${escapeHtml(message)}</p>
      </section>
    </div>
  `;
}

function buildSeries(events, bank) {
  const value = bank === "Fed" ? 2 : 1;
  return events
    .filter((event) => event.bank === bank)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((event) => ({ time: event.date, value, event }));
}

function mountChart(container, events) {
  return loadChartLibrary()
    .then((LightweightCharts) => {
      const chart = LightweightCharts.createChart(container, {
        autoSize: true,
        layout: {
          background: { color: "transparent" },
          textColor: "#d7e7fb",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(148, 163, 184, 0.1)" },
          horzLines: { color: "rgba(148, 163, 184, 0.12)" },
        },
        timeScale: {
          borderColor: "rgba(148, 163, 184, 0.18)",
          timeVisible: false,
        },
        rightPriceScale: {
          borderColor: "rgba(148, 163, 184, 0.18)",
          scaleMargins: { top: 0.18, bottom: 0.18 },
        },
        localization: {
          priceFormatter: (value) => (value >= 1.5 ? "Fed" : "ECB"),
        },
      });

      const fedSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#7dd3fc",
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const ecbSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#34d399",
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const fedData = buildSeries(events, "Fed");
      const ecbData = buildSeries(events, "ECB");

      fedSeries.setData(fedData.map(({ time, value }) => ({ time, value })));
      ecbSeries.setData(ecbData.map(({ time, value }) => ({ time, value })));
      LightweightCharts.createSeriesMarkers(
        fedSeries,
        fedData.map(({ time }) => ({ time, position: "inBar", color: "#7dd3fc", shape: "circle", text: "Fed" }))
      );
      LightweightCharts.createSeriesMarkers(
        ecbSeries,
        ecbData.map(({ time }) => ({ time, position: "inBar", color: "#34d399", shape: "circle", text: "ECB" }))
      );
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
    const upcoming = getUpcomingEvents(events);
    const nextEvent = upcoming[0] ?? null;
    const nextByBank = getNextByBank(events);
    const sources = [...new Map(events.map((event) => [event.sourceUrl, event])).values()];

    if (!events.length) {
      container.innerHTML = renderEmptyState("No central bank events are available yet.");
      return;
    }

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Central banks</p>
            <h2>FED and ECB tracker</h2>
          </div>
          <div class="log-actions">
            <button class="button" type="button" data-action="refresh-central-banks">Refresh data</button>
          </div>
        </div>

        <section class="hero">
          <h3>SQLite backed official calendar cache</h3>
          <p>
            The renderer only displays cached or freshly fetched data. The Python fetcher reads
            official FED and ECB pages, stores normalized events in SQLite, and returns JSON over stdout.
          </p>
        </section>

        <section class="metric-grid">
          <article class="metric-card">
            <span>Events loaded</span>
            <strong>${events.length}</strong>
          </article>
          <article class="metric-card">
            <span>Served from</span>
            <strong>${escapeHtml(payload.servedFrom ?? "unknown")}</strong>
          </article>
          <article class="metric-card">
            <span>Last refresh</span>
            <strong>${escapeHtml(formatTimestamp(payload.lastSuccessfulRefresh))}</strong>
          </article>
        </section>

        ${renderWarningList(payload.warnings)}

        <section class="chart-shell">
          <div class="chart-header">
            <div>
              <p class="eyebrow">TradingView chart</p>
              <h3>Policy announcement timeline</h3>
            </div>
            <div class="chart-legend">
              <span><i class="legend-dot legend-dot-fed"></i> FED</span>
              <span><i class="legend-dot legend-dot-ecb"></i> ECB</span>
            </div>
          </div>
          <div class="chart-placeholder central-bank-chart" data-central-bank-chart></div>
        </section>

        <section class="event-stack">
          ${nextEvent ? renderEventCard(nextEvent, "Next announcement") : renderEmptyState("No upcoming announcement found.")}
          ${nextByBank.map((event) => renderEventCard(event, `Next ${event.bank}`)).join("")}
        </section>

        <section class="source-grid">
          ${sources
            .map(
              (event) => `
                <a class="source-card" href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">
                  <span>${escapeHtml(event.bank)}</span>
                  <strong>${escapeHtml(event.sourceUrl)}</strong>
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
      await mountChart(chartContainer, events);
    }
  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Unable to load central bank data.");
  }
}

export function renderCentralBankModule(container) {
  loadCentralBankData(container);
}
