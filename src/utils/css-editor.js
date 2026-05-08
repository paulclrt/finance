export function addStyleSheet(stylesheetPath, styleSheetID, baseUrl = window.location.href) {
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
  stylesheet.setAttribute("href", new URL(stylesheetPath, baseUrl).href);
  stylesheet.setAttribute("id", `stylesheet-${styleSheetID}`);
  head.appendChild(stylesheet);
  return stylesheet;
}

export function removeStyleSheet(styleSheetID) {
  document.getElementById(`stylesheet-${styleSheetID}`)?.remove();
}
