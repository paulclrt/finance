const path = require("node:path");
const fs = require("node:fs");
const { resolveConfigPath, resolveMapsDirectory } = require("./paths");
const { DEFAULT_ENABLED_WIDGET_IDS, SAMPLE_MAP_XML, WIDGET_MENU_GROUPS } = require("./widget-registry");

let appConfigState = null;
let configWriteTimer = null;
let configWritePromise = null;

function getDefaultAppConfig() {
  return {
    window: {
      width: 1440,
      height: 960,
      x: null,
      y: null,
      isMaximized: false,
      isFullScreen: false,
    },
    layout: {
      leftWidth: 18,
      rightWidth: 32,
      bottomHeight: 44,
    },
    widgets: {
      enabled: "centralBank,inflation",
      layout: "",
    },
    maps: {
      selected: "",
      custom: "[]",
    },
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function unescapeXml(value) {
  return String(value ?? "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function parseTagAttributes(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}\\s+([^>]+?)\\s*\\/?>`, "i"));
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    [...match[1].matchAll(/([a-zA-Z0-9_:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, unescapeXml(value)]),
  );
}

function toFiniteNumber(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function readAppConfig() {
  if (appConfigState) {
    return appConfigState;
  }

  const defaults = getDefaultAppConfig();
  const configPath = resolveConfigPath();

  if (!fs.existsSync(configPath)) {
    appConfigState = defaults;
    return appConfigState;
  }

  try {
    const xml = fs.readFileSync(configPath, "utf8");
    const windowAttributes = parseTagAttributes(xml, "window");
    const layoutAttributes = parseTagAttributes(xml, "layout");
    const widgetAttributes = parseTagAttributes(xml, "widgets");
    const mapAttributes = parseTagAttributes(xml, "maps");

    appConfigState = {
      window: {
        width: toFiniteNumber(windowAttributes.width, defaults.window.width),
        height: toFiniteNumber(windowAttributes.height, defaults.window.height),
        x: windowAttributes.x != null ? toFiniteNumber(windowAttributes.x, defaults.window.x) : defaults.window.x,
        y: windowAttributes.y != null ? toFiniteNumber(windowAttributes.y, defaults.window.y) : defaults.window.y,
        isMaximized: toBoolean(windowAttributes.isMaximized, defaults.window.isMaximized),
        isFullScreen: toBoolean(windowAttributes.isFullScreen, defaults.window.isFullScreen),
      },
      layout: {
        leftWidth: toFiniteNumber(layoutAttributes.leftWidth, defaults.layout.leftWidth),
        rightWidth: toFiniteNumber(layoutAttributes.rightWidth, defaults.layout.rightWidth),
        bottomHeight: toFiniteNumber(layoutAttributes.bottomHeight, defaults.layout.bottomHeight),
      },
      widgets: {
        enabled: widgetAttributes.enabled || defaults.widgets.enabled,
        layout: widgetAttributes.layout || defaults.widgets.layout,
      },
      maps: {
        selected: mapAttributes.selected || defaults.maps.selected,
        custom: mapAttributes.custom || defaults.maps.custom,
      },
    };
    return appConfigState;
  } catch (error) {
    console.error("Unable to read XML app config:", error);
    appConfigState = defaults;
    return appConfigState;
  }
}

function serializeAppConfig(config) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<app-config>",
    `  <window width="${escapeXml(config.window.width)}" height="${escapeXml(config.window.height)}" x="${escapeXml(config.window.x ?? "")}" y="${escapeXml(config.window.y ?? "")}" isMaximized="${escapeXml(config.window.isMaximized)}" isFullScreen="${escapeXml(config.window.isFullScreen)}" />`,
    `  <layout leftWidth="${escapeXml(config.layout.leftWidth)}" rightWidth="${escapeXml(config.layout.rightWidth)}" bottomHeight="${escapeXml(config.layout.bottomHeight)}" />`,
    `  <widgets enabled="${escapeXml(config.widgets.enabled)}" layout="${escapeXml(config.widgets.layout ?? "")}" />`,
    `  <maps selected="${escapeXml(config.maps?.selected ?? "")}" custom="${escapeXml(config.maps?.custom ?? "[]")}" />`,
    "</app-config>",
    "",
  ].join("\n");
}

function writeAppConfigSync(config) {
  const configPath = resolveConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, serializeAppConfig(config), "utf8");
}

function scheduleAppConfigWrite() {
  if (configWriteTimer) {
    clearTimeout(configWriteTimer);
  }

  configWriteTimer = setTimeout(() => {
    const snapshot = appConfigState ?? getDefaultAppConfig();
    const configPath = resolveConfigPath();
    const xml = serializeAppConfig(snapshot);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    configWritePromise = fs.promises.writeFile(configPath, xml, "utf8").catch((error) => {
      console.error("Unable to write XML app config:", error);
    });
  }, 900);
}

function mergeAppConfig(partialConfig) {
  const currentConfig = readAppConfig();
  appConfigState = {
    window: {
      ...currentConfig.window,
      ...(partialConfig.window ?? {}),
    },
    layout: {
      ...currentConfig.layout,
      ...(partialConfig.layout ?? {}),
    },
    widgets: {
      ...currentConfig.widgets,
      ...(partialConfig.widgets ?? {}),
    },
    maps: {
      ...currentConfig.maps,
      ...(partialConfig.maps ?? {}),
    },
  };
  scheduleAppConfigWrite();
  return appConfigState;
}

function ensureAppConfigFile() {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    const defaults = getDefaultAppConfig();
    appConfigState = defaults;
    writeAppConfigSync(defaults);
  }
}

function ensureMapsDirectory() {
  const mapsDirectory = resolveMapsDirectory();
  fs.mkdirSync(mapsDirectory, { recursive: true });
  const samplePath = path.join(mapsDirectory, "us-mega-caps.xml");
  if (!fs.existsSync(samplePath)) {
    fs.writeFileSync(samplePath, SAMPLE_MAP_XML, "utf8");
  }
}

function listMapConfigFiles() {
  ensureMapsDirectory();
  const config = readAppConfig();
  let customEntries = [];
  try {
    customEntries = JSON.parse(config?.maps?.custom || "[]");
  } catch {
    customEntries = [];
  }

  const defaultFileNames = new Set(["us-mega-caps.xml"]);
  const diskEntries = fs
    .readdirSync(resolveMapsDirectory(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xml"))
    .map((entry) => {
      const fullPath = path.join(resolveMapsDirectory(), entry.name);
      const xml = fs.readFileSync(fullPath, "utf8");
      const titleMatch = xml.match(/<map[^>]+(?:title|name)="([^"]+)"/i);
      return {
        id: entry.name,
        fileName: entry.name,
        title: unescapeXml(titleMatch?.[1] || entry.name.replace(/\.xml$/i, "")),
        path: fullPath,
        exists: true,
      };
    });

  const diskByFileName = new Map(diskEntries.map((entry) => [entry.fileName, entry]));
  const customFileNames = new Set(customEntries.map((entry) => String(entry?.fileName || "").trim()).filter(Boolean));

  const defaults = diskEntries
    .filter((entry) => defaultFileNames.has(entry.fileName) || !customFileNames.has(entry.fileName))
    .map((entry) => ({ ...entry, group: "default" }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));

  const custom = customEntries
    .map((entry) => {
      const fileName = String(entry?.fileName || "").trim();
      const diskEntry = diskByFileName.get(fileName);
      return {
        id: fileName,
        fileName,
        title: String(entry?.title || diskEntry?.title || fileName.replace(/\.xml$/i, "")),
        path: diskEntry?.path || path.join(resolveMapsDirectory(), fileName),
        exists: Boolean(diskEntry),
        group: "custom",
      };
    })
    .filter((entry) => entry.fileName)
    .sort((left, right) => left.title.localeCompare(right.title));

  return {
    selectedFile: config?.maps?.selected || "",
    groups: {
      default: defaults,
      custom,
    },
  };
}

function parseEnabledWidgetIds(config = readAppConfig()) {
  const allowed = new Set(WIDGET_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.id)));
  const rawEnabled = config?.widgets?.enabled;
  if (rawEnabled === "") {
    return [];
  }

  const enabled = String(rawEnabled || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && allowed.has(item));

  return enabled.length ? enabled : [...DEFAULT_ENABLED_WIDGET_IDS];
}

function setEnabledWidgetIds(widgetIds) {
  const normalized = [...new Set(widgetIds.map((item) => String(item || "").trim()).filter(Boolean))];
  mergeAppConfig({
    widgets: {
      enabled: normalized.join(","),
    },
  });
  return normalized;
}

function flushPendingConfigWrite() {
  if (configWriteTimer) {
    clearTimeout(configWriteTimer);
    configWriteTimer = null;
  }
}

module.exports = {
  DEFAULT_ENABLED_WIDGET_IDS,
  WIDGET_MENU_GROUPS,
  ensureAppConfigFile,
  ensureMapsDirectory,
  flushPendingConfigWrite,
  getDefaultAppConfig,
  listMapConfigFiles,
  mergeAppConfig,
  parseEnabledWidgetIds,
  readAppConfig,
  setEnabledWidgetIds,
  toFiniteNumber,
  unescapeXml,
  writeAppConfigSync,
};
