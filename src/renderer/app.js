import { defaultEnabledWidgetIds, getWidgetById, moduleRegistry, widgetCatalog } from "../modules/index.js";
import { setupCredentialsManager } from "./credentials.js";
import { renderIcon } from "./icons.js";

let currentAppConfig = null;
let currentEnabledWidgetIds = [...defaultEnabledWidgetIds];
let currentLayoutTree = null;
let dragWidgetId = null;
let splitResizeState = null;
const widgetHostCache = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function parseEnabledWidgets(config) {
  if (config?.widgets?.enabled === "") {
    return [];
  }

  const serialized = String(config?.widgets?.enabled || "").trim();
  const parsed = serialized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => widgetCatalog.some((widget) => widget.id === item));

  return parsed.length ? parsed : [...defaultEnabledWidgetIds];
}

function createWidgetNode(widgetId) {
  return { type: "widget", widgetId };
}

function createSplitNode(orientation, children, sizes = []) {
  const safeChildren = children.filter(Boolean);
  const safeSizes =
    sizes.length === safeChildren.length
      ? sizes
      : Array.from({ length: safeChildren.length }, () => 1 / Math.max(safeChildren.length, 1));

  return { type: "split", orientation, children: safeChildren, sizes: safeSizes };
}

function createTabsNode(children, activeWidgetId = null) {
  const safeChildren = children.filter(Boolean);
  const widgetIds = safeChildren.map((child) => child.widgetId).filter(Boolean);
  return {
    type: "tabs",
    children: safeChildren,
    activeWidgetId: widgetIds.includes(activeWidgetId) ? activeWidgetId : widgetIds[0] ?? null,
  };
}

function normalizeSplitNode(node) {
  if (!node || node.type !== "split") {
    return node;
  }

  const children = (node.children ?? []).filter(Boolean);
  if (!children.length) {
    return null;
  }
  if (children.length === 1) {
    return children[0];
  }

  const sizes = node.sizes?.length === children.length ? node.sizes : Array.from({ length: children.length }, () => 1);
  const total = sizes.reduce((sum, value) => sum + value, 0) || children.length;
  return {
    type: "split",
    orientation: node.orientation === "column" ? "column" : "row",
    children,
    sizes: sizes.map((value) => value / total),
  };
}

function normalizeTabsNode(node) {
  if (!node || node.type !== "tabs") {
    return node;
  }

  const children = (node.children ?? []).filter(Boolean);
  if (!children.length) {
    return null;
  }
  if (children.length === 1) {
    return children[0];
  }

  const ids = children.map((child) => child.widgetId);
  return {
    type: "tabs",
    children,
    activeWidgetId: ids.includes(node.activeWidgetId) ? node.activeWidgetId : ids[0],
  };
}

function buildDefaultLayoutTree(widgetIds) {
  if (!widgetIds.length) {
    return null;
  }
  if (widgetIds.length === 1) {
    return createWidgetNode(widgetIds[0]);
  }
  if (widgetIds.length === 2) {
    return createSplitNode(
      "row",
      widgetIds.map((widgetId) => createWidgetNode(widgetId)),
      [0.7, 0.3],
    );
  }

  let tree = createSplitNode(
    "row",
    [createWidgetNode(widgetIds[0]), createWidgetNode(widgetIds[1])],
    [0.7, 0.3],
  );

  for (const widgetId of widgetIds.slice(2)) {
    tree = createSplitNode("row", [tree, createWidgetNode(widgetId)], [0.76, 0.24]);
  }

  return tree;
}

function collectWidgetIds(node, output = []) {
  if (!node) {
    return output;
  }

  if (node.type === "widget") {
    output.push(node.widgetId);
    return output;
  }

  for (const child of node.children ?? []) {
    collectWidgetIds(child, output);
  }
  return output;
}

function subtreeContainsWidget(node, widgetId) {
  if (!node) {
    return false;
  }
  if (node.type === "widget") {
    return node.widgetId === widgetId;
  }
  return (node.children ?? []).some((child) => subtreeContainsWidget(child, widgetId));
}

