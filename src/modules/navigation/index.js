export function renderNavigationModule(container) {
  container.innerHTML = `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Modules</p>
          <h2>Desk</h2>
        </div>
      </div>

      <div class="nav-list">
        <article class="nav-item">
          <strong>Rates</strong>
          <p>ECB events and key rates.</p>
        </article>
        <article class="nav-item">
          <strong>Research</strong>
          <p>Backtests and ML modules later.</p>
        </article>
        <article class="nav-item">
          <strong>Native</strong>
          <p>Small local binaries and logs.</p>
        </article>
      </div>
    </div>
  `;
}
