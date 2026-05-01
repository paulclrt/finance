# Runtime and configuration

## Runtime model

This application is a desktop runtime, not a deployed web service. The most useful environment categories are:

- local development
- local packaged desktop build

There is currently no formal `dev / staging / prod` topology with separate remote infrastructure.

## Supported platforms and runtime dependencies

Current runtime assumptions:

- Electron `^41.0.3` from [`package.json`](../package.json)
- Node runtime bundled with Electron
- Python 3 available on the host system
- SQLite available through Python stdlib `sqlite3`
- optional native binary built through the `native/` toolchain

Python launch policy is implemented in [`src/main/main.js`](../src/main/main.js):

- Windows: `py -3`
- non-Windows: `python3`

The app should therefore be treated as requiring a working Python installation for data fetch features.

## Main runtime entry points

- Start application: [`scripts/start-electron.js`](../scripts/start-electron.js)
- Build native component: [`scripts/build-native.js`](../scripts/build-native.js)
- Main process entry: [`src/main/main.js`](../src/main/main.js)

Current npm scripts:

```json
{
  "build:native": "node scripts/build-native.js",
  "start": "npm run build:native && node scripts/start-electron.js",
  "test": "echo \"No tests configured yet\""
}
```

Important note: the top-level `test` script is still a placeholder and should be replaced.

## Window topology

There are currently two window classes:

- main application window
- detached market map window

Window creation is owned by the main process:

- main window: `createMainWindow()` in [`src/main/main.js`](../src/main/main.js)
- detached map window: `openMapWindow()` in [`src/main/main.js`](../src/main/main.js)

## Configuration sources

Configuration is assembled from:

1. hard-coded defaults in [`src/main/main.js`](../src/main/main.js)
2. persisted XML app config in user data
3. persisted credentials in SQLite
4. runtime menu actions
5. renderer-side transient widget state
6. environment variables passed only to subprocesses when required

## XML app config

The application persists window and layout state in:

`<userData>/config/app-state.xml`

Resolution function:

- [`resolveConfigPath()`](../src/main/main.js)

Default config structure:

```xml
<app-config>
  <window width="1440" height="960" x="" y="" isMaximized="false" isFullScreen="false" />
  <layout leftWidth="18" rightWidth="32" bottomHeight="44" />
  <widgets enabled="centralBank,inflation" layout="" />
  <maps selected="" custom="[]" />
</app-config>
```

Current persisted domains:

- window bounds and state
- workspace split metadata
- enabled widgets
- serialized workspace layout tree
- selected map
- custom map registrations

## Configuration consistency and caveats

The XML config parser is intentionally lightweight:

- it parses attributes with regexes
- it stores complex values such as widget layout JSON inside attributes
- it stores custom map entries as JSON strings inside XML attributes

This works, but it is fragile. Migration and validation are weak by design. Long term, this should move to either:

- a typed JSON config file
- or a small SQLite metadata store

## Secrets handling

Credentials are stored in a dedicated SQLite database:

`<userData>/data/credentials.sqlite3`

Main process functions involved:

- [`resolveCredentialsDbPath()`](../src/main/main.js)
- `encryptField(...)`
- `decryptField(...)`
- `getDecryptedCredential(...)`
- `getFredApiKey(...)`

Security model:

- sensitive fields are encrypted in the main process through Electron `safeStorage`
- encrypted blobs are passed to [`scripts/credentials-store.py`](../scripts/credentials-store.py)
- renderer never receives raw encrypted blobs directly unless explicitly asking for a credential

Current encrypted fields:

- email
- password
- api key
- notes

Current cleartext fields:

- `service_key`
- `label`
- `credential_type`
- timestamps

This is a pragmatic local-desktop model, not a hardened enterprise key management system.

## Feature flags

There is currently no formal feature-flag subsystem.

Feature exposure is controlled through:

- widget implementation state in [`src/modules/catalog.js`](../src/modules/catalog.js)
- menu registration in [`src/main/main.js`](../src/main/main.js)
- renderer support in [`src/modules/index.js`](../src/modules/index.js)

This should eventually be unified if experimental modules become more common.

## External dependencies

The runtime depends on these external systems:

- FRED API
- ECB Data API
- Yahoo Finance via `yfinance`
- CNN Fear & Greed endpoint
- other public endpoints depending on script

Behavior when unavailable is script-specific. There is no global dependency health manager.

## Time, locale, and timezone assumptions

Important implicit assumptions:

- persistence timestamps are generated in UTC ISO format
- several renderers format dates in `en-US`
- some calculations assume monthly data aligned on first day of month
- detached map window and widgets use client local time formatting for some timestamps

These assumptions are not centralized. Timezone and locale behavior should be documented explicitly whenever new fetchers are added.

## Deployment and packaging status

There is not yet a full documented release pipeline. Current practical flow is:

1. install dependencies locally
2. build native binary
3. run Electron locally

There is no documented installer generation, signing, notarization, or auto-update flow.

That absence should be considered a known gap, not an undocumented feature.