function pruneLayoutTree(node, allowedIds) {
  if (!node) {
    return null;
  }

  if (node.type === "widget") {
    return allowedIds.has(node.widgetId) ? node : null;
  }

  const children = (node.children ?? []).map((child) => pruneLayoutTree(child, allowedIds)).filter(Boolean);
  if (!children.length) {
    return null;
  }

  if (node.type === "tabs") {
    return normalizeTabsNode({ ...node, children });
  }

  return normalizeSplitNode({ ...node, children });
}

function appendMissingWidgetsToTree(tree, widgetIds) {
  const existing = new Set(collectWidgetIds(tree));
  const missing = widgetIds.filter((widgetId) => !existing.has(widgetId));
  if (!missing.length) {
    return tree;
  }
  if (!tree) {
    return buildDefaultLayoutTree(missing);
  }

  let nextTree = tree;
  for (const widgetId of missing) {
    nextTree = createSplitNode("row", [nextTree, createWidgetNode(widgetId)], [0.76, 0.24]);
  }
  return nextTree;
}

function parseLayoutTree(config, enabledWidgetIds) {
  const raw = String(config?.widgets?.layout || "").trim();
  let parsed = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error("Unable to parse saved widget layout:", error);
    }
  }

  const allowedIds = new Set(enabledWidgetIds);
  const pruned = pruneLayoutTree(parsed, allowedIds);
  return appendMissingWidgetsToTree(pruned, enabledWidgetIds) ?? buildDefaultLayoutTree(enabledWidgetIds);
}

function serializeLayoutTree() {
  return JSON.stringify(currentLayoutTree ?? null);
}

function parseNodePath(value) {
  return String(value ?? "")
    .split(".")
    .filter((part) => part !== "")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isInteger(part) && part >= 0);
}

function getNodeAtPath(node, path) {
  let currentNode = node;
  for (const index of path) {
    if (!currentNode || !Array.isArray(currentNode.children) || !currentNode.children[index]) {
      return null;
    }
    currentNode = currentNode.children[index];
  }
  return currentNode;
}

function updateNodeAtPath(node, path, updater) {
  if (!path.length) {
    return updater(node);
  }
  if (!node || !Array.isArray(node.children)) {
    return node;
  }

  const [head, ...tail] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (index === head ? updateNodeAtPath(child, tail, updater) : child)),
  };
}

function renderBoardEmptyState() {
  const board = document.querySelector("[data-widget-board]");
  if (!board) {
    return;
  }

  board.innerHTML = `
    <section class="widget-empty-state">
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Windows</p>
            <h2>No widget selected</h2>
          </div>
        </div>
        <section class="status-note empty-state">
          <p>Enable a widget from the native Windows menu to add it to your workspace.</p>
        </section>
      </div>
    </section>
  `;
}

function renderTopbarMeta() {
  const meta = document.querySelector("[data-topbar-meta]");
  if (!meta) {
    return;
  }

  meta.innerHTML = `
    <span class="status-dot"></span>
    <span>local cache</span>
    <span class="topbar-pill">${currentEnabledWidgetIds.length} widgets</span>
  `;
}

async function persistWidgets() {
  await window.financeDesktop.saveWidgetsConfig({
    enabled: currentEnabledWidgetIds,
    layout: serializeLayoutTree(),
  });
}

function getOrCreateWidgetHost(widgetId) {
  let host = widgetHostCache.get(widgetId);
  if (host) {
    return host;
  }

  host = document.createElement("div");
  host.className = "widget-host";
  host.dataset.widgetHost = widgetId;
  widgetHostCache.set(widgetId, host);

  const definition = moduleRegistry[widgetId];
  if (definition?.render) {
    definition.render(host);
  }

  return host;
}

function removeWidgetFromTree(node, widgetId) {
  if (!node) {
    return null;
  }

  if (node.type === "widget") {
    return node.widgetId === widgetId ? null : node;
  }

  const children = (node.children ?? []).map((child) => removeWidgetFromTree(child, widgetId)).filter(Boolean);
  if (!children.length) {
    return null;
  }

  if (node.type === "tabs") {
    return normalizeTabsNode({ ...node, children });
  }

  const nextSizes = (node.sizes ?? []).filter((_, index) => (node.children?.[index] ? children.includes(node.children[index]) : false));
  return normalizeSplitNode({ ...node, children, sizes: nextSizes });
}

