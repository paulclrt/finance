# Operations, testing, and maintenance

## Startup sequence

Normal startup path:

1. Electron starts main process from [`src/main/main.js`](../src/main/main.js)
2. default app config is loaded or created
3. maps directory is ensured and default sample map may be created
4. main window is created
5. native application menu is built
6. renderer loads [`src/renderer/index.html`](../src/renderer/index.html)
7. renderer requests app config through preload
8. workspace is built from enabled widgets and serialized layout
9. widgets request data on demand through IPC

## Shutdown sequence

On window close:

- pending debounced config write is canceled
- current window bounds are persisted immediately
- app config is synchronously written

This is implemented in the main window `close` handler.

## Common operational procedures

### Run locally

```bash
npm start
```

This runs:

1. native build
2. Electron startup

### Rebuild native only

```bash
npm run build:native
```

### Run a Python fetcher manually

Example:

```bash
python3 scripts/fetch-inflation-data.py --db /tmp/inflation.sqlite3
```

Most fetchers accept:

- `--db`
- optional `--refresh`
- optional feature-specific params such as `--years`, `--ticker`, `--duration`

## Failure modes

### External API failure

Examples:

- FRED key missing
- ECB returns `400`
- CNN blocks request
- Yahoo Finance metadata call fails

Expected behavior:

- subprocess may fail hard
- or script may serve stale cache if implemented
- renderer shows error or warning state

This behavior is not yet standardized.

### Cache corruption or schema drift

Possible effects:

- JSON decode failures
- compressed payload decode failures
- migration inconsistencies

Current recovery model:

- usually manual deletion of the affected SQLite file

There is no generic repair workflow.

### Config corruption

If XML app config is invalid:

- app falls back to defaults
- parse error is logged to console

This is useful but lossy. A future improvement would be backup-and-recover rather than silent reset to defaults.

### Credential encryption unavailable

If `safeStorage` is unavailable:

- credentials cannot be securely stored
- UI indicates insecure/unavailable storage
- some operations will fail rather than downgrade silently

## Observability

Current observability is minimal.

Available signals:

- `console.error(...)` in main and renderer
- warning messages embedded in payloads
- UI status notes
- source indicator and timestamps

What is missing:

- structured logs
- formal log schema
- metrics
- tracing
- correlation IDs between renderer request and Python subprocess

For a local desktop app this is understandable, but for debugging complex widget/data issues it is a real limitation.

## Testing strategy

Current testing state:

- Python unit testing has started in [`tests/`](../tests)
- JavaScript currently relies mostly on `node --check` and manual validation
- there is no renderer integration or end-to-end test suite

Representative test:

- [`tests/test_fetch_inflation_data.py`](../tests/test_fetch_inflation_data.py)

Recommended strategy going forward:

- unit tests for Python normalization logic
- unit tests for config parsing and migration helpers
- snapshot or DOM tests for renderer rendering helpers where practical
- integration tests for IPC <-> Python boundaries
- manual smoke checklist for layout persistence and detached windows

## Reproducibility constraints

Current reproducibility is limited by:

- live external data
- unofficial Yahoo Finance dependency
- mutable remote endpoints
- local OS support for `safeStorage`
- lack of fixed test fixtures for most fetchers

Recommended improvement:

- introduce fixture-based tests for every fetcher
- isolate remote payload parsing from transport
- make retry/fallback rules deterministic in tests

## Build and release

Current build process is local and manual.

Missing pieces:

- CI pipeline
- versioning policy beyond package version
- release packaging docs
- rollback procedure
- compatibility matrix for app upgrades versus existing local caches/config

Suggested release checklist for future use:

1. run Python unit tests
2. run syntax checks for modified JS files
3. smoke test credentials manager
4. smoke test at least one widget per external provider family
5. verify config migration from an existing userData directory
6. verify detached map window

## Compatibility and migration risks

Known skew risks:

- saved layout JSON versus new renderer logic
- old credentials schema versus new expected columns
- old map registrations referencing missing files
- cached payload format changes without cache invalidation

When changing any persisted structure, document:

- old shape
- new shape
- migration code path
- recovery behavior if migration is partial

## Security model

Trust boundaries:

- renderer is less trusted than main process
- main process is trusted to manage credentials and subprocesses
- Python fetchers are trusted local code
- external providers are untrusted remote dependencies

Sensitive assets:

- API keys
- credential notes
- local config with usage history
- market map custom files if they embed proprietary watchlists

Current security concerns:

- Electron launched with `no-sandbox`
- renderer HTML string rendering requires consistent escaping discipline
- unofficial external data dependencies
- no audit log of credential changes

## Runbook: common issues

### Widget shows stale or wrong data

1. use widget refresh control
2. inspect warning text in widget
3. run the corresponding Python fetcher manually
4. delete the relevant SQLite cache if needed
5. reload the app

### Layout behaves strangely after code changes

1. reset layout from native menu
2. inspect `app-state.xml`
3. clear `widgets.layout` if serialized tree is incompatible

### Credential-dependent widget fails

1. open `Settings > Credentials`
2. verify service key exists
3. verify type is correct
4. verify secure storage availability

### Map does not render correctly

1. verify selected map file exists
2. inspect sidebar missing-file state
3. refresh map
4. run [`scripts/fetch-market-map-data.py`](../scripts/fetch-market-map-data.py) manually

<!-- REVIEW: add screenshot of a healthy credentials manager state -->
<!-- REVIEW: add screenshot of a widget showing stale-cache warning -->
