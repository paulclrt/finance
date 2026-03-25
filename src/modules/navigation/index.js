export function renderNavigationModule(container) {
  container.innerHTML = `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Modules</p>
          <h2>Workspace</h2>
        </div>
      </div>

      <div class="nav-list">
        <article class="nav-item">
          <strong>Market Watch</strong>
          <p>Future container for quotes, macro feeds, and alerts.</p>
        </article>
        <article class="nav-item">
          <strong>Research Lab</strong>
          <p>Backtests, feature engineering, and ML experiments will plug in here.</p>
        </article>
        <article class="nav-item">
          <strong>Native Connectors</strong>
          <p>Compiled tools can stream data and diagnostics into the dashboard.</p>
        </article>
      </div>
    </div>
  `;
}
