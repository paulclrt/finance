import { renderInspectorModule } from "./inspector/index.js";
import { renderLogsModule } from "./logs/index.js";
import { renderNavigationModule } from "./navigation/index.js";
import { renderOverviewModule } from "./overview/index.js";

export const moduleRegistry = {
  navigation: {
    render: renderNavigationModule,
  },
  overview: {
    render: renderOverviewModule,
  },
  logs: {
    render: renderLogsModule,
  },
  inspector: {
    render: renderInspectorModule,
  },
};
