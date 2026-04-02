# Conventions

## Code
Use strict TypeScript and keep calculations deterministic.

Prefer storing normalized campaign timestamps in UTC ISO 8601 strings and converting to local time at the edge.

Keep UI components presentational. Any derived labels or scoring logic belongs in `src/services`.

## Product
The app should clearly distinguish official published windows from forecasted estimates.

If the Help Center article shape changes and parsing becomes uncertain, fail loudly instead of silently inventing data.

## Styling
Use a high-contrast dashboard look with intentional typography and dense information blocks.

Treat `refs/design` as the visual source of truth and keep implementation drift low.
