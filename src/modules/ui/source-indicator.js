function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function getIndicatorTone(servedFrom) {
  const value = String(servedFrom || "").toLowerCase();
  if (value === "remote") {
    return "remote";
  }
  if (value === "cache") {
    return "cache";
  }
  if (value === "stale-cache") {
    return "stale";
  }
  return "unknown";
}

export function renderSourceIndicator(servedFrom, lastSuccessfulRefresh) {
  const tone = getIndicatorTone(servedFrom);
  const title = `${servedFrom || "unknown"}${lastSuccessfulRefresh ? ` • ${lastSuccessfulRefresh}` : ""}`;

  return `
    <span
      class="data-source-indicator data-source-${escapeHtml(tone)}"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(title)}"
    ></span>
  `;
}
