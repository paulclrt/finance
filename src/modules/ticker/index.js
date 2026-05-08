import { renderIcon } from "../../renderer/icons.js";
import { renderSourceIndicator } from "../ui/source-indicator.js";
import { addStyleSheet } from "../../utils/css-editor.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
const TICKER_STYLESHEET_ID = "ticker";
const TICKER_STYLESHEET_PATH = "./styles.css";

let chartLibraryPromise;
const tickerStateByContainer = new WeakMap();

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

function getTickerState(container) {
  let state = tickerStateByContainer.get(container);
  if (state) {
    return state;
  }

  state = {
    ticker: "",
    inputValue: "",
    duration: "1mo",
    isLoading: false,
    error: "",
    payload: null,
    requestId: 0,
  };
  tickerStateByContainer.set(container, state);
  return state;
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

function formatTimestamp(dateString) {
  if (!dateString) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatPrice(value, currency = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function iconButton({ icon, label, dataset = "" }) {
  return `
    <button class="icon-button" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${dataset}>
      ${renderIcon(icon)}
    </button>
  `;
}

function renderDurationSelector(selected) {
  return `
    <div class="ticker-duration-selector" role="tablist" aria-label="Duration">
      ${DURATION_OPTIONS.map(
        (option) => `
          <button
            class="ticker-duration-option ${option.value === selected ? "active" : ""}"
            type="button"
            data-duration="${escapeHtml(option.value)}"
            aria-pressed="${option.value === selected ? "true" : "false"}"
          >
            ${escapeHtml(option.label)}
          </button>
        `,
      ).join("")}
    </div>
  `;
}

function renderSearchBar(state) {
  return `
    <section class="ticker-toolbar">
      <div class="ticker-search-shell">
        <label class="ticker-search-label" for="ticker-symbol-input">Ticker</label>
        <div class="ticker-search-row">
          <input
            id="ticker-symbol-input"
            type="text"
            class="ticker-input"
            placeholder="AAPL, MSFT, ^FCHI, SPY, BTC-USD..."
            value="${escapeHtml(state.inputValue)}"
            data-ticker-input
            spellcheck="false"
            autocomplete="off"
          />
          <button type="button" class="ticker-submit-button" data-action="search-ticker">
            Search
          </button>
        </div>
      </div>
      ${renderDurationSelector(state.duration)}
    </section>
  `;
}

function renderStatusBanner(state) {
  if (state.error) {
    return `
      <section class="status-note warning-note ticker-status-banner">
        <p>${escapeHtml(state.error)}</p>
      </section>
    `;
  }

  if (state.isLoading && state.ticker) {
    return `
      <section class="status-note ticker-status-banner">
        <p>Chargement de ${escapeHtml(state.ticker)} sur ${escapeHtml(state.duration.toUpperCase())}...</p>
      </section>
    `;
  }

  if (!state.ticker) {
    return `
      <section class="status-note empty-state ticker-status-banner">
        <p>Recherchez un ticker pour afficher son historique, ses variations et ses infos de base.</p>
      </section>
    `;
  }

  return "";
}

function renderMetrics(payload) {
  const info = payload?.data?.info || {};
  const history = payload?.data?.history || [];
  const lastPrice = history.at(-1) || {};
  const firstPrice = history[0] || {};
  const changePercent =
    typeof lastPrice.Close === "number" && typeof firstPrice.Close === "number" && firstPrice.Close !== 0
      ? ((lastPrice.Close - firstPrice.Close) / firstPrice.Close) * 100
      : Number.NaN;
  const changeClass = changePercent >= 0 ? "positive" : "negative";
  const currency = info.currency || "";

  return `
    <section class="rate-strip">
      <article class="rate-chip rate-chip-meta">
        <span>Actif</span>
        <strong>${escapeHtml(formatAssetType(info.quoteType))}</strong>
      </article>
      <article class="rate-chip">
        <span>Prix actuel</span>
        <strong>${escapeHtml(formatPrice(lastPrice.Close, currency))}</strong>
      </article>
      <article class="rate-chip">
        <span>Variation</span>
        <strong class="${changeClass}">${escapeHtml(formatPercent(changePercent))}</strong>
      </article>
      <article class="rate-chip">
        <span>Ouverture</span>
        <strong>${escapeHtml(formatPrice(lastPrice.Open, currency))}</strong>
      </article>
      <article class="rate-chip">
        <span>Haut / Bas</span>
        <strong>${escapeHtml(formatPrice(lastPrice.High, currency))} / ${escapeHtml(formatPrice(lastPrice.Low, currency))}</strong>
      </article>
    </section>
  `;
}

function renderTickerBody(state) {
  if (!state.payload?.data) {
    return "";
  }

  const payload = state.payload;
  const info = payload.data.info || {};
  const history = payload.data.history || [];

  return `
    ${renderMetrics(payload)}

    <section class="chart-shell">
      <div class="chart-header">
        <div>
          <p class="eyebrow">${escapeHtml(state.ticker)}</p>
          <h3>${escapeHtml(info.longName || state.ticker)}</h3>
        </div>
        <div class="inline-actions">
          <span class="bank-pill">${escapeHtml(formatAssetType(info.quoteType))}</span>
        </div>
      </div>
      <div class="chart-placeholder ticker-chart" data-ticker-chart></div>
    </section>

    ${
      info.longBusinessSummary
        ? `
          <section class="compact-section ticker-summary-section">
            <div class="section-head">
              <p class="eyebrow">Company</p>
              <h3>À propos</h3>
            </div>
            <p class="ticker-description">${escapeHtml(info.longBusinessSummary.substring(0, 520))}...</p>
          </section>
        `
        : ""
    }

    ${
      !history.length
        ? `
          <section class="status-note empty-state ticker-status-banner">
            <p>Aucune donnée historique disponible pour ce ticker sur cette période.</p>
          </section>
        `
        : ""
    }
  `;
}

function formatAssetType(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "ETF") {
    return "ETF";
  }
  if (normalized === "INDEX") {
    return "Index";
  }
  if (normalized === "CRYPTOCURRENCY") {
    return "Crypto";
  }
  if (normalized === "EQUITY") {
    return "Stock";
  }
  if (normalized === "MUTUALFUND") {
    return "Fund";
  }
  return normalized ? normalized.charAt(0) + normalized.slice(1).toLowerCase() : "Unknown";
}

function renderTickerView(container) {
  const state = getTickerState(container);
  const title = state.payload?.data?.info?.longName || state.ticker || "Stock Ticker";

  container.innerHTML = `
    <div class="module-card ticker-module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Market Data</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="inline-actions">
          ${state.payload ? renderSourceIndicator(state.payload.servedFrom, formatTimestamp(state.payload.lastSuccessfulRefresh)) : ""}
          ${iconButton({
            icon: "refreshCw",
            label: "Actualiser les données du ticker",
            dataset: 'data-action="refresh-ticker"',
          })}
        </div>
      </div>

      ${renderSearchBar(state)}
      ${renderStatusBanner(state)}
      ${renderTickerBody(state)}
    </div>
  `;
}

function mountChart(container, historyData) {
  if (!historyData?.length) {
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

      const chartData = historyData
        .map((point) => ({
          time: point.Date ? point.Date.split("T")[0] : null,
          open: point.Open,
          high: point.High,
          low: point.Low,
          close: point.Close,
        }))
        .filter((point) => point.time);

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

async function fetchTickerData(container, { refresh = false } = {}) {
  const state = getTickerState(container);
  if (!state.ticker) {
    renderTickerView(container);
    return;
  }

  state.isLoading = true;
  state.error = "";
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  renderTickerView(container);

  try {
    const payload = await window.financeDesktop.getTickerData({
      ticker: state.ticker,
      duration: state.duration,
      refresh,
    });

    if (requestId !== state.requestId) {
      return;
    }

    state.payload = payload;
    state.error = "";
  } catch (error) {
    if (requestId !== state.requestId) {
      return;
    }

    state.error = error?.message || "Impossible de charger les données du ticker.";
  } finally {
    if (requestId !== state.requestId) {
      return;
    }

    state.isLoading = false;
    renderTickerView(container);

    const chartContainer = container.querySelector("[data-ticker-chart]");
    const history = state.payload?.data?.history || [];
    if (chartContainer && history.length) {
      await mountChart(chartContainer, history);
    }
  }
}

function submitTickerSearch(container) {
  const state = getTickerState(container);
  const nextTicker = state.inputValue.trim().toUpperCase();
  if (!nextTicker) {
    state.error = "Entrez un ticker valide avant de lancer la recherche.";
    renderTickerView(container);
    return;
  }

  if (nextTicker === state.ticker && state.payload) {
    fetchTickerData(container, { refresh: true });
    return;
  }

  state.ticker = nextTicker;
  state.inputValue = nextTicker;
  state.payload = null;
  fetchTickerData(container);
}

function attachTickerListeners(container) {
  if (container.dataset.tickerListenersBound === "true") {
    return;
  }

  container.dataset.tickerListenersBound = "true";

  container.addEventListener("input", (event) => {
    if (!event.target.matches("[data-ticker-input]")) {
      return;
    }
    getTickerState(container).inputValue = event.target.value;
  });

  container.addEventListener("keydown", (event) => {
    if (event.target.matches("[data-ticker-input]") && event.key === "Enter") {
      event.preventDefault();
      submitTickerSearch(container);
    }
  });

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.matches("[data-action='search-ticker']")) {
      submitTickerSearch(container);
      return;
    }

    if (button.matches("[data-action='refresh-ticker']")) {
      const state = getTickerState(container);
      if (state.ticker) {
        fetchTickerData(container, { refresh: true });
      }
      return;
    }

    if (button.matches("[data-duration]")) {
      const state = getTickerState(container);
      const nextDuration = button.getAttribute("data-duration");
      if (!nextDuration || nextDuration === state.duration) {
        return;
      }

      state.duration = nextDuration;
      renderTickerView(container);
      if (state.ticker) {
        fetchTickerData(container);
      }
    }
  });
}

export function renderTickerModule(container) {
  addStyleSheet(TICKER_STYLESHEET_PATH, TICKER_STYLESHEET_ID, import.meta.url);
  getTickerState(container);
  attachTickerListeners(container);
  renderTickerView(container);
}
