# Data And Forecasting

This document describes the current implementation exactly as it exists in [promotionWebData.ts](/c:/ido%20harti/Script/claude%20promotion%20times/server/promotionWebData.ts) and [dashboardModel.ts](/c:/ido%20harti/Script/claude%20promotion%20times/src/services/dashboardModel.ts).

## 1. Where the app fetches data from

The backend uses three external sources plus one local operator file:

- Claude Help Center sitemap: `https://support.claude.com/sitemap.xml`
- Claude status feed: `https://status.claude.ai/api/v2/status.json` and `https://status.claude.ai/api/v2/incidents/unresolved.json`
- US public holidays: `https://date.nager.at/api/v3/PublicHolidays/{year}/US`
- Manual override file: `server/manualSignals.json`

The sitemap is scanned for article URLs that match this pattern:

```text
https://support.claude.com/en/articles/*usage-promotion
```

Those article URLs are treated as the only official Claude promotion inputs.

## 2. How the backend fetch works

The API entrypoint is [index.ts](/c:/ido%20harti/Script/claude%20promotion%20times/server/index.ts).

`GET /api/promotions` calls `getPromotionSnapshot()`.

`getPromotionSnapshot()`:

1. Returns a cached snapshot if it is younger than 2 minutes.
2. Otherwise rebuilds the full snapshot.

The cache TTL is defined by `CACHE_TTL_MS = 2 * 60 * 1000`.

## 3. How promotion articles are parsed

The parser supports two article shapes.

### Shape A: full-day off-peak campaign

Example pattern:

```text
from ... through ... UTC
```

This shape is parsed by:

- `extractUtcCampaignRange()`
- `parseFullDayPromotion()`

Result:

- One campaign record
- Every active day becomes a single `off_peak` window covering the campaign's active UTC span for that day

### Shape B: weekday peak band campaign

Example pattern:

```text
from ... through ... at ... PT
outside ... ET
```

This shape is parsed by:

- `extractPtCampaignRange()`
- `extractWeekdayPeakBand()`
- `parseWeekdayBandPromotion()`

`extractWeekdayPeakBand()` now tries:

- the original strict `outside ... ET` regex
- a looser fallback parser that scans ET lines for the first two clock times

If the fallback parser is used, or if an article cannot be parsed at all, the backend adds an entry to `parseWarnings`.

Result:

- One campaign record
- Weekdays are split into:
  - pre-peak `off_peak`
  - peak `peak`
  - post-peak `off_peak`
- Weekends become full-day `off_peak`

Important timezone rule:

- campaign calendar iteration is done in `America/Los_Angeles`
- weekday peak hours are defined in `America/New_York`

## 4. How windows are expanded

The window expander is `expandWindows()`.

It walks day by day across the campaign and clips each day's generated windows to the true campaign start/end timestamps.

Window labels are assigned like this:

- full-day campaign: `Official promotion window`
- weekday band before/after peak: `Official off-peak window`
- weekday band peak: `Weekday peak block`
- weekend in weekday-band campaign: `Weekend off-peak window`

## 5. How holiday context is fetched

Holiday dates are fetched from Nager.Date by year.

Rules:

- only US holidays are loaded
- only global holidays or holidays without county restriction are kept
- holiday sets are cached per year in memory
- if the holiday API fails, forecasting still continues without holiday context

That fallback is intentional. The backend logs a warning and falls back to weekday/weekend plus hour-of-day modeling only.

## 6. How the status feed and manual override work

The snapshot now also includes:

- `statusPage`: a summary of the live Claude status feed plus unresolved incidents
- `manualOverride`: an optional operator-authored note from `server/manualSignals.json`
- `parseWarnings`: parser fallback or failure warnings for article changes

These values do not change the official windows themselves, but they are surfaced in the UI so users can see active incidents, operator notes, or parser drift alongside the phase labels.

## 7. How the long-range campaign estimate is calculated

The long-range campaign estimate is built by `buildCampaignForecast()`.

### If an official campaign is active now

The result is:

- `kind = official_campaign`
- start/end copied directly from the active campaign
- confidence `0.95`

### If no official campaign is active

The estimate uses the published campaign history only.

Algorithm:

1. Sort campaigns by `startsAtUtc`
2. Compute all campaign start timestamps in milliseconds
3. Compute all campaign durations
4. Compute all gaps between consecutive campaign starts
5. Average the gaps
6. Average the durations
7. Predict:
   - `nextStart = lastStart + averageInterval`
   - `nextEnd = nextStart + averageDuration`
8. Measure interval volatility
9. Set confidence with:

```text
baseConfidence = clamp(0.45 - relativeVolatility * 0.2, 0.2, 0.55)
confidence = clamp(baseConfidence * min(1, intervals.length / 4), 0.05, 0.55)
```

This adds a sample-size penalty so a forecast derived from only one observed interval cannot look artificially strong.

## 8. How the hour-level phase model is built

The near-term hourly model is built by `buildPhaseProbabilityModel()`.

Reference timezone:

- `America/New_York`

Each campaign is weighted by recency:

```text
weight = campaign index + 1
```

So newer campaigns count more than older campaigns.

In addition to campaign history, the model now carries a permanent baseline:

- weekday peak baseline: `5 AM` through `11 AM` in `America/Los_Angeles`
- baseline support: `0.55`
- baseline blend weight: `0.35` when historical campaign data exists, `0.55` when it does not

