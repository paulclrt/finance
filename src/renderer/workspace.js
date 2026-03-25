const MIN_PANE_PERCENT = 12;
const MIN_BOTTOM_PERCENT = 18;
const MAX_BOTTOM_PERCENT = 82;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function setupWorkspaceResizing(workspaceElement) {
  if (!workspaceElement) {
    return;
  }

  const centerPane = workspaceElement.querySelector(".pane-center");
  const leftSplitter = workspaceElement.querySelector('[data-splitter="left"]');
  const rightSplitter = workspaceElement.querySelector('[data-splitter="right"]');
  const bottomSplitter = workspaceElement.querySelector('[data-splitter="bottom"]');

  let leftWidth = 23;
  let rightWidth = 24;
  let bottomHeight = 34;

  function renderLayout() {
    const centerWidth = 100 - leftWidth - rightWidth;
    workspaceElement.style.gridTemplateColumns = `${leftWidth}% 8px ${centerWidth}% 8px ${rightWidth}%`;
    centerPane.style.gridTemplateRows = `${100 - bottomHeight}% 8px ${bottomHeight}%`;
  }

  function bindHorizontalDrag(splitter, side) {
    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        const bounds = workspaceElement.getBoundingClientRect();
        const pointerPercent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;

        if (side === "left") {
          leftWidth = clamp(pointerPercent, MIN_PANE_PERCENT, 100 - rightWidth - MIN_PANE_PERCENT);
        }

        if (side === "right") {
          rightWidth = clamp(100 - pointerPercent, MIN_PANE_PERCENT, 100 - leftWidth - MIN_PANE_PERCENT);
        }

        renderLayout();
      };

      const onUp = () => {
        splitter.removeEventListener("pointermove", onMove);
        splitter.removeEventListener("pointerup", onUp);
      };

      splitter.addEventListener("pointermove", onMove);
      splitter.addEventListener("pointerup", onUp);
    });
  }

  bottomSplitter.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    bottomSplitter.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const bounds = centerPane.getBoundingClientRect();
      const pointerPercent = ((bounds.bottom - moveEvent.clientY) / bounds.height) * 100;
      bottomHeight = clamp(pointerPercent, MIN_BOTTOM_PERCENT, MAX_BOTTOM_PERCENT);
      renderLayout();
    };

    const onUp = () => {
      bottomSplitter.removeEventListener("pointermove", onMove);
      bottomSplitter.removeEventListener("pointerup", onUp);
    };

    bottomSplitter.addEventListener("pointermove", onMove);
    bottomSplitter.addEventListener("pointerup", onUp);
  });

  bindHorizontalDrag(leftSplitter, "left");
  bindHorizontalDrag(rightSplitter, "right");
  renderLayout();
}
