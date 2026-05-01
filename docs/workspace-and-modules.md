# Workspace, modules, and detached windows

## Module system overview

Widgets are registered in two layers:

- catalog metadata in [`src/modules/catalog.js`](../src/modules/catalog.js)
- actual render implementations in [`src/modules/index.js`](../src/modules/index.js)

The catalog defines:

- widget ID
- title
- category
- description
- whether the feature is implemented

The module registry defines:

- `render(container)` function for implemented modules
- placeholder renderers for unimplemented modules

This separation is important because menus and layout persistence can reference widgets before they have a live implementation.

## Main window workspace model

The main window renderer is implemented in [`src/renderer/app.js`](../src/renderer/app.js).

The workspace is represented as a layout tree with three node types:

- `widget`
- `split`
- `tabs`

Representative shapes:

```ts
type WidgetNode = { type: "widget"; widgetId: string };

type SplitNode = {
  type: "split";
  orientation: "row" | "column";
  children: LayoutNode[];
  sizes: number[];
};

type TabsNode = {
  type: "tabs";
  children: WidgetNode[];
  activeWidgetId: string | null;
};
```

The layout tree is serialized into XML config as JSON text.

## Workspace operations

Supported operations:

- open widget from native menu
- close widget
- reorder by drag/drop
- split left/right/top/bottom
- group as tabs
- undock tab into split
- resize splits
- persist workspace tree

Core functions:

- `parseLayoutTree(...)`
- `serializeLayoutTree()`
- `removeWidgetFromTree(...)`
- `insertWidgetAroundTarget(...)`
- `addWidgetAsTab(...)`
- `undockTab(...)`
- `renderDockNode(...)`
- `bindBoardInteractions()`

## Widget lifecycle

There is no formal React-like lifecycle. The current lifecycle is:

1. renderer asks registry for module definition
2. `getOrCreateWidgetHost(widgetId)` creates a cached DOM host once
3. module `render(host)` is called once per cached host
4. later workspace rerenders move the host DOM instead of re-rendering from scratch

This host caching is critical because it avoids unnecessary refetches when resizing or rearranging widgets.

However, it also creates an important limitation:

- module teardown is weakly defined
- dynamically injected CSS is not always removed when a widget is no longer visible

That tradeoff should be revisited in future refactors.

## Writing a new module

Minimum implementation steps:

1. Add catalog entry in [`src/modules/catalog.js`](../src/modules/catalog.js)
2. Implement module under [`src/modules/<name>/index.js`](../src/modules)
3. Export the render function in [`src/modules/index.js`](../src/modules/index.js)
4. If the module needs dedicated CSS, add stylesheet under [`src/renderer`](../src/renderer) and inject it with [`addStyleSheet()`](../src/utils/css-editor.js)
5. Expose any new preload/main/Python interface needed for data

Expected renderer contract:

```js
export function renderMyModule(container) {
  // render into provided DOM element
}
```

Recommended internal structure for a module:

- local state per container via `WeakMap`
- `renderEmptyState(...)`
- `renderMetricCards(...)`
- `mountChart(...)`
- `load<Data>()`
- CSS injection at module entry if needed

Examples:

- inflation: [`src/modules/inflation/index.js`](../src/modules/inflation/index.js)
- employment: [`src/modules/employment/index.js`](../src/modules/employment/index.js)
- growth: [`src/modules/growth/index.js`](../src/modules/growth/index.js)
- market-style modules: [`src/modules/market/shared.js`](../src/modules/market/shared.js)

## Detached windows

The current detached-window implementation is the market map.

Relevant files:

- main window opener: [`openMapWindow()`](../src/main/main.js)
- detached HTML: [`src/renderer/map.html`](../src/renderer/map.html)
- detached renderer: [`src/renderer/map.js`](../src/renderer/map.js)
- detached CSS: [`src/renderer/map.css`](../src/renderer/map.css)

Characteristics:

- independent `BrowserWindow`
- same preload bridge as main window
- not dockable back into workspace yet
- has its own sidebar, state, and map config flow

This is the first pattern for future detached tools. If more detached windows are added, a shared detached-window framework would be a good refactor target.

## Module code guidelines

Practical conventions that the existing code mostly follows:

- escape HTML when generating strings
- do not access Node APIs directly from renderer
- use preload methods only
- keep data fetching outside renderer when a Python script already exists
- prefer local per-container state over globals
- preserve data and chart instances when only layout changes
- keep styling modular when a component family has custom UI

## Module anti-patterns to avoid

- putting fetch logic directly in renderer when main/Python already owns the data path
- binding duplicate global listeners on every rerender
- writing global CSS for one module family unless it is intentionally shared
- storing secrets in renderer state or local storage
- introducing stdout debug logs into Python scripts that are expected to return pure JSON

## Screenshot and diagram placeholders

<!-- REVIEW: add screenshot of the docked main workspace with tabs and split handles visible -->
<!-- REVIEW: add screenshot of the market map detached window sidebar + treemap -->
<!-- REVIEW: add a diagram of widget layout tree: split -> tabs -> widgets -->
