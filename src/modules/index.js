import { renderCentralBankModule } from "./central-bank/index.js";
import { renderCommoditiesModule } from "./commodities/index.js";
import { defaultEnabledWidgetIds, getWidgetById, widgetCatalog } from "./catalog.js";
import { renderEmploymentModule } from "./employment/index.js";
import { renderFxModule } from "./fx/index.js";
import { renderGrowthModule } from "./growth/index.js";
import { renderInflationModule } from "./inflation/index.js";
import { renderRiskModule } from "./risk/index.js";
import { renderInspectorModule } from "./inspector/index.js";
import { renderLogsModule } from "./logs/index.js";
import { renderTickerModule } from "./ticker/index.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function renderPlaceholderModuleFactory(widget) {
  return (container) => {
    container.innerHTML = `
      <div class="module-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">${escapeHtml(widget.categoryLabel)}</p>
            <h2>${escapeHtml(widget.title)}</h2>
          </div>
          <p>Coming soon</p>
        </div>

        <section class="hero">
          <h3>${escapeHtml(widget.title)}</h3>
          <p>${escapeHtml(widget.description)}</p>
        </section>

        <section class="status-note">
          <p>This widget is already listed in the Windows menu and can be pinned in the layout, but the live data module is not implemented yet.</p>
        </section>
      </div>
    `;
  };
}

export const moduleRegistry = {
  centralBank: {
    render: renderCentralBankModule,
  },
  inflation: {
    render: renderInflationModule,
  },
  employment: {
    render: renderEmploymentModule,
  },
  growth: {
    render: renderGrowthModule,
  },
  fx: {
    render: renderFxModule,
  },
  commodities: {
    render: renderCommoditiesModule,
  },
  ticker: {
    render: renderTickerModule,
  },
  risk: {
    render: renderRiskModule,
  },
  // logs: {
  //   render: renderLogsModule,
  // },
  // inspector: {
  //   render: renderInspectorModule,
  // },
};

for (const widget of widgetCatalog) {
  if (!moduleRegistry[widget.id]) {
    moduleRegistry[widget.id] = {
      render: renderPlaceholderModuleFactory(widget),
    };
  }
}

export { defaultEnabledWidgetIds, getWidgetById, widgetCatalog };