function addWidgetAsTab(node, targetId, draggedNode) {
  if (!node) {
    return null;
  }

  if (node.type === "widget") {
    if (node.widgetId !== targetId) {
      return node;
    }
    return createTabsNode([node, draggedNode], draggedNode.widgetId);
  }

  if (node.type === "tabs") {
    if (!subtreeContainsWidget(node, targetId)) {
      return node;
    }
    const children = [...node.children];
    if (!children.some((child) => child.widgetId === draggedNode.widgetId)) {
      children.push(draggedNode);
    }
    return createTabsNode(children, draggedNode.widgetId);
  }

  let didChange = false;
  const children = (node.children ?? []).map((child) => {
    const nextChild = addWidgetAsTab(child, targetId, draggedNode);
    if (nextChild !== child) {
      didChange = true;
    }
    return nextChild;
  });
  return didChange ? normalizeSplitNode({ ...node, children }) : node;
}

function insertWidgetAroundTarget(node, targetId, draggedNode, side) {
  if (!node) {
    return draggedNode;
  }

  if (side === "center") {
    return addWidgetAsTab(node, targetId, draggedNode);
  }

  if (node.type === "widget") {
    if (node.widgetId !== targetId) {
      return node;
    }

    const orientation = side === "top" || side === "bottom" ? "column" : "row";
    const newIsFirst = side === "left" || side === "top";
    const children = newIsFirst ? [draggedNode, node] : [node, draggedNode];
    const sizes = newIsFirst ? [0.32, 0.68] : [0.68, 0.32];
    return createSplitNode(orientation, children, sizes);
  }

  if (node.type === "tabs") {
    if (subtreeContainsWidget(node, targetId)) {
      const orientation = side === "top" || side === "bottom" ? "column" : "row";
      const newIsFirst = side === "left" || side === "top";
      const children = newIsFirst ? [draggedNode, node] : [node, draggedNode];
      const sizes = newIsFirst ? [0.32, 0.68] : [0.68, 0.32];
      return createSplitNode(orientation, children, sizes);
    }
    return node;
  }

  let didChange = false;
  const children = (node.children ?? []).map((child) => {
    const nextChild = insertWidgetAroundTarget(child, targetId, draggedNode, side);
    if (nextChild !== child) {
      didChange = true;
    }
    return nextChild;
  });
  return didChange ? normalizeSplitNode({ ...node, children }) : node;
}

function setActiveTab(node, widgetId) {
  if (!node) {
    return null;
  }

  if (node.type === "tabs") {
    if (node.children.some((child) => child.widgetId === widgetId)) {
      return { ...node, activeWidgetId: widgetId };
    }
    return {
      ...node,
      children: node.children.map((child) => setActiveTab(child, widgetId)),
    };
  }

  if (node.type === "split") {
    return {
      ...node,
      children: node.children.map((child) => setActiveTab(child, widgetId)),
    };
  }

  return node;
}

function undockTab(node, widgetId) {
  if (!node) {
    return null;
  }

  if (node.type === "tabs" && node.children.some((child) => child.widgetId === widgetId)) {
    if (node.children.length <= 1) {
      return node;
    }

    const remainingChildren = node.children.filter((child) => child.widgetId !== widgetId);
    const remainingTabs = normalizeTabsNode({
      ...node,
      children: remainingChildren,
      activeWidgetId: remainingChildren[0]?.widgetId ?? null,
    });

    return createSplitNode("row", [remainingTabs, createWidgetNode(widgetId)], [0.68, 0.32]);
  }

  if (node.type === "split") {
    return normalizeSplitNode({
      ...node,
      children: node.children.map((child) => undockTab(child, widgetId)),
    });
  }

  if (node.type === "tabs") {
    return normalizeTabsNode({
      ...node,
      children: node.children.map((child) => undockTab(child, widgetId)),
    });
  }

  return node;
}

function closeWidget(widgetId) {
  currentEnabledWidgetIds = currentEnabledWidgetIds.filter((item) => item !== widgetId);
  currentLayoutTree = removeWidgetFromTree(currentLayoutTree, widgetId);
}

