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
  configs: [],
  selectedFile: "",
  duration: "5d",
  payload: null,
  loading: false,
  error: "",
};

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

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getTileColor(changePercent) {
  const value = Math.max(-12, Math.min(12, Number(changePercent) || 0));
  if (value >= 0) {
    const strength = value / 12;
    const lightness = 38 - strength * 14;
    return `hsl(145 70% ${lightness}%)`;
  }
  const strength = Math.abs(value) / 12;
  const lightness = 40 - strength * 12;
  return `hsl(6 75% ${lightness}%)`;
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

  container.innerHTML = state.configs.length
    ? state.configs
        .map(
          (config) => `
            <button class="map-config-item ${config.fileName === state.selectedFile ? "active" : ""}" type="button" data-map-file="${escapeHtml(config.fileName)}">
              <strong>${escapeHtml(config.title)}</strong>
              <span class="muted">${escapeHtml(config.fileName)}</span>
            </button>
          `,
        )
        .join("")
    : `<div class="status-note empty-state"><p>No map XML file loaded yet.</p></div>`;
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
  const horizontal = depth % 2 === 0;
  let offset = 0;

  return children.flatMap((child) => {
    const ratio = Math.max(child.marketCap || 0, 1) / total;
    const childWidth = horizontal ? width * ratio : width;
    const childHeight = horizontal ? height : height * ratio;
    const rect = {
      x: horizontal ? x + offset : x,
      y: horizontal ? y : y + offset,
      width: Math.max(0, childWidth),
      height: Math.max(0, childHeight),
      node: child,
      depth,
    };
    offset += horizontal ? childWidth : childHeight;
    return [rect];
  });
}

function renderTreeNode(node, x, y, width, height, depth = 0) {
  if (width < 24 || height < 24) {
    return "";
  }

  if (node.type === "ticker") {
    const style = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;background:${getTileColor(node.changePercent)};`;
    const small = width < 100 || height < 70;
    return `
      <div
        class="map-node map-ticker"
        style="${style}"
        title="${escapeHtml(node.label)} (${escapeHtml(node.symbol)}) • ${escapeHtml(formatPercent(node.changePercent))} • ${escapeHtml(formatMoney(node.marketCap))}"
      >
        <div class="map-ticker-content">
          <div>
            <strong class="map-tile-title">${escapeHtml(small ? node.symbol : node.label)}</strong>
            ${small ? "" : `<span class="map-ticker-symbol">${escapeHtml(node.symbol)}</span>`}
          </div>
          <div>
            <div class="map-ticker-change">${escapeHtml(formatPercent(node.changePercent))}</div>
            ${small ? "" : `<div class="map-ticker-cap">${escapeHtml(formatMoney(node.marketCap))}</div>`}
          </div>
        </div>
      </div>
    `;
  }

  const headerHeight = 24;
  const innerX = 4;
  const innerY = headerHeight;
  const innerWidth = Math.max(0, width - 8);
  const innerHeight = Math.max(0, height - headerHeight - 4);
  const style = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;
  const childrenRects = layoutChildren(node.children || [], innerX, innerY, innerWidth, innerHeight, depth + 1);

  return `
    <div class="map-node map-group" style="${style}">
      <div class="map-group-label">${escapeHtml(node.label)}</div>
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

  const width = canvas.clientWidth - 16;
  const height = Math.max(560, canvas.clientHeight - 8);
  const root = state.payload.tree;
  const rects = layoutChildren(root.children || [], 0, 0, width, height, 0);

  canvas.innerHTML = `
    <div class="map-root" style="width:${width}px;height:${height}px">
      ${rects.map((rect) => renderTreeNode(rect.node, rect.x, rect.y, rect.width, rect.height)).join("")}
    </div>
  `;
}

async function loadMapConfigs() {
  state.configs = await window.financeDesktop.listMapConfigs();
  if (!state.selectedFile && state.configs.length) {
    state.selectedFile = state.configs[0].fileName;
  }
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
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.matches("[data-map-file]")) {
      state.selectedFile = button.getAttribute("data-map-file") || "";
      await loadMapData(false);
      return;
    }

    if (button.matches("[data-map-duration]")) {
      const duration = button.getAttribute("data-map-duration");
      if (!duration || duration === state.duration) {
        return;
      }
      state.duration = duration;
      renderDurationSelector();
      await loadMapData(false);
      return;
    }

    if (button.matches('[data-map-action="import"]')) {
      const result = await window.financeDesktop.importMapConfig();
      if (result?.imported) {
        await loadMapConfigs();
        state.selectedFile = result.fileName || state.selectedFile;
        await loadMapData(false);
      }
      return;
    }

    if (button.matches('[data-map-action="refresh"]')) {
      await loadMapData(true);
    }
  });

  window.addEventListener("resize", () => {
    renderTreemap();
  });
}

async function initializeMapWindow() {
  state.duration = "5d";
  renderDurationSelector();
  bindEvents();
  await loadMapConfigs();
  await loadMapData(false);
}

initializeMapWindow();
