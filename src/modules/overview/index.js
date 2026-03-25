export function renderOverviewModule(container) {
  container.innerHTML = `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Overview</p>
          <h2>Quant Dashboard Skeleton</h2>
        </div>
        <p>Composable panes for research, trading, and observability.</p>
      </div>

      <section class="hero">
        <h3>Modular by design</h3>
        <p>
          Each zone in this layout can load a dedicated module without mixing renderer logic,
          native execution, and Electron bootstrapping.
        </p>
      </section>

      <section class="metric-grid">
        <article class="metric-card">
          <span>Data feeds</span>
          <strong>0 connected</strong>
        </article>
        <article class="metric-card">
          <span>Native modules</span>
          <strong>1 ready</strong>
        </article>
        <article class="metric-card">
          <span>Experiments</span>
          <strong>Pending</strong>
        </article>
      </section>

      <section class="chart-placeholder"></section>
    </div>
  `;
}
