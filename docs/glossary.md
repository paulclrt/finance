# Glossary

## Terms

### app config

Local XML file storing window state, widget layout, and map selection metadata.

### cache TTL

Time-based freshness window used by fetchers before they prefer remote refresh over local cache.

### detached window

A standalone `BrowserWindow` that is not part of the main widget workspace. Current example: the market map.

### FRED

Federal Reserve Economic Data API used for many US macro series.

### HICP

Harmonised Index of Consumer Prices. Used here for euro area inflation monitoring.

### IPC

Electron inter-process communication between renderer/preload/main.

### layout tree

JSON-serializable renderer structure describing widgets, splits, and tab groups.

### main process

Electron process that owns windows, menus, IPC handlers, subprocess execution, and secure storage access.

### map config

XML document describing hierarchical groups of tickers for the detached market map.

### module

A renderer widget implementation mounted into a workspace host DOM node.

### preload

Electron bridge layer exposing a safe subset of functionality to renderer code.

### safeStorage

Electron API used for host-backed encryption of credential fields before persistence.

### stale-cache

Payload served from a previous successful fetch because a fresh remote fetch failed.

### widget catalog

Metadata registry declaring widget identity, category, and implementation status.

### widget registry

Runtime mapping from widget ID to `render(container)` implementation.
