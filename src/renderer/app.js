import { moduleRegistry } from "../modules/index.js";
import { setupCredentialsManager } from "./credentials.js";
import { setupWorkspaceResizing } from "./workspace.js";

const layoutConfig = {
  main: "centralBank",
  right: "inflation",
};

function mountModules() {
  for (const [paneName, moduleId] of Object.entries(layoutConfig)) {
    const paneElement = document.querySelector(`[data-pane="${paneName}"]`);
    const moduleDefinition = moduleRegistry[moduleId];

    if (!paneElement || !moduleDefinition) {
      continue;
    }

    paneElement.innerHTML = "";
    moduleDefinition.render(paneElement);
  }
}

async function initializeApp() {
  mountModules();
  setupCredentialsManager();

  let appConfig = null;
  try {
    appConfig = await window.financeDesktop.getAppConfig();
  } catch (error) {
    console.error("Unable to load app config:", error);
  }

  setupWorkspaceResizing(document.querySelector(".workspace"), {
    initialLayout: appConfig?.layout,
    onLayoutChange: async (layout) => {
      try {
        await window.financeDesktop.saveLayoutConfig(layout);
      } catch (error) {
        console.error("Unable to save layout config:", error);
      }
    },
  });
}

initializeApp();
