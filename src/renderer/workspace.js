const MIN_MAIN_PERCENT = 22;
const MIN_RIGHT_PERCENT = 22;
const DEFAULT_LAYOUT = {
  rightWidth: 30,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function setupWorkspaceResizing(workspaceElement, options = {}) {
  if (!workspaceElement) {
    return;
  }

  const rightSplitter = workspaceElement.querySelector('[data-splitter="right"]');
  if (!rightSplitter) {
    return;
  }

  const initialLayout = options.initialLayout ?? {};
  const onLayoutChange = typeof options.onLayoutChange === "function" ? options.onLayoutChange : () => {};

  let rightWidth = clamp(initialLayout.rightWidth ?? DEFAULT_LAYOUT.rightWidth, MIN_RIGHT_PERCENT, 100 - MIN_MAIN_PERCENT);
  let saveTimer = null;

  function emitLayoutChange() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(() => {
      onLayoutChange({
        rightWidth,
      });
    }, 550);
  }

  function renderLayout() {
    const mainWidth = 100 - rightWidth;
    workspaceElement.style.gridTemplateColumns = `${mainWidth}% 8px ${rightWidth}%`;
  }

  rightSplitter.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    rightSplitter.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const bounds = workspaceElement.getBoundingClientRect();
      const pointerPercent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      rightWidth = clamp(100 - pointerPercent, MIN_RIGHT_PERCENT, 100 - MIN_MAIN_PERCENT);
      renderLayout();
    };

    const onUp = () => {
      rightSplitter.removeEventListener("pointermove", onMove);
      rightSplitter.removeEventListener("pointerup", onUp);
      emitLayoutChange();
    };

    rightSplitter.addEventListener("pointermove", onMove);
    rightSplitter.addEventListener("pointerup", onUp);
  });

  renderLayout();

  return {
    getLayout: () => ({
      rightWidth,
    }),
  };
}
