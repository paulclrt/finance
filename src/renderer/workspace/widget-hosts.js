export function createWidgetHostManager(moduleRegistry) {
  const widgetHostCache = new Map();

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

  return {
    getOrCreateWidgetHost,
  };
}
