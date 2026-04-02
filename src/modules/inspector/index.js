export function renderInspectorModule(container) {
  container.innerHTML = `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Notes</p>
          <h2>Next</h2>
        </div>
      </div>

      <div class="signal-list">
        <article class="signal-item">
          <strong>CSV / API</strong>
          <p>Ajouter des series locales de marché.</p>
        </article>
        <article class="signal-item">
          <strong>Modules</strong>
          <p>Charger des widgets quant indépendants.</p>
        </article>
        <article class="signal-item">
          <strong>Native</strong>
          <p>Streamer des sorties C/Rust/Python.</p>
        </article>
      </div>
    </div>
  `;
}
