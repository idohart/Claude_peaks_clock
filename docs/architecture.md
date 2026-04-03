# Architecture

## Purpose
The app is a web-backed dashboard. An Express service scrapes official Claude Help Center promotion pages, fetches the Claude status feed plus US public holiday context, applies a permanent weekday baseline for current peak hours, normalizes campaigns into UTC windows, derives campaign-level and hour-level forecasts, and the React client converts those windows into the viewer's timezone for a real-time dashboard.

## Layers
`src/types` -> shared contracts only

`server` -> web scraping, status/manual signal loading, normalization, API routes

`src/lib` -> stateless time helpers

`src/services` -> client-side view-model shaping from API payloads

`src/app` -> presentation components only

`refs/design` -> Figma-derived design reference only, not runtime code

## Dependency Rules
`src/app` may import from `src/services`, `src/lib`, and `src/types`, but not from `server`.

`src/services` may import from `src/lib` and `src/types`.

`server` may import from `src/types`, but must not import from `src/app`.

`src/lib` may import from `src/types` only.

`src/types` must not import from any other app layer.

## Constraints
Import boundaries are enforced in `check.sh`.

Any claim about "next promotion", "next off-peak", or "next peak" must be produced from official published campaign history plus the documented permanent weekday baseline in code, not a hard-coded date string in UI components.

Timezone formatting must be performed in the service or helper layers so UI code stays declarative.
