import { moduleRegistry } from "../modules/index.js";
import { setupWorkspaceResizing } from "./workspace.js";

const layoutConfig = {
  left: "navigation",
  main: "centralBank",
  bottom: "logs",
  right: "inspector",
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

mountModules();
setupWorkspaceResizing(document.querySelector(".workspace"));