function handleDockDrop(sourceId, targetId, side) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return;
  }

  const draggedNode = createWidgetNode(sourceId);
  const withoutSource = removeWidgetFromTree(currentLayoutTree, sourceId);
  currentLayoutTree = insertWidgetAroundTarget(withoutSource, targetId, draggedNode, side);
  currentEnabledWidgetIds = collectWidgetIds(currentLayoutTree, []);
}

function renderDockZones(targetId) {
  return `
    <div class="widget-dock-zones">
      <div class="widget-dock-zone zone-top" data-drop-target="${escapeHtml(targetId)}" data-drop-side="top" title="Split horizontally and dock above"></div>
      <div class="widget-dock-zone zone-right" data-drop-target="${escapeHtml(targetId)}" data-drop-side="right" title="Split vertically and dock right"></div>
      <div class="widget-dock-zone zone-bottom" data-drop-target="${escapeHtml(targetId)}" data-drop-side="bottom" title="Split horizontally and dock below"></div>
      <div class="widget-dock-zone zone-left" data-drop-target="${escapeHtml(targetId)}" data-drop-side="left" title="Split vertically and dock left"></div>
      <div class="widget-dock-zone zone-center" data-drop-target="${escapeHtml(targetId)}" data-drop-side="center" title="Group as tabs"></div>
    </div>
  `;
}

function renderTileFrame({ widgetId, title = "", tabs = "", contentTargetId, showTitle = true }) {
  return `
    <section class="widget-tile" data-widget-tile="${escapeHtml(widgetId)}">
      ${tabs}
      <div class="widget-tile-bar">
        <div class="widget-tile-head ${showTitle ? "" : "is-tabs-only"}">
          <div class="widget-tile-handle" data-drag-source="${escapeHtml(widgetId)}" draggable="true" title="Drag to move this widget.">
            <span class="widget-drag-dot"></span>
            <span class="widget-drag-dot"></span>
            <span class="widget-drag-dot"></span>
            <span class="widget-drag-dot"></span>
          </div>
          <div class="widget-tile-meta ${showTitle ? "" : "is-hidden"}">
            <strong>${escapeHtml(title)}</strong>
          </div>
        </div>
        <button class="icon-button widget-close-button" type="button" data-close-widget="${escapeHtml(widgetId)}" aria-label="Close widget" title="Close widget">
          ${renderIcon("x")}
        </button>
      </div>
      ${renderDockZones(widgetId)}
      <div class="widget-tile-content" data-widget-content="${escapeHtml(contentTargetId)}"></div>
    </section>
  `;
}

function renderDockNode(node, path = []) {
  if (!node) {
    return "";
  }

  if (node.type === "widget") {
    const widget = getWidgetById(node.widgetId);
    return renderTileFrame({
      widgetId: node.widgetId,
      title: widget?.title || node.widgetId,
      contentTargetId: node.widgetId,
    });
  }

  if (node.type === "tabs") {
    const activeId = node.activeWidgetId ?? node.children[0]?.widgetId;
    const activeWidget = getWidgetById(activeId);
    const tabs = `
      <div class="widget-tabs">
        ${node.children
          .map((child) => {
            const widget = getWidgetById(child.widgetId);
            return `
              <button class="widget-tab ${child.widgetId === activeId ? "active" : ""}" type="button" data-tab-widget="${escapeHtml(child.widgetId)}" title="${escapeHtml(widget?.description || widget?.title || child.widgetId)}">
                ${escapeHtml(widget?.title || child.widgetId)}
              </button>
            `;
          })
          .join("")}
        <button
          class="icon-button widget-tab-undock-button"
          type="button"
          data-undock-widget="${escapeHtml(activeId)}"
          aria-label="Undock active tab"
          title="Undock active tab"
        >
          ${renderIcon("arrowUpRight")}
        </button>
      </div>
    `;
    return renderTileFrame({
      widgetId: activeId,
      title: activeWidget?.title || activeId,
      tabs,
      contentTargetId: activeId,
      showTitle: false,
    });
  }

  const pathText = path.join(".");
  return `
    <section class="dock-split dock-${escapeHtml(node.orientation)}" data-split-path="${escapeHtml(pathText)}" data-split-orientation="${escapeHtml(node.orientation)}">
      ${(node.children ?? [])
        .map((child, index) => {
          const size = node.sizes?.[index] ?? 1 / Math.max(node.children.length, 1);
          const slot = `
            <div class="dock-slot" style="flex: ${size} 1 0%;">
              ${renderDockNode(child, [...path, index])}
            </div>
          `;

          if (index >= node.children.length - 1) {
            return slot;
          }

          return `
            ${slot}
            <div
              class="dock-resizer dock-resizer-${escapeHtml(node.orientation)}"
              data-split-path="${escapeHtml(pathText)}"
              data-split-index="${index}"
              data-split-orientation="${escapeHtml(node.orientation)}"
              title="Drag to resize panels"
            ></div>
          `;
        })
        .join("")}
    </section>
  `;
}

