# Claude Promotion Clock

Timezone-aware Vite + React dashboard that:

- shows a live local clock
- converts historical Claude peak and off-peak windows into the viewer timezone
- estimates the next likely promotion lift from the observed history

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm run check
```

## Data

Seed history lives in `src/data/promotionHistory.ts`.

Each record stores:

- `phase`: `peak` or `off_peak`
- `startedAtUtc` and `endedAtUtc`: ISO strings in UTC
- `observedCapacityDelta`: positive for lift, negative for slowdown
- `label` and `notes`: operator-facing context

Replace the seed file with your own observations to improve the forecast.
