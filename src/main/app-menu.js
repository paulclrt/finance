const { Menu, shell } = require("electron");

function buildAppMenu({
  enabledWidgetIds,
  widgetGroups,
  onOpenCredentials,
  onOpenMapWindow,
  onResetLayout,
  onToggleWidget,
}) {
  const template = [];

  if (process.platform === "darwin") {
    template.push({ role: "appMenu" });
  }

  template.push({
    label: "Settings",
    submenu: [
      {
        label: "Credentials",
        accelerator: "CmdOrCtrl+,",
        click: () => {
          onOpenCredentials();
        },
      },
      {
        label: "Reset Layout",
        click: () => {
          onResetLayout();
        },
      },
    ],
  });

  template.push({
    label: "Compte",
    submenu: [
      {
        label: "Local Profile",
        enabled: false,
        toolTip: "App state, layout and credentials stay local by default.",
      },
    ],
  });

  template.push({
    label: "Windows",
    submenu: [
      ...widgetGroups.map((group) => ({
        label: group.label,
        submenu: group.items.map((item) => ({
          label: item.title,
          type: "checkbox",
          checked: enabledWidgetIds.includes(item.id),
          toolTip: item.description,
          click: (menuItem) => {
            onToggleWidget(item.id, menuItem.checked);
          },
        })),
      })),
      { type: "separator" },
      {
        label: "Open Map Window",
        click: () => {
          onOpenMapWindow();
        },
      },
    ],
  });

  template.push({
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
    ],
  });

  if (process.platform !== "darwin") {
    template.push({
      label: "File",
      submenu: [{ role: "quit" }],
    });
  }

  template.push({
    label: "Soutenir",
    submenu: [
      {
        label: "GitHub",
        click: async () => {
          await shell.openExternal("https://github.com/paulclrt/finance");
        },
      },
      {
        label: "Author Website",
        click: async () => {
          await shell.openExternal("https://portfolio.paul-claret.fr");
        },
      },
    ],
  });

  return Menu.buildFromTemplate(template);
}

module.exports = {
  buildAppMenu,
};
