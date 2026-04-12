export function addStyleSheet(stylesheetPath, styleSheetID) {
  const head = document.querySelector("head");
  if (!head) {
    return null;
  }

  const existing = document.getElementById(`stylesheet-${styleSheetID}`);
  if (existing) {
    return existing;
  }

  const stylesheet = document.createElement("link");
  stylesheet.setAttribute("rel", "stylesheet");
  stylesheet.setAttribute("href", stylesheetPath);
  stylesheet.setAttribute("id", `stylesheet-${styleSheetID}`);
  head.appendChild(stylesheet);
  return stylesheet;
}

export function removeStyleSheet(styleSheetID) {
  document.getElementById(`stylesheet-${styleSheetID}`)?.remove();
}
