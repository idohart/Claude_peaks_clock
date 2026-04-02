# Architecture

## Purpose
The app is a client-side dashboard. It reads a historical dataset of Claude peak and off-peak windows, converts those windows into the viewer's timezone, derives forecast signals, and renders a real-time interface.

## Layers
`src/types` -> shared contracts only

`src/data` -> historical source data

`src/lib` -> stateless time helpers

`src/services` -> analytics, forecasting, view-model shaping

`src/ui` -> presentation components only

`src/App.tsx` -> composition root

## Dependency Rules
`src/ui` may import from `src/services`, `src/lib`, and `src/types`, but not from `src/data`.

`src/services` may import from `src/data`, `src/lib`, and `src/types`.

`src/lib` may import from `src/types` only.

`src/types` must not import from any other app layer.

## Constraints
Import boundaries are enforced in `check.sh` with grep checks.

The app is dataset-driven. Any claim about "next promotion" must be produced from observed history in code, not a hard-coded date string in UI components.

Timezone formatting must be performed in the service or helper layers so UI code stays declarative.
