# Frontend styling and UI conventions

## Renderer layers

The renderer uses a mix of:

- global application CSS in [`src/renderer/styles.css`](../src/renderer/styles.css)
- shared family styles such as:
  - [`src/renderer/macro-panels.css`](../src/renderer/macro-panels.css)
  - [`src/renderer/market-panels.css`](../src/renderer/market-panels.css)
- module-specific styles such as:
  - [`src/renderer/ticker-styles.css`](../src/renderer/ticker-styles.css)
  - [`src/renderer/growth-styles.css`](../src/renderer/growth-styles.css)
  - [`src/renderer/employment-styles.css`](../src/renderer/employment-styles.css)
  - [`src/renderer/map.css`](../src/renderer/map.css)

## Global versus module CSS

Rule of thumb:

- put truly shared primitives in global CSS
- put shared widget-family styles in a dedicated shared stylesheet
- inject module-specific styles through [`addStyleSheet()`](../src/utils/css-editor.js)

Recent example:

- ticker search bar styles were moved from ticker-only CSS to global CSS because FX and market modules depend on the same classes

This is the right direction. Shared selectors should not depend on a specific widget being mounted.

## CSS injection

Helper:

- [`src/utils/css-editor.js`](../src/utils/css-editor.js)

API:

```js
addStyleSheet(path, id)
removeStyleSheet(id)
```

Current behavior:

- idempotent add by DOM ID
- direct `<link rel="stylesheet">` injection
- optional removal support exists

Limitation:

- removal is not consistently used because widget hosts are cached

## UI conventions

### General

- desktop-first layout
- light theme only
- compact density preferred
- native menubar for global app actions
- HTML/CSS desktop-like controls inside windows

### Widget headers

Most widgets use:

- eyebrow label
- title
- right-side inline actions

Do not put large verbose status banners in the header if a compact indicator is enough.

### Source indicator

The compact source indicator helper lives in:

- [`src/modules/ui/source-indicator.js`](../src/modules/ui/source-indicator.js)

Semantic colors:

- green: remote
- blue: cache
- amber: stale cache
- gray: unknown

This replaced older verbose “source / refresh” UI blocks in several widgets.

### Range selectors

Macro widgets use local inline range selectors, typically:

- `1Y`
- `3Y`
- `5Y`
- `10Y`
- `All`

These are local UI state changes and should not trigger refetches.

### Search bars

Search UIs for ticker-like modules should use the shared pattern:

- input
- submit button
- help text

Relevant selectors:

- `.ticker-search-shell`
- `.ticker-search-row`
- `.ticker-input`
- `.ticker-submit-button`

### Charts

Chart library:

- Lightweight Charts loaded from CDN in module renderers

Implementation note:

- charts are loaded lazily
- modules cache chart objects in local state when they need dynamic range updates

Risk:

- chart library loading is repeated as string-based script injection across multiple modules

This could be centralized later.

## Icons

Icons are centralized in:

- [`src/renderer/icons.js`](../src/renderer/icons.js)

Current style:

- inline SVG strings
- lucide-inspired icon set

Recommendation:

- keep using shared icon registry
- do not introduce new ad hoc inline SVGs in arbitrary modules unless the icon is truly unique

## Map window UI

The market map has its own visual language in [`src/renderer/map.css`](../src/renderer/map.css).

Important current design concerns:

- treemap layout is DOM-based, not canvas-based
- small-box overflow must be managed aggressively
- sidebar density matters because map controls and list need to coexist

The map is visually acceptable but still a candidate for future canvas rendering if precision and performance become more important.

## Styling guidelines for future changes

- prefer small composable shared stylesheets over one giant global file
- when moving styles to global, ensure they are genuinely cross-module
- when a selector is reused across multiple widgets, remove hidden dependence on any one widget stylesheet
- keep compact information density; avoid giant cards unless the content warrants it
- desktop app UI should privilege scanability over decorative spacing

## Known style debt

- there is still overlap between global and module-family styles
- some modules are more polished than others
- detached map styling is separate and should stay separate, but common primitives could still be shared
- widget content density is still manually tuned rather than driven by a design token system

This should be treated as active cleanup territory, not as a stable final design system.
