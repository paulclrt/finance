const assert = require("node:assert/strict");
const {
  reloadApp,
  resetState,
  saveWidgetsConfig,
  waitForMainShell,
  waitForWidget,
} = require("../helpers/app.js");

describe("ticker and market modules", () => {
  beforeEach(async () => {
    await resetState();
    await reloadApp();
    await waitForMainShell();
  });

  it("loads a ticker search result and switches duration", async () => {
    await saveWidgetsConfig({
      enabled: ["centralBank", "inflation", "ticker"],
    });

    await waitForWidget("ticker");
    const tickerTile = $('[data-widget-tile="ticker"]');
    await tickerTile.$("#ticker-symbol-input").setValue("MSFT");
    await tickerTile.$('[data-action="search-ticker"]').click();

    await tickerTile.$("h2=Microsoft Corporation").waitForDisplayed();
    await tickerTile.$('[data-duration="6mo"]').click();
    const durationButton = await tickerTile.$('[data-duration="6mo"]');
    assert.match(await durationButton.getAttribute("class"), /active/);
  });

  it("switches FX presets without calling live providers", async () => {
    await saveWidgetsConfig({
      enabled: ["centralBank", "inflation", "fx"],
    });

    await waitForWidget("fx");
    const fxTile = $('[data-widget-tile="fx"]');
    await fxTile.$('[data-market-symbol="EURUSD=X"]').click();
    await fxTile.$("h2=EUR/USD").waitForDisplayed();

    const statusText = await fxTile.getText();
    assert.match(statusText, /cache/i);
  });

  it("renders the risk widget and switches chart tabs", async () => {
    await saveWidgetsConfig({
      enabled: ["centralBank", "inflation", "risk"],
    });

    await waitForWidget("risk");
    const riskTile = $('[data-widget-tile="risk"]');
    await riskTile.$("h2=Stress monitor").waitForDisplayed();
    assert.equal((await riskTile.$$(".risk-card")).length, 4);

    await riskTile.$('[data-chart-id="fearGreed"]').click();
    await riskTile.$("h3=Fear & Greed").waitForDisplayed();
  });
});
