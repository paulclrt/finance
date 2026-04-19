# Interfaces and data contracts

## Overview

The highest-value interfaces in this project are not REST APIs exposed to third parties. They are internal boundaries:

- renderer to preload
- preload to main
- main to Python subprocesses
- Python to external data providers
- renderer to workspace layout serialization
- XML map definitions

These interfaces are only partially formalized in code. This document makes them explicit.

## Renderer to preload interface

The renderer-facing API is the `window.financeDesktop` object exposed in [`src/preload/preload.js`](../src/preload/preload.js).

Current methods:

```js
window.financeDesktop = {
  runNativeHello,
  getCentralBankEvents,
  getTickerData,
  getInflationData,
  getRiskData,
  getEmploymentData,
  getGrowthData,
  listMapConfigs,
  importMapConfig,
  deleteMapConfig,
  getMapData,
  openExternal,
  listCredentials,
  getCredential,
  saveCredential,
  deleteCredential,
  getCredentialStatus,
  getAppConfig,
  saveLayoutConfig,
  saveWidgetsConfig,
  onOpenCredentials,
  onAppConfigUpdated,
  stylesheetExists
}
```

Interface characteristics:

- transport: Electron IPC
- pattern: request/response for `invoke`, event subscription for `on*`
- versioning: none
- schema enforcement: manual and ad hoc

## Main IPC handlers

Handlers live in [`src/main/main.js`](../src/main/main.js). Major groups:

- native execution
- data fetchers
- credentials
- config persistence
- shell helpers
- map management

### `data:get-inflation-data`

Request:

```ts
{
  refresh?: boolean;
  years?: number;
}
```

Response shape:

```ts
{
  series: Array<{
    id: string;
    label: string;
    region: "US" | "EU";
    sourceUrl: string;
    color: string;
    points: Array<{ time: string; value: number }>;
  }>;
  latest: Array<{
    id: string;
    label: string;
    region: string;
    sourceUrl: string;
    latestPoint: { time: string; value: number } | null;
  }>;
  warnings: string[];
  servedFrom?: "remote" | "cache" | "stale-cache";
  lastSuccessfulRefresh?: string;
}
```

Validation and constraints:

- `years` is stringified and passed to Python
- FRED API key must exist in credentials under `fredapikey` or fallback aliases
- main process injects `FRED_API_KEY` into subprocess environment

Error model:

- Python non-zero exit becomes thrown `Error(stderr || fallback)`
- no stable machine-readable error codes
- retryability depends on error source

### `maps:list-configs`

Request:

- no payload

Response:

```ts
{
  selectedFile: string;
  groups: {
    default: MapConfig[];
    custom: MapConfig[];
  };
}
```

Where:

```ts
type MapConfig = {
  id: string;
  fileName: string;
  title: string;
  path: string;
  exists: boolean;
  group: "default" | "custom";
}
```

### `maps:import-config`

Request:

- no explicit payload
- user selects an XML file through native file picker

Behavior:

- file is copied into app-local maps directory
- duplicates are renamed with numeric suffixes
- map is registered in app config as custom
- new map becomes selected

Response:

```ts
{
  imported: boolean;
  fileName?: string;
  title?: string;
}
```

### `maps:delete-config`

Request:

```ts
string // fileName
```

Behavior:

- only custom maps are deletable
- copied XML file is removed from app maps directory if present
- custom registration is removed from app config

Response:

```ts
{
  deleted: boolean;
  fileName: string;
  selectedFile: string;
}
```

### `config:save-widgets`

Request:

```ts
{
  enabled: string[];
  layout?: string; // serialized JSON layout tree
}
```

Behavior:

- widget IDs are normalized and persisted
- app menu checkbox state is regenerated
- new config is broadcast back to renderer

Important note:

- there is no schema version for the serialized layout tree
- version skew between old saved layouts and new renderer code is therefore a real risk

## Main to Python subprocess contract

All Python fetchers follow the same broad contract:

- inputs passed as CLI args
- optional environment variables for secrets
- stdout returns JSON payload
- stderr returns human-readable error JSON or text
- non-zero exit is treated as failure

Common pattern in main:

```js
const result = await runProcessWithEnv(command, args, app.getAppPath(), env);
return JSON.parse(result.stdout);
```

This is simple but brittle:

- stdout must remain pure JSON
- debug logging to stdout will break the contract
- no streamed partial progress is possible

