const MIN_MAIN_PERCENT = 45;
const MIN_RIGHT_PERCENT = 22;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function setupWorkspaceResizing(workspaceElement) {
  if (!workspaceElement) {
    return;
  }

  const rightSplitter = workspaceElement.querySelector('[data-splitter="right"]');
  if (!rightSplitter) {
    return;
  }

  let rightWidth = 30;

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
    };

    rightSplitter.addEventListener("pointermove", onMove);
    rightSplitter.addEventListener("pointerup", onUp);
  });

  renderLayout();
}
