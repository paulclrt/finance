import { getWidgetById } from "../../modules/index.js";
import { renderIcon } from "../icons.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function renderBoardEmptyState() {
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

export function renderTopbarMeta(widgetCount) {
  const meta = document.querySelector("[data-topbar-meta]");
  if (!meta) {
    return;
  }

  meta.innerHTML = `
    <span class="status-dot"></span>
    <span>local cache</span>
    <span class="topbar-pill">${widgetCount} widgets</span>
  `;
}

export function renderDockZones(targetId) {
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

export function renderTileFrame({ widgetId, title = "", tabs = "", contentTargetId, showTitle = true }) {
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

export function renderDockNode(node, path = []) {
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