This baseline is synthetic. It is not treated as a live campaign, but it prevents the app from collapsing to pure historical spacing when no Help Center promotion is live.

For every overlapping hour in every official window, the model accumulates:

- weekday x hour slot totals
- weekday-only hour totals
- weekend-only hour totals
- holiday-only hour totals
- overall hour totals
- global peak/off-peak totals

The model stores probabilities for both phases plus the baseline blend metadata:

- `offPeakBySlot`
- `peakBySlot`
- `offPeakByWeekdayHour`
- `peakByWeekdayHour`
- `offPeakByWeekendHour`
- `peakByWeekendHour`
- `offPeakByHolidayHour`
- `peakByHolidayHour`
- `offPeakByHour`
- `peakByHour`
- `offPeakGlobal`
- `peakGlobal`
- `baselineWeight`
- `baselineSupport`

It also stores support values so the scorer knows whether a slot has enough evidence.

## 9. How a single hour is scored

The scorer is `getPhaseScores()`.

For a target UTC timestamp, it converts to `America/New_York` and looks up:

- weekday slot support
- weekday/weekend context support
- holiday support
- overall hour support

Then it blends probabilities using these weights:

- slot weight: `0.4` when slot support exists
- weekday/weekend context weight: `0.3` when slot support exists, otherwise `0.5`
- holiday weight: `0.2` when holiday support exists
- plain hour weight: `0.1` when slot support exists, otherwise `0.2`
- global fallback weight: whatever remains to make the total `1.0`

After the historical blend is computed, the permanent weekday baseline is mixed in as an additional probability source.

The function returns:

- `offPeak` score
- `peak` score
- normalized `support`

## 10. How next off-peak and next peak are estimated

The final forecast is built by `buildForecast()`.

### Case A: an official campaign is active now

The app does not infer hours when official windows exist.

It uses `findOfficialPhaseForecast()`:

- `nextOffPeak` can return the current off-peak window if we are already inside one
- `nextPeak` returns the next future peak start, not the current peak block

### Case B: no official campaign is active now

The app uses `inferNearTermPhaseForecast()`.

Important behavior:

- search horizon: next `7 * 24` hours
- the algorithm scans hour by hour from the current hour forward
- each hour is classified as `peak` or `off_peak` by whichever score is larger
- once the target phase starts, the algorithm extends the run until the dominant phase flips

Confidence is computed from:

- average target score during the run
- average margin over the competing phase
- average support

Formula:

```text
confidence = clamp(
  0.2 + averageScore * 0.2 + averageMargin * 0.3 + averageSupport * 0.2,
  0.2,
  0.72
)
```

The near-term phase forecast is therefore:

- short-range
- baseline-plus-history inferred
- separate from the long-range public campaign estimate

## 11. How the frontend uses the data

The client-side transformer is [dashboardModel.ts](/c:/ido%20harti/Script/claude%20promotion%20times/src/services/dashboardModel.ts).

### Current clock

The clock shows four different things:

1. `Official Status`
   - exact live official window if one exists
   - otherwise `No Promotion Live`

2. `Platform Status`
   - live status feed summary from `status.claude.ai`
   - unresolved incidents if any exist

3. `Off-Peak Now`
   - if an official window is active: exact yes/no from that live window
   - otherwise: current phase from the permanent weekday baseline, recomputed in the browser every tick

4. `Historical Pattern`
   - the current hour's aggregate historical tendency

Important:

- `Off-Peak Now` outside an official campaign is an estimate, not a published Claude guarantee

### Status notices

The app also renders a separate notice strip for:

- active status incidents
- manual override text from `server/manualSignals.json`
- parser warnings when article wording drifts

### Forecast cards

- `Next Off-Peak Window`: official if available, otherwise near-term inferred
- `Next Peak Start`: official if available, otherwise near-term inferred
- `Next Public Promo Campaign`: long-range campaign spacing estimate

The client refreshes the snapshot every 2 minutes to keep these server-built cards closer to the current hour boundary.

### Today's chart and last-7-days heatmap

These are intentionally stricter than the forecast cards.

They use real official windows only:

- the daily chart uses only today's official windows
- the heatmap uses a rolling 7-day range ending today in the viewer's timezone
- hours with no official coverage are marked as no-data

So these charts do not fill empty days with inferred history.

## 12. What is official vs inferred

Official:

- discovered campaign pages
- parsed campaign ranges
- expanded peak/off-peak windows from those articles
- live current status if a campaign is active
- charts/heatmap rows that fall inside official windows
- `statusPage` platform-health metadata

Inferred:

- `Off-Peak Now` when no official promotion is live
- `Next Off-Peak Window` when no official promotion is live
- `Next Peak Start` when no official promotion is live
- `Next Public Promo Campaign`

Operational context:

- `manualOverride` is local operator context, not an Anthropic feed
- `parseWarnings` are internal diagnostics about scraper robustness

## 13. Current limitations

- The official source set is very small, so long-range estimates are weak.
- Public Help Center promotions are not the same thing as a full internal demand model.
- A strong-looking hour estimate is still only a heuristic when no official live window exists.
- If the source article wording changes, parsing may still fail even with the fallback parser, but the snapshot now exposes `parseWarnings` instead of failing silently.