## External provider interfaces

### FRED

Used by:

- [`scripts/fetch-inflation-data.py`](../scripts/fetch-inflation-data.py)
- [`scripts/fetch-employment-data.py`](../scripts/fetch-employment-data.py)
- [`scripts/fetch-growth-data.py`](../scripts/fetch-growth-data.py)
- [`scripts/fetch-risk-data.py`](../scripts/fetch-risk-data.py)

Pattern:

- HTTP GET
- JSON response
- API key passed as query parameter

Examples:

```text
https://api.stlouisfed.org/fred/series/observations
```

Known constraints:

- API key required
- different series can have different periodicity and missing data patterns
- fetchers often transform level series into rates or percent changes locally

### ECB data API

Used by:

- [`scripts/fetch-inflation-data.py`](../scripts/fetch-inflation-data.py)

Pattern:

- `https://data-api.ecb.europa.eu/service/data/<flowRef>/<key>`
- currently requested in `csvdata`

Notable implementation detail:

- ECB flow and key are not the same string
- example:
  - flow: `HICP`
  - key: `M.U2.N.000000.4D0.ANR`

Fallback behavior is implemented for legacy `ICP` flow variants.

### Yahoo Finance via `yfinance`

Used by:

- [`scripts/fetch-ticker.py`](../scripts/fetch-ticker.py)
- [`scripts/fetch-market-map-data.py`](../scripts/fetch-market-map-data.py)

Characteristics:

- unofficial dependency
- schema may drift
- batch download used for map history where possible
- metadata still partly fetched per symbol in some flows

This dependency should be treated as useful but operationally fragile.

## XML map contract

Map files are XML documents with recursive grouping.

Supported nodes:

- `<map>`
- `<group>`
- `<sector>`
- `<category>`
- `<ticker>`
- `<symbol>`
- `<asset>`

Minimal example:

```xml
<map title="US Mega Caps">
  <group label="Technology">
    <ticker symbol="AAPL" label="Apple" />
    <ticker symbol="MSFT" label="Microsoft" />
  </group>
</map>
```

Parsing logic:

- [`parse_map_config()`](../scripts/fetch-market-map-data.py)
- [`parse_group_node()`](../scripts/fetch-market-map-data.py)

Validation is permissive:

- unknown tags are effectively ignored
- empty ticker symbols are skipped
- recursion depth is not explicitly bounded

## Data model

There is no single global data model. The app uses several local stores.

### App config XML

Ownership:

- main process

Consistency:

- eventual, debounced writes
- forced sync write on main window close

### Credentials SQLite

Schema defined in:

- [`scripts/credentials-store.py`](../scripts/credentials-store.py)

Entity:

```sql
credentials(
  service_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'api_key',
  email_encrypted TEXT NOT NULL DEFAULT '',
  password_encrypted TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  notes_encrypted TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
)
```

Migration approach:

- `ensure_schema()` performs additive migration with `ALTER TABLE`
- legacy `login_encrypted` / `secret_encrypted` fields are still considered during migration

This is effective for a small local app, but should be documented as a weak migration system with no explicit schema version table.

### Per-widget data caches

Each fetcher usually owns its own SQLite file and one cache table.

Examples:

- inflation: `inflation_cache`
- ticker: `ticker_cache`
- map: `market_map_symbol_cache`

Common properties:

- primary key is typically a cache key or symbol
- payloads are stored as JSON text or compressed JSON
- freshness is time-based via `CACHE_TTL_HOURS`

Consistency model:

- local read-your-last-write within a single process
- no concurrency coordination across multiple app instances

## Business logic rules

Important deterministic rules already present in the code:

- widget visibility is driven by `widgets.enabled`
- workspace layout is pruned against enabled widget IDs on load
- missing widgets are appended back into layout when needed
- inflation US series are converted from index levels to YoY rates
- inflation EU series from ECB are already annual rates and are not re-derived
- market map size is proportional to `marketCap`
- market map color depends on bounded `changePercent`
- custom maps are persisted separately from default maps

## Undefined or weakly defined behavior

These are blind spots worth knowing:

- old saved widget layout JSON may become invalid after renderer changes
- invalid XML map structures are not strongly rejected
- partial success in a multi-series fetcher is handled differently per script
- some stale cache fallbacks preserve warnings, others do not
- rate limits and retry backoff are not globally standardized
- IPC error payloads are not normalized across handlers
