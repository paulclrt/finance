function createLogEntry(title, body, meta) {
  return `
    <article class="log-entry">
      <strong>${title}</strong>
      <p class="log-meta">${meta}</p>
      <pre>${body}</pre>
    </article>
  `;
}

export function renderLogsModule(container) {
  container.innerHTML = `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Logs</p>
          <h2>Native Process Output</h2>
        </div>
        <div class="log-actions">
          <button class="button" type="button" data-action="run-native">Run C binary</button>
        </div>
      </div>
      <div class="log-stream" data-log-stream></div>
    </div>
  `;

  const logStream = container.querySelector("[data-log-stream]");
  const runButton = container.querySelector('[data-action="run-native"]');

  async function runNativeModule() {
    logStream.insertAdjacentHTML(
      "afterbegin",
      createLogEntry("renderer", "Launching native hello module...", new Date().toLocaleString()),
    );

    try {
      const result = await window.financeDesktop.runNativeHello();
      const output = result.stdout.trim() || "(empty stdout)";

      logStream.insertAdjacentHTML(
        "afterbegin",
        createLogEntry("hello_logs", output, `exit ${result.code} • ${result.executedAt}`),
      );
    } catch (error) {
      logStream.insertAdjacentHTML(
        "afterbegin",
        createLogEntry("native:error", error.message, new Date().toLocaleString()),
      );
    }
  }

  runButton.addEventListener("click", () => {
    runNativeModule();
  });

  runNativeModule();
}
