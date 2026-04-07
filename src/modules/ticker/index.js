import { renderIcon } from "../../renderer/icons.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";

let chartLibraryPromise;
let currentTicker = null;
let currentDuration = "1mo";

const DURATION_OPTIONS = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "ytd", label: "YTD" },
  { value: "max", label: "ALL" },
];

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

function formatDate(dateString) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(dateString));
}

function formatTimestamp(dateString) {
  if (!dateString) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatPrice(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)} €`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
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

function renderEmptyState(message) {
  return `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Market Data</p>
          <h2>Stock Ticker</h2>
        </div>
      </div>
      <section class="status-note empty-state">
        <p>${escapeHtml(message)}</p>
      </section>
    </div>
  `;
}

function renderDurationSelector(selected) {
  return DURATION_OPTIONS.map(opt => `
    <button 
      class="duration-btn ${opt.value === selected ? 'active' : ''}" 
      data-duration="${escapeHtml(opt.value)}"
      type="button"
    >
      ${escapeHtml(opt.label)}
    </button>
  `).join("");
}

function mountChart(container, historyData) {
  if (!historyData || !historyData.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Données indisponibles</strong>
        <p>Aucune donnée historique pour ce ticker.</p>
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
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: "#e5e7eb",
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
        },
      });

      const candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      const chartData = historyData.map(point => ({
        time: point.Date ? point.Date.split('T')[0] : null,
        open: point.Open,
        high: point.High,
        low: point.Low,
        close: point.Close,
      })).filter(p => p.time);

      candlestickSeries.setData(chartData);
      chart.timeScale().fitContent();
    })
    .catch((error) => {
      container.innerHTML = `
        <div class="chart-fallback">
          <strong>Graphique indisponible</strong>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    });
}

