# Claude Promotion Clock

Timezone-aware web app that mirrors the provided Figma design, fetches official Claude promotion pages from the web, converts every published peak and off-peak window into the viewer timezone, and updates the dashboard clock in real time.

## What It Uses

- Frontend: Vite, React 19, TypeScript, Tailwind CSS 4, Recharts
- Backend: Express 5, TypeScript, Cheerio, Luxon
- Data source: official Claude Help Center promotion articles discovered from `https://support.claude.com/sitemap.xml`

## Run

```bash
npm install
npm run dev
```

That starts:

- the API on `http://127.0.0.1:8787`
- the Vite app on its default local port with `/api` proxied to the backend

## Netlify Deploy

The repository includes [netlify.toml](/c:/ido%20harti/Script/claude%20promotion%20times/netlify.toml) and Netlify Functions under `netlify/functions/` so `/api/promotions` and `/api/health` work on a static Netlify deploy. Netlify should build with `npm run build`, publish `dist`, and serve the backend through the function redirects.

## Verify

```bash
npm run check
```

## Runtime Audit

With the app already running locally:

```bash
npm run audit:screenshots
```

Artifacts are written to `audit-artifacts/latest/` by default and include desktop/mobile screenshots plus a JSON audit log with console and failed-request details.

## CI

GitHub Actions runs on push and pull request. It installs dependencies, runs `npm run check`, starts the backend, and smoke-tests `GET /api/promotions` so frontend and backend regressions are caught before release.

## Data Model

The backend scrapes official promotion campaign pages and normalizes them into:

- `campaigns`: top-level published promotion periods
- `windows`: expanded peak and off-peak time windows in UTC
- `forecast.campaign`: either the currently active official campaign or a low-confidence estimate based on spacing between published campaigns
- `forecast.nextOffPeak`: the next exact official off-peak window when a campaign is live, otherwise a history-inferred hourly off-peak prediction inside the estimated campaign
- `forecast.nextPeak`: the next exact official peak window when a campaign is live, otherwise a history-inferred hourly peak prediction inside the estimated campaign

The hour-level inference is computed from real official promotion history using ET day-of-week, weekend, hour, and US public holiday context, but it is only as strong as the number of campaigns currently published on the Help Center. With a small campaign sample, confidence stays intentionally low.

The clock intentionally distinguishes official live status from historical pattern signals so the UI does not present inferred pressure as live Claude telemetry.

## Design Reference

The Figma-exported reference app lives under `refs/design`. It is treated as a design input, not a runtime dependency, and is excluded from linting.