function startSplitResize(event, handle) {
  const board = document.querySelector("[data-widget-board]");
  const path = parseNodePath(handle.getAttribute("data-split-path"));
  const splitIndex = Number.parseInt(handle.getAttribute("data-split-index") || "", 10);
  const orientation = handle.getAttribute("data-split-orientation");
  const splitElement = handle.closest(".dock-split");
  const splitNode = getNodeAtPath(currentLayoutTree, path);

  if (!board || !splitElement || !splitNode || splitNode.type !== "split" || !Number.isInteger(splitIndex)) {
    return;
  }

  const slots = Array.from(splitElement.querySelectorAll(":scope > .dock-slot"));
  const firstSlot = slots[splitIndex];
  const secondSlot = slots[splitIndex + 1];
  if (!firstSlot || !secondSlot) {
    return;
  }

  const splitRect = splitElement.getBoundingClientRect();
  const firstRect = firstSlot.getBoundingClientRect();
  const secondRect = secondSlot.getBoundingClientRect();
  const totalSize = orientation === "column" ? splitRect.height : splitRect.width;
  const firstSize = orientation === "column" ? firstRect.height : firstRect.width;
  const secondSize = orientation === "column" ? secondRect.height : secondRect.width;

  splitResizeState = {
    path,
    splitIndex,
    orientation,
    totalSize,
    firstSize,
    secondSize,
    startPointer: orientation === "column" ? event.clientY : event.clientX,
  };

  board.classList.add("resize-active");
  document.body.classList.add("resize-active");
}

function handleSplitResizeMove(event) {
  if (!splitResizeState) {
    return;
  }

  const delta = (splitResizeState.orientation === "column" ? event.clientY : event.clientX) - splitResizeState.startPointer;
  const combinedSize = splitResizeState.firstSize + splitResizeState.secondSize;
  const minSize = Math.max(120, combinedSize * 0.15);
  const nextFirst = Math.min(Math.max(splitResizeState.firstSize + delta, minSize), combinedSize - minSize);
  const nextSecond = combinedSize - nextFirst;

  currentLayoutTree = updateNodeAtPath(currentLayoutTree, splitResizeState.path, (node) => {
    if (!node || node.type !== "split") {
      return node;
    }

    const nextSizes = [...(node.sizes ?? Array.from({ length: node.children.length }, () => 1 / node.children.length))];
    const otherTotal = nextSizes.reduce(
      (sum, value, index) => (index === splitResizeState.splitIndex || index === splitResizeState.splitIndex + 1 ? sum : sum + value),
      0,
    );
    const available = Math.max(1e-6, 1 - otherTotal);
    nextSizes[splitResizeState.splitIndex] = available * (nextFirst / combinedSize);
    nextSizes[splitResizeState.splitIndex + 1] = available * (nextSecond / combinedSize);
    return normalizeSplitNode({ ...node, sizes: nextSizes });
  });

  renderWorkspace();
}

async function finishSplitResize() {
  if (!splitResizeState) {
    return;
  }

  splitResizeState = null;
  document.body.classList.remove("resize-active");
  document.querySelector("[data-widget-board]")?.classList.remove("resize-active");

  try {
    await persistWidgets();
  } catch (error) {
    console.error("Unable to save resized widget layout:", error);
  }
}

