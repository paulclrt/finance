const { registerCentralBankIpc } = require("../../modules/central-bank/ipc");
const { registerTickerIpc } = require("../../modules/ticker/ipc");
const { registerInflationIpc } = require("../../modules/inflation/ipc");
const { registerRiskIpc } = require("../../modules/risk/ipc");
const { registerEmploymentIpc } = require("../../modules/employment/ipc");
const { registerGrowthIpc } = require("../../modules/growth/ipc");
const { registerNativeIpc } = require("./native");
const { registerConfigIpc } = require("./config");
const { registerCredentialsIpc } = require("./credentials");
const { registerShellIpc } = require("./shell");
const { registerFilesystemIpc } = require("./filesystem");
const { registerMapsIpc } = require("./maps");

function registerIpcHandlers(dependencies) {
  registerNativeIpc(dependencies);
  registerCentralBankIpc(dependencies);
  registerTickerIpc(dependencies);
  registerInflationIpc(dependencies);
  registerRiskIpc(dependencies);
  registerEmploymentIpc(dependencies);
  registerGrowthIpc(dependencies);
  registerConfigIpc(dependencies);
  registerCredentialsIpc(dependencies);
  registerShellIpc(dependencies);
  registerFilesystemIpc(dependencies);
  registerMapsIpc(dependencies);
}

module.exports = {
  registerIpcHandlers,
};
