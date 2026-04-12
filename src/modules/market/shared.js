import { renderIcon } from "../../renderer/icons.js";
import { addStyleSheet } from "../../utils/css-editor.js";

const CHART_LIBRARY_URL = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
const STYLESHEET_ID = "market-panels";
const STYLESHEET_PATH = "./market-panels.css";

let chartLibraryPromise;

const DURATION_OPTIONS = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "max", label: "All" },
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

function formatTimestamp(dateString) {
  if (!dateString) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatAssetType(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "ETF") return "ETF";
  if (normalized === "INDEX") return "Index";
  if (normalized === "CRYPTOCURRENCY") return "Crypto";
  if (normalized === "EQUITY") return "Stock";
  if (normalized === "MUTUALFUND") return "Fund";
  if (normalized === "CURRENCY") return "FX";
  if (normalized === "FUTURE") return "Future";
  return normalized ? normalized.charAt(0) + normalized.slice(1).toLowerCase() : "Unknown";
}

function formatPrice(value, currency = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  const decimals = Math.abs(value) >= 100 ? 2 : value >= 10 ? 3 : 4;
  return `${value.toFixed(decimals)}${currency ? ` ${currency}` : ""}`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function renderPresetBar(config, state) {
  return `
    <div class="market-preset-bar" role="tablist" aria-label="${escapeHtml(config.title)} presets">
      ${config.presets
        .map(
          (preset) => `
            <button
              class="market-preset-chip ${preset.symbol === state.symbol ? "active" : ""}"
              type="button"
              data-market-symbol="${escapeHtml(preset.symbol)}"
              title="${escapeHtml(preset.label)}"
            >
              <span class="market-logo-badge ${escapeHtml(preset.logoClass || "")}">${escapeHtml(preset.logo)}</span>
              <span>${escapeHtml(preset.label)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderDurationSelector(state) {
  return `
    <div class="market-duration-selector">
      ${DURATION_OPTIONS.map(
        (option) => `
          <button
            class="market-duration-option ${option.value === state.duration ? "active" : ""}"
            type="button"
            data-market-duration="${escapeHtml(option.value)}"
          >
            ${escapeHtml(option.label)}
          </button>
        `,
      ).join("")}
    </div>
  `;
}

function renderSearchBar(config, state) {
  return `
    <section class="market-search-shell">
      <div class="market-search-row">
        <input
          type="text"
          class="ticker-input market-input"
          placeholder="${escapeHtml(config.searchPlaceholder)}"
          value="${escapeHtml(state.inputValue)}"
          data-market-input
          spellcheck="false"
          autocomplete="off"
        />
        <button type="button" class="ticker-submit-button" data-market-action="search">Search</button>
      </div>
      <p class="ticker-search-help">${escapeHtml(config.searchHelp)}</p>
    </section>
  `;
}

function renderStatusBanner(config, state) {
  if (state.error) {
    return `
      <section class="status-note warning-note ticker-status-banner">
        <p>${escapeHtml(state.error)}</p>
      </section>
    `;
  }

  if (state.isLoading && state.symbol) {
    return `
      <section class="status-note ticker-status-banner">
        <p>Loading ${escapeHtml(state.symbol)} on ${escapeHtml(state.duration.toUpperCase())}...</p>
      </section>
    `;
  }

  if (!state.symbol) {
    return `
      <section class="status-note empty-state ticker-status-banner">
        <p>${escapeHtml(config.emptyMessage)}</p>
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
        <span>Asset</span>
        <strong>${escapeHtml(formatAssetType(info.quoteType))}</strong>
      </article>
      <article class="rate-chip">
        <span>Last</span>
        <strong>${escapeHtml(formatPrice(lastPrice.Close, currency))}</strong>
      </article>
      <article class="rate-chip">
        <span>Change</span>
        <strong class="${changeClass}">${escapeHtml(formatPercent(changePercent))}</strong>
      </article>
      <article class="rate-chip">
        <span>High / Low</span>
        <strong>${escapeHtml(formatPrice(lastPrice.High, currency))} / ${escapeHtml(formatPrice(lastPrice.Low, currency))}</strong>
      </article>
      <article class="rate-chip rate-chip-meta">
        <span>Source</span>
        <strong>${escapeHtml(payload.servedFrom ?? "unknown")} · ${escapeHtml(formatTimestamp(payload.lastSuccessfulRefresh))}</strong>
      </article>
    </section>
  `;
}

function renderBody(config, state) {
  if (!state.payload?.data) {
    return "";
  }

  const info = state.payload.data.info || {};
  return `
    ${renderMetrics(state.payload)}

    <section class="chart-shell">
      <div class="chart-header">
        <div>
          <p class="eyebrow">${escapeHtml(state.symbol)}</p>
          <h3>${escapeHtml(info.longName || state.symbol)}</h3>
        </div>
        <div class="inline-actions">
          ${renderDurationSelector(state)}
        </div>
      </div>
      <div class="chart-placeholder market-panel-chart" data-market-chart></div>
    </section>
  `;
}

function renderView(config, container) {
  const state = config.getState(container);
  const title = state.payload?.data?.info?.longName || config.title;

  container.innerHTML = `
    <div class="module-card market-panel-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(config.categoryLabel)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="inline-actions">
          ${iconButton({
            icon: "refreshCw",
            label: `Refresh ${config.title.toLowerCase()} data`,
            dataset: 'data-market-action="refresh"',
          })}
        </div>
      </div>

      ${renderPresetBar(config, state)}
      ${renderSearchBar(config, state)}
      ${renderStatusBanner(config, state)}
      ${renderBody(config, state)}
    </div>
  `;
}

function mountChart(container, historyData) {
  if (!historyData?.length) {
    container.innerHTML = `
      <div class="chart-fallback">
        <strong>Data unavailable</strong>
        <p>No historical data is available for this symbol.</p>
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
      });

      const lineSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const chartData = historyData
        .map((point) => ({
          time: point.Date ? point.Date.split("T")[0] : null,
          value: point.Close,
        }))
        .filter((point) => point.time && typeof point.value === "number");

      lineSeries.setData(chartData);
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

async function fetchData(config, container, { refresh = false } = {}) {
  const state = config.getState(container);
  if (!state.symbol) {
    renderView(config, container);
    return;
  }

  state.isLoading = true;
  state.error = "";
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  renderView(config, container);

  try {
    const payload = await window.financeDesktop.getTickerData({
      ticker: state.symbol,
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
    state.error = error?.message || `Unable to load ${config.title.toLowerCase()} data.`;
  } finally {
    if (requestId !== state.requestId) {
      return;
    }

    state.isLoading = false;
    renderView(config, container);

    const chartContainer = container.querySelector("[data-market-chart]");
    const history = state.payload?.data?.history || [];
    if (chartContainer && history.length) {
      await mountChart(chartContainer, history);
    }
  }
}

function submitSearch(config, container) {
  const state = config.getState(container);
  const nextSymbol = state.inputValue.trim().toUpperCase();
  if (!nextSymbol) {
    state.error = "Enter a valid symbol before searching.";
    renderView(config, container);
    return;
  }

  state.symbol = nextSymbol;
  state.inputValue = nextSymbol;
  state.payload = null;
  fetchData(config, container);
}

function attachListeners(config, container) {
  if (container.dataset.marketListenersBound === "true") {
    return;
  }

  container.dataset.marketListenersBound = "true";

  container.addEventListener("input", (event) => {
    if (!event.target.matches("[data-market-input]")) {
      return;
    }
    config.getState(container).inputValue = event.target.value;
  });

  container.addEventListener("keydown", (event) => {
    if (event.target.matches("[data-market-input]") && event.key === "Enter") {
      event.preventDefault();
      submitSearch(config, container);
    }
  });

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.matches("[data-market-action='search']")) {
      submitSearch(config, container);
      return;
    }

    if (button.matches("[data-market-action='refresh']")) {
      if (config.getState(container).symbol) {
        fetchData(config, container, { refresh: true });
      }
      return;
    }

    if (button.matches("[data-market-symbol]")) {
      const symbol = button.getAttribute("data-market-symbol");
      if (!symbol) {
        return;
      }
      const state = config.getState(container);
      state.symbol = symbol;
      state.inputValue = symbol;
      state.payload = null;
      fetchData(config, container);
      return;
    }

    if (button.matches("[data-market-duration]")) {
      const duration = button.getAttribute("data-market-duration");
      const state = config.getState(container);
      if (!duration || duration === state.duration) {
        return;
      }
      state.duration = duration;
      renderView(config, container);
      if (state.symbol) {
        fetchData(config, container);
      }
    }
  });
}

export function createMarketExplorerModule(config) {
  const stateByContainer = new WeakMap();

  function getState(container) {
    let state = stateByContainer.get(container);
    if (state) {
      return state;
    }

    state = {
      symbol: config.defaultSymbol,
      inputValue: config.defaultSymbol,
      duration: "6mo",
      isLoading: false,
      error: "",
      payload: null,
      requestId: 0,
    };
    stateByContainer.set(container, state);
    return state;
  }

  const runtimeConfig = { ...config, getState };

  return function renderMarketExplorer(container) {
    addStyleSheet(STYLESHEET_PATH, STYLESHEET_ID);
    getState(container);
    attachListeners(runtimeConfig, container);
    renderView(runtimeConfig, container);
    if (!runtimeConfig.getState(container).payload && !runtimeConfig.getState(container).isLoading) {
      fetchData(runtimeConfig, container);
    }
  };
}