function bindBoardInteractions() {
  const board = document.querySelector("[data-widget-board]");
  if (!board) {
    return;
  }

  board.querySelectorAll("[data-close-widget]").forEach((button) => {
    button.addEventListener("click", async () => {
      const widgetId = button.getAttribute("data-close-widget");
      if (!widgetId) {
        return;
      }

      closeWidget(widgetId);
      renderWorkspace();
      try {
        await persistWidgets();
      } catch (error) {
        console.error("Unable to save widget layout:", error);
      }
    });
  });

  board.querySelectorAll("[data-tab-widget]").forEach((button) => {
    button.addEventListener("click", async () => {
      const widgetId = button.getAttribute("data-tab-widget");
      if (!widgetId) {
        return;
      }

      currentLayoutTree = setActiveTab(currentLayoutTree, widgetId);
      renderWorkspace();
      try {
        await persistWidgets();
      } catch (error) {
        console.error("Unable to save active tab:", error);
      }
    });
  });

  board.querySelectorAll("[data-undock-widget]").forEach((button) => {
    button.addEventListener("click", async () => {
      const widgetId = button.getAttribute("data-undock-widget");
      if (!widgetId) {
        return;
      }

      currentLayoutTree = undockTab(currentLayoutTree, widgetId);
      currentEnabledWidgetIds = collectWidgetIds(currentLayoutTree, []);
      renderWorkspace();
      try {
        await persistWidgets();
      } catch (error) {
        console.error("Unable to save undocked tab layout:", error);
      }
    });
  });

  board.querySelectorAll("[data-drag-source]").forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      const widgetId = handle.getAttribute("data-drag-source");
      if (!widgetId) {
        return;
      }
      dragWidgetId = widgetId;
      handle.closest(".widget-tile")?.classList.add("dragging");
      board.classList.add("drag-active");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", widgetId);
    });

    handle.addEventListener("dragend", () => {
      dragWidgetId = null;
      handle.closest(".widget-tile")?.classList.remove("dragging");
      board.classList.remove("drag-active");
      board.querySelectorAll(".widget-dock-zone").forEach((item) => item.classList.remove("drop-active"));
    });
  });

  board.querySelectorAll("[data-drop-target]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("drop-active");
      event.dataTransfer.dropEffect = "move";
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drop-active");
    });

    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      zone.classList.remove("drop-active");
      const targetId = zone.getAttribute("data-drop-target");
      const side = zone.getAttribute("data-drop-side");
      const sourceId = event.dataTransfer.getData("text/plain") || dragWidgetId;
      handleDockDrop(sourceId, targetId, side);
      renderWorkspace();
      try {
        await persistWidgets();
      } catch (error) {
        console.error("Unable to save widget layout:", error);
      }
    });
  });

  board.querySelectorAll("[data-split-index]").forEach((handle) => {
    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startSplitResize(event, handle);
    });
  });
}

function renderWorkspace() {
  const board = document.querySelector("[data-widget-board]");
  if (!board) {
    return;
  }

  renderTopbarMeta();

  if (!currentEnabledWidgetIds.length || !currentLayoutTree) {
    renderBoardEmptyState();
    return;
  }

  board.innerHTML = renderDockNode(currentLayoutTree);

  for (const widgetId of collectWidgetIds(currentLayoutTree, [])) {
    const container = board.querySelector(`[data-widget-content="${widgetId}"]`);
    if (!container) {
      continue;
    }
    const host = getOrCreateWidgetHost(widgetId);
    container.replaceChildren(host);
  }

  bindBoardInteractions();
}

function applyConfig(config) {
  currentAppConfig = config;
  currentEnabledWidgetIds = parseEnabledWidgets(config);
  currentLayoutTree = parseLayoutTree(config, currentEnabledWidgetIds);
  renderWorkspace();
}

async function initializeApp() {
  setupCredentialsManager();

  try {
    currentAppConfig = await window.financeDesktop.getAppConfig();
  } catch (error) {
    console.error("Unable to load app config:", error);
  }

  currentEnabledWidgetIds = parseEnabledWidgets(currentAppConfig);
  currentLayoutTree = parseLayoutTree(currentAppConfig, currentEnabledWidgetIds);
  renderWorkspace();

  window.financeDesktop.onAppConfigUpdated((config) => {
    applyConfig(config);
  });
}

document.addEventListener("mousemove", (event) => {
  handleSplitResizeMove(event);
});

document.addEventListener("mouseup", async () => {
  await finishSplitResize();
});

initializeApp();
