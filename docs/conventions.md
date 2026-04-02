# Conventions

## Code
Use strict TypeScript and keep calculations deterministic.

Prefer storing history timestamps in UTC ISO 8601 strings and converting to local time at the edge.

Keep UI components presentational. Any derived labels or scoring logic belongs in `src/services`.

## Product
The app should clearly distinguish observed history from forecasted estimates.

If no authoritative external feed exists, label the loaded dataset as observed or demo history.

## Styling
Use a high-contrast dashboard look with intentional typography and dense information blocks.

Favor reusable CSS utility classes only when they reduce repetition; do not build a utility framework.
