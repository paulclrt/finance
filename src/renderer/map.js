const DURATION_OPTIONS = [
  { value: "5d", label: "1W" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "max", label: "All" },
];

const state = {
  configs: { default: [], custom: [] },
  selectedFile: "",
  duration: "5d",
  payload: null,
  loading: false,
  error: "",
  groupOpen: {
    default: true,
    custom: true,
  },
};

let resizeFrame = null;

function renderTrashIcon() {
  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatMoney(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  return value.toFixed(0);
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

function buildTickerHoverTitle(node) {
  return [
    `${node.label} (${node.symbol})`,
    `Change: ${formatPercent(node.changePercent)}`,
    `Last: ${formatPrice(node.lastPrice, node.currency)}`,
    `Market cap: ${formatMoney(node.marketCap)}`,
    `Type: ${formatAssetType(node.quoteType)}`,
    `Source: ${node.servedFrom || "unknown"}`,
    `Updated: ${node.lastSuccessfulRefresh || "Unknown"}`,
  ].join("\n");
}

function getTileStyle(changePercent) {
  const value = Math.max(-12, Math.min(12, Number(changePercent) || 0));
  const strength = Math.abs(value) / 12;

  if (Math.abs(value) < 0.3) {
    return {
      background: "hsl(210 20% 90%)",
      borderColor: "rgba(148, 163, 184, 0.45)",
      color: "#0f172a",
    };
  }

  if (value >= 0) {
    return {
      background: `hsl(145 45% ${92 - strength * 30}%)`,
      borderColor: "rgba(5, 150, 105, 0.35)",
      color: "#0f172a",
    };
  }

  return {
    background: `hsl(8 58% ${92 - strength * 28}%)`,
    borderColor: "rgba(220, 38, 38, 0.28)",
    color: "#111827",
  };
}

function renderDurationSelector() {
  const container = document.querySelector("[data-map-duration-selector]");
  if (!container) {
    return;
  }

  container.innerHTML = DURATION_OPTIONS.map(
    (option) => `
      <button
        class="market-duration-option ${option.value === state.duration ? "active" : ""}"
        type="button"
        data-map-duration="${escapeHtml(option.value)}"
      >
        ${escapeHtml(option.label)}
      </button>
    `,
  ).join("");
}

function renderConfigList() {
  const container = document.querySelector("[data-map-config-list]");
  if (!container) {
    return;
  }

  const renderGroup = (groupKey, label) => {
    const items = state.configs[groupKey] ?? [];
    const isOpen = state.groupOpen[groupKey] !== false;
    return `
      <section class="map-config-group">
        <button class="map-config-group-toggle" type="button" data-map-group-toggle="${escapeHtml(groupKey)}" aria-expanded="${isOpen ? "true" : "false"}">
          <span>${escapeHtml(label)}</span>
          <span class="muted">${items.length}</span>
        </button>
        <div class="map-config-group-body ${isOpen ? "open" : ""}">
          ${
            items.length
              ? items
                  .map(
                    (config) => `
                      <div class="map-config-item ${config.fileName === state.selectedFile ? "active" : ""} ${config.exists === false ? "missing" : ""}" data-map-file="${escapeHtml(config.fileName)}" role="button" tabindex="0">
                        <div class="map-config-item-row">
                          <strong>${escapeHtml(config.title)}</strong>
                          ${
                            groupKey === "custom"
                              ? `
                                <button
                                  class="map-config-delete"
                                  type="button"
                                  data-map-delete="${escapeHtml(config.fileName)}"
                                  title="Remove custom map"
                                  aria-label="Remove custom map"
                                >
                                  ${renderTrashIcon()}
                                </button>
                              `
                              : ""
                          }
                        </div>
                        <span class="muted">${escapeHtml(config.fileName)}</span>
                        ${config.exists === false ? '<span class="map-config-missing">File not found</span>' : ""}
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="status-note empty-state"><p>No ${escapeHtml(label.toLowerCase())} maps.</p></div>`
          }
        </div>
      </section>
    `;
  };

  container.innerHTML =
    renderGroup("default", "Default") +
    renderGroup("custom", "Custom");
}

function renderStatus() {
  const status = document.querySelector("[data-map-status]");
  const title = document.querySelector("[data-map-title]");
  if (title) {
    title.textContent = state.payload?.title || "Market map";
  }
  if (!status) {
    return;
  }

  if (state.error) {
    status.className = "status-note warning-note map-status";
    status.innerHTML = `<p>${escapeHtml(state.error)}</p>`;
    return;
  }

  if (state.loading) {
    status.className = "status-note map-status";
    status.innerHTML = `<p>Loading ${escapeHtml(state.selectedFile || "map")}...</p>`;
    return;
  }

  if (!state.payload) {
    status.className = "status-note empty-state map-status";
    status.innerHTML = `<p>Select a map file from the left panel to render the treemap.</p>`;
    return;
  }

  status.className = "status-note map-status";
  const tone =
    state.payload.servedFrom === "remote" ? "remote" : state.payload.servedFrom?.includes("cache") ? "cache" : "unknown";
  status.innerHTML = `<p><span class="data-source-indicator data-source-${escapeHtml(tone)}" title="${escapeHtml(state.payload.servedFrom || "unknown")}"></span> ${escapeHtml(state.payload.symbolCount)} symbols · ${escapeHtml(state.payload.duration.toUpperCase())} · ${escapeHtml(state.payload.generatedAt)}</p>`;
}

function layoutChildren(children, x, y, width, height, depth = 0) {
  const total = children.reduce((sum, child) => sum + Math.max(child.marketCap || 0, 1), 0) || children.length;
  const horizontal = width >= height;
  let offset = 0;

  return children.map((child, index) => {
    const ratio = Math.max(child.marketCap || 0, 1) / total;
    const remaining = horizontal ? width - offset : height - offset;
    const childWidth = horizontal ? (index === children.length - 1 ? remaining : width * ratio) : width;
    const childHeight = horizontal ? height : (index === children.length - 1 ? remaining : height * ratio);
    const rect = {
      x: horizontal ? x + offset : x,
      y: horizontal ? y : y + offset,
      width: Math.max(0, childWidth),
      height: Math.max(0, childHeight),
      node: child,
      depth,
    };
    offset += horizontal ? childWidth : childHeight;
    return rect;
  });
}

function renderTreeNode(node, x, y, width, height, depth = 0) {
  if (width < 10 || height < 10) {
    return "";
  }

  if (node.type === "ticker") {
    const tileStyle = getTileStyle(node.changePercent);
    const small = width < 110 || height < 78;
    const tiny = width < 82 || height < 58;
    const style = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;background:${tileStyle.background};border-color:${tileStyle.borderColor};color:${tileStyle.color};`;
    return `
      <div
        class="map-node map-ticker ${small ? "small" : ""} ${tiny ? "tiny" : ""}"
        style="${style}"
        title="${escapeHtml(buildTickerHoverTitle(node))}"
      >
        <div class="map-ticker-content">
          <div>
            <strong class="map-tile-title">${escapeHtml(tiny ? node.symbol : small ? node.symbol : node.label)}</strong>
            ${small ? "" : `<span class="map-ticker-symbol">${escapeHtml(node.symbol)}</span>`}
          </div>
          <div>
            <div class="map-ticker-change">${escapeHtml(formatPercent(node.changePercent))}</div>
            ${tiny ? "" : small ? "" : `<div class="map-ticker-cap">${escapeHtml(formatMoney(node.marketCap))}</div>`}
          </div>
        </div>
      </div>
    `;
  }

  const headerHeight = Math.min(24, Math.max(14, height * 0.16));
  const innerX = 4;
  const innerY = headerHeight;
  const innerWidth = Math.max(0, width - 8);
  const innerHeight = Math.max(0, height - headerHeight - 4);
  const style = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;
  const childrenRects = layoutChildren(node.children || [], innerX, innerY, innerWidth, innerHeight, depth + 1);
  const hideLabel = height < 42 || width < 90;

  return `
    <div class="map-node map-group" style="${style}">
      ${hideLabel ? "" : `<div class="map-group-label">${escapeHtml(node.label)}</div>`}
      ${childrenRects.map((rect) => renderTreeNode(rect.node, rect.x, rect.y, rect.width, rect.height, depth + 1)).join("")}
    </div>
  `;
}

function renderTreemap() {
  const canvas = document.querySelector("[data-map-canvas]");
  if (!canvas) {
    return;
  }

  if (!state.payload?.tree?.children?.length) {
    canvas.innerHTML = `<div class="status-note empty-state"><p>No market map is loaded yet.</p></div>`;
    return;
  }

  const width = Math.max(0, canvas.clientWidth - 24);
  const height = Math.max(0, canvas.clientHeight - 24);
  if (width < 40 || height < 40) {
    return;
  }
  const root = state.payload.tree;
  const rects = layoutChildren(root.children || [], 0, 0, width, height, 0);

  canvas.innerHTML = `
    <div class="map-root" style="width:${width}px;height:${height}px">
      ${rects.map((rect) => renderTreeNode(rect.node, rect.x, rect.y, rect.width, rect.height)).join("")}
    </div>
  `;
}

async function loadMapConfigs() {
  const result = await window.financeDesktop.listMapConfigs();
  state.configs = result?.groups || { default: [], custom: [] };
  state.selectedFile =
    state.selectedFile ||
    result?.selectedFile ||
    state.configs.default?.[0]?.fileName ||
    state.configs.custom?.[0]?.fileName ||
    "";
  renderConfigList();
  renderStatus();
}

async function loadMapData(refresh = false) {
  if (!state.selectedFile) {
    renderStatus();
    renderTreemap();
    return;
  }

  state.loading = true;
  state.error = "";
  renderStatus();

  try {
    state.payload = await window.financeDesktop.getMapData({
      fileName: state.selectedFile,
      duration: state.duration,
      refresh,
    });
  } catch (error) {
    state.payload = null;
    state.error = error?.message || "Unable to load market map.";
  } finally {
    state.loading = false;
    renderConfigList();
    renderStatus();
    renderTreemap();
  }
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button, [data-map-file]");
    if (!target) {
      return;
    }

    if (target.matches("[data-map-file]")) {
      state.selectedFile = target.getAttribute("data-map-file") || "";
      await loadMapData(false);
      return;
    }

    if (target.matches("[data-map-delete]")) {
      event.preventDefault();
      event.stopPropagation();
      const fileName = target.getAttribute("data-map-delete") || "";
      if (!fileName) {
        return;
      }
      const result = await window.financeDesktop.deleteMapConfig(fileName);
      if (result?.deleted) {
        state.selectedFile = result.selectedFile || "";
        await loadMapConfigs();
        await loadMapData(false);
      }
      return;
    }

    if (target.matches("[data-map-group-toggle]")) {
      const group = target.getAttribute("data-map-group-toggle");
      if (!group) {
        return;
      }
      state.groupOpen[group] = !(state.groupOpen[group] !== false);
      renderConfigList();
      return;
    }

    if (target.matches("[data-map-duration]")) {
      const duration = target.getAttribute("data-map-duration");
      if (!duration || duration === state.duration) {
        return;
      }
      state.duration = duration;
      renderDurationSelector();
      await loadMapData(false);
      return;
    }

    if (target.matches('[data-map-action="import"]')) {
      const result = await window.financeDesktop.importMapConfig();
      if (result?.imported) {
        await loadMapConfigs();
        state.selectedFile = result.fileName || state.selectedFile;
        await loadMapData(false);
      }
      return;
    }

    if (target.matches('[data-map-action="refresh"]')) {
      await loadMapData(true);
    }
  });

  document.addEventListener("keydown", async (event) => {
    const item = event.target.closest("[data-map-file]");
    if (!item || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }
    event.preventDefault();
    state.selectedFile = item.getAttribute("data-map-file") || "";
    await loadMapData(false);
  });

  window.addEventListener("resize", () => {
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = requestAnimationFrame(() => {
      renderTreemap();
      resizeFrame = null;
    });
  });

  const canvas = document.querySelector("[data-map-canvas]");
  if (canvas && "ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(() => {
        renderTreemap();
        resizeFrame = null;
      });
    });
    observer.observe(canvas);
  }
}

async function initializeMapWindow() {
  state.duration = "5d";
  renderDurationSelector();
  bindEvents();
  await loadMapConfigs();
  await loadMapData(false);
}

initializeMapWindow();
