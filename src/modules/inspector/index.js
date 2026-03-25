export function renderInspectorModule(container) {
  container.innerHTML = `
    <div class="module-card">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Inspector</p>
          <h2>Roadmap</h2>
        </div>
      </div>

      <div class="signal-list">
        <article class="signal-item">
          <strong>Next step</strong>
          <p>Brancher une source de prix locale ou un CSV historique.</p>
        </article>
        <article class="signal-item">
          <strong>Then</strong>
          <p>Ajouter un moteur de modules chargeables pour backtests et notebooks.</p>
        </article>
        <article class="signal-item">
          <strong>Later</strong>
          <p>Faire communiquer des binaires natifs plus riches avec le renderer.</p>
        </article>
      </div>
    </div>
  `;
}
