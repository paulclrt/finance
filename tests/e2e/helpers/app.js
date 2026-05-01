const assert = require("node:assert/strict");

async function waitForFinanceDesktop() {
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        return Boolean(window.financeDesktop);
      }),
    {
      timeout: 15000,
      timeoutMsg: "window.financeDesktop did not become available",
    }
  );
}

async function callFinanceDesktop(path, ...args) {
  await waitForFinanceDesktop();

  const result = await browser.executeAsync((methodPath, methodArgs, done) => {
    let current = window.financeDesktop;
    for (const key of methodPath) {
      current = current?.[key];
    }

    if (typeof current !== "function") {
      done({
        ok: false,
        error: `Resolved target is not callable for ${methodPath.join(".")} (got ${typeof current})`,
      });
      return;
    }

    Promise.resolve()
      .then(() => current(...methodArgs))
      .then((value) => done({ ok: true, value }))
      .catch((error) => done({ ok: false, error: error?.message || String(error) }));
  }, path, args);

  assert.equal(result.ok, true, result.error || `Renderer call failed: ${path.join(".")}`);
  return result.value;
}

async function waitForMainShell() {
  await waitForFinanceDesktop();
  await $("h1=Finance lab").waitForDisplayed();
  await $("[data-widget-board]").waitForDisplayed();
}

async function resetState() {
  await callFinanceDesktop(["test", "resetState"]);
}

async function reloadApp() {
  await browser.execute(() => window.location.reload());
  await waitForMainShell();
}

async function openMapWindow() {
  await callFinanceDesktop(["test", "openMapWindow"]);
}

async function openCredentials() {
  await callFinanceDesktop(["test", "openCredentials"]);
}

async function saveWidgetsConfig({ enabled, layout }) {
  await callFinanceDesktop(["saveWidgetsConfig"], {
    enabled,
    layout: layout ? JSON.stringify(layout) : "",
  });
}

async function waitForWidget(widgetId) {
  await $(`[data-widget-tile="${widgetId}"]`).waitForDisplayed();
}

async function waitForWidgetCount(count) {
  await browser.waitUntil(async () => (await $$("[data-widget-tile]")).length === count, {
    timeout: 10000,
    timeoutMsg: `Expected ${count} widget tiles`,
  });
}

async function switchToNewestWindow() {
  await browser.waitUntil(async () => (await browser.getWindowHandles()).length >= 2, {
    timeout: 10000,
    timeoutMsg: "Expected a second Electron window to open",
  });

  const handles = await browser.getWindowHandles();
  await browser.switchToWindow(handles[handles.length - 1]);
}

function buildTabbedLayout(widgetIds, activeWidgetId = widgetIds[0]) {
  return {
    type: "tabs",
    children: widgetIds.map((widgetId) => ({
      type: "widget",
      widgetId,
    })),
    activeWidgetId,
  };
}

module.exports = {
  buildTabbedLayout,
  openCredentials,
  openMapWindow,
  reloadApp,
  resetState,
  saveWidgetsConfig,
  switchToNewestWindow,
  waitForMainShell,
  waitForWidget,
  waitForWidgetCount,
};
