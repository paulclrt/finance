const assert = require("node:assert/strict");
const {
  openCredentials,
  reloadApp,
  resetState,
  waitForMainShell,
} = require("../helpers/app.js");

describe("credentials manager", () => {
  beforeEach(async () => {
    await resetState();
    await reloadApp();
    await waitForMainShell();
  });

  it("creates and deletes an API key credential", async () => {
    await openCredentials();
    const shell = $(".credentials-modal-shell.visible");
    await shell.waitForDisplayed();

    await $('[name="serviceKey"]').setValue("fredapikey");
    await $('[name="label"]').setValue("FRED API");
    await $('[name="apiKey"]').setValue("demo-key-123");
    await $('[data-credentials-form]').submitForm();

    await $('[data-service-key="fredapikey"]').waitForDisplayed();
    assert.match(await $('[data-credentials-list]').getText(), /FRED API/);

    await $('[data-service-key="fredapikey"]').click();
    await $('[data-delete-credential]').click();
    await browser.waitUntil(async () => !(await $('[data-service-key="fredapikey"]').isExisting()), {
      timeout: 10000,
      timeoutMsg: "Credential should be deleted",
    });
  });

  it("creates an email/password credential", async () => {
    await openCredentials();
    const shell = $(".credentials-modal-shell.visible");
    await shell.waitForDisplayed();

    const typeSelect = await $('[name="credentialType"]');
    await typeSelect.selectByAttribute("value", "email_password");
    await $('[name="serviceKey"]').setValue("broker-login");
    await $('[name="label"]').setValue("Broker Login");
    await $('[name="email"]').setValue("demo@example.com");
    await $('[name="password"]').setValue("super-secret");
    await $('[data-credentials-form]').submitForm();

    await $('[data-service-key="broker-login"]').waitForDisplayed();
    assert.match(await $('[data-credentials-list]').getText(), /Broker Login/);
  });
});
