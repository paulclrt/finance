import { defaultEnabledWidgetIds, moduleRegistry, widgetCatalog } from "../modules/index.js";
import { setupCredentialsManager } from "./credentials.js";
import {
  collectWidgetIds,
  createWidgetNode,
  getNodeAtPath,
  insertWidgetAroundTarget,
  normalizeSplitNode,
  parseLayoutTree,
  parseNodePath,
  removeWidgetFromTree,
  setActiveTab,
  undockTab,
  updateNodeAtPath,
} from "./workspace/layout-tree.js";
import { renderBoardEmptyState, renderDockNode, renderTopbarMeta } from "./workspace/render.js";
import { createWidgetHostManager } from "./workspace/widget-hosts.js";

let currentAppConfig = null;
let currentEnabledWidgetIds = [...defaultEnabledWidgetIds];
let currentLayoutTree = null;
let dragWidgetId = null;
let splitResizeState = null;
const { getOrCreateWidgetHost } = createWidgetHostManager(moduleRegistry);

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

function serializeLayoutTree() {
  return JSON.stringify(currentLayoutTree ?? null);
}

async function persistWidgets() {
  await window.financeDesktop.saveWidgetsConfig({
    enabled: currentEnabledWidgetIds,
    layout: serializeLayoutTree(),
  });
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

  renderTopbarMeta(currentEnabledWidgetIds.length);

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