async function loadTickerData(container, refresh = false) {

  if (!currentTicker) {
    // Empty initial state: only search bar
    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Market Data</p>
            <h2>Stock Ticker</h2>
          </div>
          ${iconButton({
            icon: "refreshCw",
            label: "Actualiser",
            dataset: 'data-action="refresh-ticker"',
          })}
        </div>

        <section class="ticker-search-bar">
          <div class="search-input-group">
            <input 
              type="text" 
              class="ticker-input" 
              placeholder="Entrer un ticker (ex: AAPL, MSFT, TSLA)" 
              data-ticker-input
              autofocus
            >
            <button type="button" class="btn primary" data-action="search-ticker">Chercher</button>
          </div>
          
          <div class="duration-selector">
            ${renderDurationSelector(currentDuration)}
          </div>
        </section>

        <section class="status-note empty-state">
          <p>Recherchez un ticker pour afficher les données et le graphique historique</p>
        </section>
      </div>
    `;

    // Attach base listeners
    attachBaseListeners(container);
    return;
  }

  container.innerHTML = renderEmptyState(refresh ? "Actualisation en cours..." : "Chargement des données...");

  try {
    const payload = await window.financeDesktop.getTickerData({ 
      ticker: currentTicker, 
      duration: currentDuration,
      refresh 
    });

    const info = payload.data?.info || {};
    const history = payload.data?.history || [];
    const lastPrice = history.length ? history[history.length - 1] : {};
    const firstPrice = history.length ? history[0] : {};
    
    const changePercent = lastPrice.Close && firstPrice.Close 
      ? ((lastPrice.Close - firstPrice.Close) / firstPrice.Close * 100) 
      : 0;
    const changeClass = changePercent >= 0 ? "positive" : "negative";

    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Market Data</p>
            <h2>${escapeHtml(info.longName || currentTicker)}</h2>
          </div>
          ${iconButton({
            icon: "refreshCw",
            label: "Actualiser",
            dataset: 'data-action="refresh-ticker"',
          })}
        </div>

        <section class="ticker-search-bar">
          <div class="search-input-group">
            <input 
              type="text" 
              class="ticker-input" 
              placeholder="Entrer un ticker (ex: AAPL, MSFT, TSLA)" 
              value="${escapeHtml(currentTicker)}"
              data-ticker-input
            >
            <button type="button" class="btn primary" data-action="search-ticker">Chercher</button>
          </div>
          
          <div class="duration-selector">
            ${renderDurationSelector(currentDuration)}
          </div>
        </section>

        <section class="rate-strip">
          <article class="rate-chip">
            <span>Prix actuel</span>
            <strong>${escapeHtml(formatPrice(lastPrice.Close))}</strong>
          </article>
          <article class="rate-chip">
            <span>Variation</span>
            <strong class="${changeClass}">${escapeHtml(formatPercent(changePercent))}</strong>
          </article>
          <article class="rate-chip">
            <span>Ouverture</span>
            <strong>${escapeHtml(formatPrice(lastPrice.Open))}</strong>
          </article>
          <article class="rate-chip">
            <span>Haut / Bas</span>
            <strong>${escapeHtml(formatPrice(lastPrice.High))} / ${escapeHtml(formatPrice(lastPrice.Low))}</strong>
          </article>
          <article class="rate-chip rate-chip-meta">
            <span>Source</span>
            <strong>${escapeHtml(payload.servedFrom ?? "unknown")} · ${escapeHtml(formatTimestamp(payload.lastSuccessfulRefresh))}</strong>
          </article>
        </section>

        <section class="chart-shell">
          <div class="chart-header">
            <div>
              <p class="eyebrow">${escapeHtml(currentTicker)}</p>
              <h3>Cours historique</h3>
            </div>
          </div>
          <div class="chart-placeholder ticker-chart" data-ticker-chart></div>
        </section>

        ${info.longBusinessSummary ? `
        <section class="compact-section">
          <div class="section-head">
            <p class="eyebrow">Informations</p>
            <h3>À propos</h3>
          </div>
          <p class="ticker-description">${escapeHtml(info.longBusinessSummary.substring(0, 500))}...</p>
        </section>
        ` : ''}

      </div>
    `;

    // Attach event listeners
    container.querySelector("[data-action=\"refresh-ticker\"]")?.addEventListener("click", () => {
      loadTickerData(container, true);
    });

    container.querySelector("[data-action=\"search-ticker\"]")?.addEventListener("click", () => {
      const input = container.querySelector("[data-ticker-input]");
      if (input && input.value.trim()) {
        currentTicker = input.value.trim().toUpperCase();
        loadTickerData(container, false);
      }
    });

    container.querySelector("[data-ticker-input]")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        currentTicker = e.target.value.trim().toUpperCase();
        loadTickerData(container, false);
      }
    });

    container.querySelectorAll("[data-duration]").forEach(btn => {
      btn.addEventListener("click", () => {
        currentDuration = btn.dataset.duration;
        loadTickerData(container, false);
      });
    });

    const chartContainer = container.querySelector("[data-ticker-chart]");
    if (chartContainer) {
      await mountChart(chartContainer, history);
    }

  } catch (error) {
    container.innerHTML = renderEmptyState(error.message || "Impossible de charger les données du ticker.");
  }
}

function attachBaseListeners(container) {
  container.querySelector("[data-action=\"search-ticker\"]")?.addEventListener("click", () => {
    const input = container.querySelector("[data-ticker-input]");
    if (input && input.value.trim()) {
      currentTicker = input.value.trim().toUpperCase();
      loadTickerData(container, false);
    }
  });

  container.querySelector("[data-ticker-input]")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      currentTicker = e.target.value.trim().toUpperCase();
      loadTickerData(container, false);
    }
  });

  container.querySelectorAll("[data-duration]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentDuration = btn.dataset.duration;
      if (currentTicker) {
        loadTickerData(container, false);
      } else {
        loadTickerData(container, false);
      }
    });
  });
}

export function renderTickerModule(container) {
  currentTicker = null;
  loadTickerData(container);
}
