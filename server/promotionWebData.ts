import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load } from 'cheerio';
import { DateTime } from 'luxon';

import {
  PERMANENT_WEEKDAY_PEAK_BASELINE,
  type ClaudeStatusSummary,
  type HourlyScore,
  type PromotionManualOverride,
  type PromotionParseWarning,
  PromotionCampaign,
  PromotionForecast,
  PromotionPhase,
  PromotionSnapshotResponse,
  PromotionWindow,
} from '../src/types/promotion';

const SUPPORT_SITEMAP_URL = 'https://support.claude.com/sitemap.xml';
const HOLIDAY_API_BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const HOLIDAY_COUNTRY_CODE = 'US';
const STATUS_PAGE_BASE_URL = 'https://status.claude.ai';
const STATUS_PAGE_STATUS_URL = `${STATUS_PAGE_BASE_URL}/api/v2/status.json`;
const STATUS_PAGE_INCIDENTS_URL = `${STATUS_PAGE_BASE_URL}/api/v2/incidents/unresolved.json`;
const SOURCE_LABEL = 'Official Claude Help Center promotion pages';
const CACHE_TTL_MS = 2 * 60 * 1000;
const MANUAL_SIGNALS_PATH = join(process.cwd(), 'server', 'manualSignals.json');
const BASELINE_WITH_HISTORY_WEIGHT = 0.35;
const BASELINE_WITHOUT_HISTORY_WEIGHT = 0.55;

type ScheduleRule =
  | {
      kind: 'all_day_off_peak';
      zone: string;
    }
  | {
      kind: 'weekday_peak_band';
      zone: string;
      peakZone: string;
      peakStartHour: number;
      peakEndHour: number;
    };

interface ParsedCampaignBundle {
  campaign: PromotionCampaign;
  windows: PromotionWindow[];
}

interface WeekdayPeakBand {
  peakStartHour: number;
  peakEndHour: number;
  parser: 'strict' | 'fallback';
}

interface CachedSnapshot {
  expiresAt: number;
  snapshot: PromotionSnapshotResponse;
}

interface PhaseProbabilityModel {
  offPeakBySlot: number[][];
  peakBySlot: number[][];
  slotSupport: number[][];
  offPeakByWeekdayHour: number[];
  peakByWeekdayHour: number[];
  weekdayHourSupport: number[];
  offPeakByWeekendHour: number[];
  peakByWeekendHour: number[];
  weekendHourSupport: number[];
  offPeakByHolidayHour: number[];
  peakByHolidayHour: number[];
  holidayHourSupport: number[];
  offPeakByHour: number[];
  peakByHour: number[];
  hourSupport: number[];
  offPeakGlobal: number;
  peakGlobal: number;
  totalWeight: number;
  baselineWeight: number;
  baselineSupport: number;
}

let cachedSnapshot: CachedSnapshot | null = null;
let pendingRefresh: Promise<PromotionSnapshotResponse> | null = null;
const holidayCacheByYear = new Map<number, Set<string>>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ClaudePromotionClock/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'ClaudePromotionClock/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function readManualSignalsFile(): PromotionManualOverride | null {
  try {
    const parsed = JSON.parse(readFileSync(MANUAL_SIGNALS_PATH, 'utf8')) as Partial<
      PromotionManualOverride & { enabled: boolean }
    >;

    if (!parsed.enabled || typeof parsed.message !== 'string' || parsed.message.trim().length === 0) {
      return null;
    }

    return {
      message: parsed.message.trim(),
      severity:
        parsed.severity === 'info' || parsed.severity === 'warning' || parsed.severity === 'critical'
          ? parsed.severity
          : 'warning',
      source: typeof parsed.source === 'string' && parsed.source.trim().length > 0 ? parsed.source.trim() : null,
      updatedAtUtc:
        typeof parsed.updatedAtUtc === 'string' && parsed.updatedAtUtc.trim().length > 0
          ? parsed.updatedAtUtc.trim()
          : null,
    };
  } catch (error) {
    console.warn(
      `Manual signals file unavailable, continuing without operator overrides: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

function toTwentyFourHour(hour: number, meridiem: string): number {
  const normalizedHour = hour % 12;
  return meridiem.toUpperCase() === 'PM' ? normalizedHour + 12 : normalizedHour;
}

function extractPromotionUrls(sitemapXml: string): string[] {
  return [...new Set([...sitemapXml.matchAll(/https:\/\/support\.claude\.com\/en\/articles\/[^\s<"]*usage-promotion/g)].map((match) => match[0]))]
    .sort();
}

function extractArticleText(html: string): { title: string; updatedAtUtc: string | null; text: string } {
  const $ = load(html);
  const title =
    normalizeWhitespace($('h1').first().text()) ||
    normalizeWhitespace($('title').first().text().replace(' | Claude Help Center', ''));
  const updatedAtUtc = html.match(/"lastUpdatedISO":"([^"]+)"/)?.[1] ?? null;
  const blocks = $('div.intercom-interblocks-paragraph p, div.intercom-interblocks-subheading h2, li div.intercom-interblocks-paragraph p')
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter(Boolean);

  return {
    title,
    updatedAtUtc,
    text: blocks.join('\n'),
  };
}

function parseDateInZone(value: string, zone: string, formats: string[]): DateTime {
  for (const format of formats) {
    const parsed = DateTime.fromFormat(value, format, { zone });
    if (parsed.isValid) {
      return parsed;
    }
  }

  throw new Error(`Could not parse date "${value}" in zone ${zone}`);
}

function extractUtcCampaignRange(articleText: string): { startsAt: DateTime; endsAt: DateTime } | null {
  const match = articleText.match(
    /(?:running|available|valid)?\s*from\s+(?:[A-Za-z]+,\s+)?([A-Za-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M UTC)\s+through\s+(?:[A-Za-z]+,\s+)?([A-Za-z]+ \d{1,2}(?:, \d{4})? at \d{1,2}:\d{2} [AP]M UTC)/i,
  );
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  const startYear = rawStart.match(/,\s*(\d{4})\s+at/i)?.[1];
  const normalizedEnd = startYear && !/,\s*\d{4}\s+at/i.test(rawEnd)
    ? rawEnd.replace(/\s+at/i, `, ${startYear} at`)
    : rawEnd;

  return {
    startsAt: parseDateInZone(rawStart, 'utc', ["LLLL d, yyyy 'at' h:mm a 'UTC'"]),
    endsAt: parseDateInZone(normalizedEnd, 'utc', ["LLLL d, yyyy 'at' h:mm a 'UTC'"]),
  };
}

function extractPtCampaignRange(articleText: string): { startsAt: DateTime; endsAt: DateTime } | null {
  const match = articleText.match(
    /(?:valid\s+)?from\s+([A-Za-z]+ \d{1,2}, \d{4})\s+through\s+([A-Za-z]+ \d{1,2}, \d{4})\s+at\s+(\d{1,2}:\d{2}\s+[AP]M)\s+PT/i,
  );
  if (!match) {
    return null;
  }

  const [, rawStartDate, rawEndDate, rawEndTime] = match;

  return {
    startsAt: parseDateInZone(`${rawStartDate} at 12:00 AM PT`, 'America/Los_Angeles', [
      "LLLL d, yyyy 'at' h:mm a 'PT'",
    ]),
    endsAt: parseDateInZone(`${rawEndDate} at ${rawEndTime} PT`, 'America/Los_Angeles', [
      "LLLL d, yyyy 'at' h:mm a 'PT'",
    ]),
  };
}

function extractHourRange(candidateText: string): { peakStartHour: number; peakEndHour: number } | null {
  const matches = [...candidateText.matchAll(/\b(\d{1,2})(?::\d{2})?\s*(AM|PM)\b/gi)];
  if (matches.length < 2) {
    return null;
  }

  const [firstMatch, secondMatch] = matches;
  return {
    peakStartHour: toTwentyFourHour(Number.parseInt(firstMatch[1], 10), firstMatch[2]),
    peakEndHour: toTwentyFourHour(Number.parseInt(secondMatch[1], 10), secondMatch[2]),
  };
}

function extractWeekdayPeakBand(articleText: string): WeekdayPeakBand | null {
  const match = articleText.match(
    /outside\s+(\d{1,2})(?::\d{2})?\s*(AM|PM)\s*-\s*(\d{1,2})(?::\d{2})?\s*(AM|PM)\s*ET/i,
  );
  if (!match) {
    const candidateLines = articleText
      .split('\n')
      .map((line) => normalizeWhitespace(line))
      .filter((line) => /\bET\b/i.test(line) && /(outside|weekday|weekdays|peak)/i.test(line));

    for (const candidateLine of candidateLines) {
      const range = extractHourRange(candidateLine);
      if (range) {
        return {
          ...range,
          parser: 'fallback',
        };
      }
    }

    const normalizedArticle = normalizeWhitespace(articleText);
    const fallbackMatch = normalizedArticle.match(
      /((?:outside|weekday|weekdays|peak)[^.]{0,160}\bET\b[^.]*)/i,
    )?.[1];
    if (!fallbackMatch) {
      return null;
    }

    const range = extractHourRange(fallbackMatch);
    return range
      ? {
          ...range,
          parser: 'fallback',
        }
      : null;
  }

  const [, rawStartHour, rawStartMeridiem, rawEndHour, rawEndMeridiem] = match;

  return {
    peakStartHour: toTwentyFourHour(Number.parseInt(rawStartHour, 10), rawStartMeridiem),
    peakEndHour: toTwentyFourHour(Number.parseInt(rawEndHour, 10), rawEndMeridiem),
    parser: 'strict',
  };
}

function campaignIdFromUrl(url: string): string {
  const slug = url.split('/').pop() ?? 'promotion';
  return slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function makeWindowId(campaignId: string, phase: PromotionWindow['phase'], startedAtUtc: string): string {
  return `${campaignId}-${phase}-${startedAtUtc}`;
}

function buildCampaign(title: string, sourceUrl: string, summary: string, startsAtUtc: string, endsAtUtc: string, updatedAtUtc: string | null, scheduleSummary: string): PromotionCampaign {
  return {
    id: campaignIdFromUrl(sourceUrl),
    title,
    sourceUrl,
    summary,
    startsAtUtc,
    endsAtUtc,
    updatedAtUtc,
    scheduleSummary,
  };
}

function createDayHourMatrix(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

function createHourArray(): number[] {
  return Array.from({ length: 24 }, () => 0);
}

function forEachOverlappingHour(
  startedAt: DateTime,
  endedAt: DateTime,
  visitor: (cursor: DateTime, overlapHours: number) => void,
): void {
  let cursor = startedAt.startOf('hour');

  while (cursor < endedAt) {
    const nextCursor = cursor.plus({ hours: 1 });
    const activeStart = startedAt > cursor ? startedAt : cursor;
    const activeEnd = endedAt < nextCursor ? endedAt : nextCursor;
    const overlapHours = activeEnd.diff(activeStart, 'minutes').minutes / 60;

    if (overlapHours > 0) {
      visitor(cursor, overlapHours);
    }

    cursor = nextCursor;
  }
}

function getPhaseLabel(phase: PromotionPhase): string {
  return phase === 'off_peak' ? 'Off-Peak' : 'Peak';
}

function isHoliday(dateTime: DateTime, holidayDates: Set<string>): boolean {
  const isoDate = dateTime.toISODate();
  return isoDate ? holidayDates.has(isoDate) : false;
}

function isPermanentWeekdayPeak(atUtc: DateTime): boolean {
  const referenceTime = atUtc.setZone(PERMANENT_WEEKDAY_PEAK_BASELINE.zone);
  return (
    referenceTime.weekday <= 5 &&
    referenceTime.hour >= PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayStartHour &&
    referenceTime.hour < PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayEndHour
  );
}

async function getHolidayDatesForYear(year: number): Promise<Set<string>> {
  const cached = holidayCacheByYear.get(year);
  if (cached) {
    return cached;
  }

  const holidays = await fetchJson<Array<{ date: string; global?: boolean; counties?: string[] | null }>>(
    `${HOLIDAY_API_BASE_URL}/${year}/${HOLIDAY_COUNTRY_CODE}`,
  );
  const holidayDates = new Set(
    holidays
      .filter((holiday) => holiday.global !== false || !holiday.counties || holiday.counties.length === 0)
      .map((holiday) => holiday.date),
  );

  holidayCacheByYear.set(year, holidayDates);
  return holidayDates;
}

async function getHolidayDates(years: number[]): Promise<Set<string>> {
  const uniqueYears = [...new Set(years)].sort((left, right) => left - right);
  const yearSets = await Promise.all(uniqueYears.map((year) => getHolidayDatesForYear(year)));
  return new Set(yearSets.flatMap((yearSet) => [...yearSet]));
}

function expandWindows(campaign: PromotionCampaign, rule: ScheduleRule): PromotionWindow[] {
  const windows: PromotionWindow[] = [];
  const campaignStartUtc = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' });
  const campaignEndUtc = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' });
  let cursor = campaignStartUtc.setZone(rule.zone).startOf('day');
  const finalDay = campaignEndUtc.setZone(rule.zone).startOf('day');

  while (cursor <= finalDay) {
    const dayStartUtc = cursor.startOf('day').toUTC();
    const dayEndUtc = cursor.endOf('day').toUTC();
    const activeStartUtc = dayStartUtc < campaignStartUtc ? campaignStartUtc : dayStartUtc;
    const activeEndUtc = dayEndUtc > campaignEndUtc ? campaignEndUtc : dayEndUtc;

    if (activeStartUtc < activeEndUtc) {
      if (rule.kind === 'all_day_off_peak') {
        windows.push({
          id: makeWindowId(campaign.id, 'off_peak', activeStartUtc.toISO() ?? campaign.startsAtUtc),
          campaignId: campaign.id,
          phase: 'off_peak',
          startedAtUtc: activeStartUtc.toISO() ?? campaign.startsAtUtc,
          endedAtUtc: activeEndUtc.toISO() ?? campaign.endsAtUtc,
          label: 'Official promotion window',
          notes: 'Published as doubled-usage availability in the Claude Help Center.',
          sourceUrl: campaign.sourceUrl,
        });
      } else if (cursor.weekday <= 5) {
        const peakStartUtc = DateTime.fromObject(
          {
            year: cursor.year,
            month: cursor.month,
            day: cursor.day,
            hour: rule.peakStartHour,
          },
          { zone: rule.peakZone },
        ).toUTC();
        const peakEndUtc = DateTime.fromObject(
          {
            year: cursor.year,
            month: cursor.month,
            day: cursor.day,
            hour: rule.peakEndHour,
          },
          { zone: rule.peakZone },
        ).toUTC();

        if (activeStartUtc < peakStartUtc) {
          windows.push({
            id: makeWindowId(campaign.id, 'off_peak', activeStartUtc.toISO() ?? campaign.startsAtUtc),
            campaignId: campaign.id,
            phase: 'off_peak',
            startedAtUtc: activeStartUtc.toISO() ?? campaign.startsAtUtc,
            endedAtUtc: peakStartUtc.toISO() ?? campaign.endsAtUtc,
            label: 'Official off-peak window',
            notes: 'Published as doubled-usage availability outside the weekday peak band.',
            sourceUrl: campaign.sourceUrl,
          });
        }

        if (peakStartUtc < peakEndUtc) {
          const clippedPeakStart = peakStartUtc < activeStartUtc ? activeStartUtc : peakStartUtc;
          const clippedPeakEnd = peakEndUtc > activeEndUtc ? activeEndUtc : peakEndUtc;
          if (clippedPeakStart < clippedPeakEnd) {
            windows.push({
              id: makeWindowId(campaign.id, 'peak', clippedPeakStart.toISO() ?? campaign.startsAtUtc),
              campaignId: campaign.id,
              phase: 'peak',
              startedAtUtc: clippedPeakStart.toISO() ?? campaign.startsAtUtc,
              endedAtUtc: clippedPeakEnd.toISO() ?? campaign.endsAtUtc,
              label: 'Weekday peak block',
              notes: 'Published as unchanged usage during weekday business-hour demand.',
              sourceUrl: campaign.sourceUrl,
            });
          }
        }

        if (peakEndUtc < activeEndUtc) {
          windows.push({
            id: makeWindowId(campaign.id, 'off_peak', peakEndUtc.toISO() ?? campaign.startsAtUtc),
            campaignId: campaign.id,
            phase: 'off_peak',
            startedAtUtc: peakEndUtc.toISO() ?? campaign.startsAtUtc,
            endedAtUtc: activeEndUtc.toISO() ?? campaign.endsAtUtc,
            label: 'Official off-peak window',
            notes: 'Published as doubled-usage availability outside the weekday peak band.',
            sourceUrl: campaign.sourceUrl,
          });
        }
      } else {
        windows.push({
          id: makeWindowId(campaign.id, 'off_peak', activeStartUtc.toISO() ?? campaign.startsAtUtc),
          campaignId: campaign.id,
          phase: 'off_peak',
          startedAtUtc: activeStartUtc.toISO() ?? campaign.startsAtUtc,
          endedAtUtc: activeEndUtc.toISO() ?? campaign.endsAtUtc,
          label: 'Weekend off-peak window',
          notes: 'Weekends remain fully eligible in the published promotion schedule.',
          sourceUrl: campaign.sourceUrl,
        });
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  return windows;
}

function parseFullDayPromotion(
  range: { startsAt: DateTime; endsAt: DateTime },
  title: string,
  sourceUrl: string,
  updatedAtUtc: string | null,
): ParsedCampaignBundle {
  const campaign = buildCampaign(
    title,
    sourceUrl,
    'Published promotion with doubled usage for the full campaign period.',
    range.startsAt.toUTC().toISO() ?? range.startsAt.toString(),
    range.endsAt.toUTC().toISO() ?? range.endsAt.toString(),
    updatedAtUtc,
    'Full-day doubled usage throughout the campaign.',
  );

  return {
    campaign,
    windows: expandWindows(campaign, { kind: 'all_day_off_peak', zone: 'utc' }),
  };
}

function parseWeekdayBandPromotion(
  range: { startsAt: DateTime; endsAt: DateTime },
  peakBand: WeekdayPeakBand,
  title: string,
  sourceUrl: string,
  updatedAtUtc: string | null,
): ParsedCampaignBundle {
  const campaign = buildCampaign(
    title,
    sourceUrl,
    'Weekday business hours stay unchanged; off-peak weekday hours and weekends get doubled usage.',
    range.startsAt.toUTC().toISO() ?? range.startsAt.toString(),
    range.endsAt.toUTC().toISO() ?? range.endsAt.toString(),
    updatedAtUtc,
    `Off-peak outside ${peakBand.peakStartHour
      .toString()
      .padStart(2, '0')}:00-${peakBand.peakEndHour.toString().padStart(2, '0')}:00 ET on weekdays; weekends remain fully eligible.`,
  );

  return {
    campaign,
    windows: expandWindows(campaign, {
      kind: 'weekday_peak_band',
      zone: 'America/Los_Angeles',
      peakZone: 'America/New_York',
      peakStartHour: peakBand.peakStartHour,
      peakEndHour: peakBand.peakEndHour,
    }),
  };
}

function parsePromotionArticle(
  sourceUrl: string,
  html: string,
): { bundle: ParsedCampaignBundle; warnings: PromotionParseWarning[] } {
  const article = extractArticleText(html);
  const ptRange = extractPtCampaignRange(article.text);
  const peakBand = extractWeekdayPeakBand(article.text);

  if (peakBand && ptRange) {
    return {
      bundle: parseWeekdayBandPromotion(ptRange, peakBand, article.title, sourceUrl, article.updatedAtUtc),
      warnings:
        peakBand.parser === 'fallback'
          ? [
              {
                sourceUrl,
                message: `Used fallback ET hour parsing for "${article.title}". Review this article if Anthropic rewords the weekday peak band again.`,
              },
            ]
          : [],
    };
  }

  const utcRange = extractUtcCampaignRange(article.text);
  if (utcRange) {
    return {
      bundle: parseFullDayPromotion(utcRange, article.title, sourceUrl, article.updatedAtUtc),
      warnings: [],
    };
  }

  throw new Error(`Unsupported promotion article shape: ${article.title}`);
}

async function fetchStatusPageSummary(): Promise<ClaudeStatusSummary | null> {
  try {
    const start = Date.now();
    const [statusResponse, incidentsResponse] = await Promise.all([
      fetchJson<{
        page: { url?: string };
        status: { indicator: string; description: string };
      }>(STATUS_PAGE_STATUS_URL),
      fetchJson<{
        incidents: Array<{
          id: string;
          name: string;
          status: string;
          impact: string;
          shortlink?: string | null;
          updated_at?: string | null;
        }>;
      }>(STATUS_PAGE_INCIDENTS_URL),
    ]);
    const latencyMs = Date.now() - start;

    return {
      indicator: statusResponse.status.indicator,
      description: statusResponse.status.description,
      url: statusResponse.page.url ?? STATUS_PAGE_BASE_URL,
      latencyMs,
      activeIncidents: incidentsResponse.incidents.map((incident) => ({
        id: incident.id,
        name: incident.name,
        status: incident.status,
        impact: incident.impact,
        shortlink: incident.shortlink ?? null,
        updatedAtUtc: incident.updated_at ?? null,
      })),
    };
  } catch (error) {
    console.warn(
      `Status page feed unavailable, continuing without incident context: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

function buildCampaignForecast(
  campaigns: PromotionCampaign[],
  nowUtc: DateTime,
): PromotionForecast['campaign'] {
  const sortedCampaigns = [...campaigns].sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc));
  const activeCampaigns = sortedCampaigns.filter((campaign) => {
    const start = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' });
    const end = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' });
    return nowUtc >= start && nowUtc <= end;
  });

  if (activeCampaigns.length > 0) {
    const activeCampaign = activeCampaigns[0];
    return {
      kind: 'official_campaign',
      startsAtUtc: activeCampaign.startsAtUtc,
      endsAtUtc: activeCampaign.endsAtUtc,
      confidence: 0.95,
      explanation: 'Taken directly from an active official Claude promotion campaign.',
      basis: 'Current Claude Help Center promotion campaign',
      matchedCampaigns: activeCampaigns.length,
    };
  }

  if (sortedCampaigns.length < 2) {
    return null;
  }

  const startTimes = sortedCampaigns.map((campaign) =>
    DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' }).toMillis(),
  );
  const durations = sortedCampaigns.map((campaign) => {
    const start = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' });
    const end = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' });
    return end.diff(start).as('milliseconds');
  });
  const intervals = startTimes.slice(1).map((value, index) => value - startTimes[index]);
  const averageInterval = intervals.reduce((total, value) => total + value, 0) / intervals.length;
  const averageDuration = durations.reduce((total, value) => total + value, 0) / durations.length;
  const variance =
    intervals.reduce((total, value) => total + (value - averageInterval) * (value - averageInterval), 0) /
    intervals.length;
  const relativeVolatility = Math.sqrt(variance) / averageInterval;
  const sampleSizePenalty = Math.min(1, intervals.length / 4);
  const nextStart = DateTime.fromMillis(startTimes[startTimes.length - 1] + averageInterval, { zone: 'utc' });
  const nextEnd = nextStart.plus({ milliseconds: averageDuration });
  const baseConfidence = clamp(0.45 - relativeVolatility * 0.2, 0.2, 0.55);

  return {
    kind: 'estimated_campaign',
    startsAtUtc: nextStart.toISO() ?? nextStart.toString(),
    endsAtUtc: nextEnd.toISO() ?? nextEnd.toString(),
    confidence: clamp(baseConfidence * sampleSizePenalty, 0.05, 0.55),
    explanation: 'Estimated from the spacing between official Claude usage promotions discovered on support.claude.com.',
    basis: `Average gap of ${Math.round(averageInterval / (1000 * 60 * 60 * 24))} days between published campaigns, penalized for a small sample of ${intervals.length} observed interval${intervals.length === 1 ? '' : 's'}`,
    matchedCampaigns: sortedCampaigns.length,
  };
}

function buildPhaseProbabilityModel(
  campaigns: PromotionCampaign[],
  windows: PromotionWindow[],
  holidayDates: Set<string>,
): PhaseProbabilityModel {
  const canonicalZone = 'America/New_York';
  const sortedCampaigns = [...campaigns].sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc));
  const offPeakBySlot = createDayHourMatrix();
  const peakBySlot = createDayHourMatrix();
  const slotSupport = createDayHourMatrix();
  const offPeakByWeekdayHour = createHourArray();
  const peakByWeekdayHour = createHourArray();
  const weekdayHourSupport = createHourArray();
  const offPeakByWeekendHour = createHourArray();
  const peakByWeekendHour = createHourArray();
  const weekendHourSupport = createHourArray();
  const offPeakByHolidayHour = createHourArray();
  const peakByHolidayHour = createHourArray();
  const holidayHourSupport = createHourArray();
  const offPeakByHour = createHourArray();
  const peakByHour = createHourArray();
  const hourSupport = createHourArray();
  let offPeakGlobal = 0;
  let peakGlobal = 0;
  let globalSupport = 0;
  let totalWeight = 0;

  sortedCampaigns.forEach((campaign, index) => {
    const weight = index + 1;
    const totalBySlot = createDayHourMatrix();
    const offPeakHoursBySlot = createDayHourMatrix();
    const peakHoursBySlot = createDayHourMatrix();
    const totalByWeekdayHour = createHourArray();
    const offPeakHoursByWeekdayHour = createHourArray();
    const peakHoursByWeekdayHour = createHourArray();
    const totalByWeekendHour = createHourArray();
    const offPeakHoursByWeekendHour = createHourArray();
    const peakHoursByWeekendHour = createHourArray();
    const totalByHolidayHour = createHourArray();
    const offPeakHoursByHolidayHour = createHourArray();
    const peakHoursByHolidayHour = createHourArray();
    const totalByHour = createHourArray();
    const offPeakHoursByHour = createHourArray();
    const peakHoursByHour = createHourArray();
    let totalHours = 0;
    let totalOffPeakHours = 0;
    let totalPeakHours = 0;

    windows
      .filter((window) => window.campaignId === campaign.id)
      .forEach((window) => {
        const startedAt = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' }).setZone(canonicalZone);
        const endedAt = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' }).setZone(canonicalZone);

        forEachOverlappingHour(startedAt, endedAt, (cursor, overlapHours) => {
          const dayIndex = cursor.weekday - 1;
          const hour = cursor.hour;
          const weekend = cursor.weekday >= 6;
          const holiday = isHoliday(cursor, holidayDates);

          totalBySlot[dayIndex][hour] += overlapHours;
          totalByHour[hour] += overlapHours;
          totalHours += overlapHours;

          if (weekend) {
            totalByWeekendHour[hour] += overlapHours;
          } else {
            totalByWeekdayHour[hour] += overlapHours;
          }

          if (holiday) {
            totalByHolidayHour[hour] += overlapHours;
          }

          if (window.phase === 'off_peak') {
            offPeakHoursBySlot[dayIndex][hour] += overlapHours;
            offPeakHoursByHour[hour] += overlapHours;
            totalOffPeakHours += overlapHours;

            if (weekend) {
              offPeakHoursByWeekendHour[hour] += overlapHours;
            } else {
              offPeakHoursByWeekdayHour[hour] += overlapHours;
            }

            if (holiday) {
              offPeakHoursByHolidayHour[hour] += overlapHours;
            }
          } else {
            peakHoursBySlot[dayIndex][hour] += overlapHours;
            peakHoursByHour[hour] += overlapHours;
            totalPeakHours += overlapHours;

            if (weekend) {
              peakHoursByWeekendHour[hour] += overlapHours;
            } else {
              peakHoursByWeekdayHour[hour] += overlapHours;
            }

            if (holiday) {
              peakHoursByHolidayHour[hour] += overlapHours;
            }
          }
        });
      });

    if (totalHours === 0) {
      return;
    }

    totalWeight += weight;
    offPeakGlobal += (totalOffPeakHours / totalHours) * weight;
    peakGlobal += (totalPeakHours / totalHours) * weight;
    globalSupport += weight;

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        if (totalBySlot[dayIndex][hour] === 0) {
          continue;
        }

        offPeakBySlot[dayIndex][hour] +=
          (offPeakHoursBySlot[dayIndex][hour] / totalBySlot[dayIndex][hour]) * weight;
        peakBySlot[dayIndex][hour] +=
          (peakHoursBySlot[dayIndex][hour] / totalBySlot[dayIndex][hour]) * weight;
        slotSupport[dayIndex][hour] += weight;
      }
    }

    for (let hour = 0; hour < 24; hour += 1) {
      if (totalByHour[hour] === 0) {
        continue;
      }

      offPeakByHour[hour] += (offPeakHoursByHour[hour] / totalByHour[hour]) * weight;
      peakByHour[hour] += (peakHoursByHour[hour] / totalByHour[hour]) * weight;
      hourSupport[hour] += weight;

      if (totalByWeekdayHour[hour] > 0) {
        offPeakByWeekdayHour[hour] += (offPeakHoursByWeekdayHour[hour] / totalByWeekdayHour[hour]) * weight;
        peakByWeekdayHour[hour] += (peakHoursByWeekdayHour[hour] / totalByWeekdayHour[hour]) * weight;
        weekdayHourSupport[hour] += weight;
      }

      if (totalByWeekendHour[hour] > 0) {
        offPeakByWeekendHour[hour] += (offPeakHoursByWeekendHour[hour] / totalByWeekendHour[hour]) * weight;
        peakByWeekendHour[hour] += (peakHoursByWeekendHour[hour] / totalByWeekendHour[hour]) * weight;
        weekendHourSupport[hour] += weight;
      }

      if (totalByHolidayHour[hour] > 0) {
        offPeakByHolidayHour[hour] += (offPeakHoursByHolidayHour[hour] / totalByHolidayHour[hour]) * weight;
        peakByHolidayHour[hour] += (peakHoursByHolidayHour[hour] / totalByHolidayHour[hour]) * weight;
        holidayHourSupport[hour] += weight;
      }
    }
  });

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      if (slotSupport[dayIndex][hour] > 0) {
        offPeakBySlot[dayIndex][hour] /= slotSupport[dayIndex][hour];
        peakBySlot[dayIndex][hour] /= slotSupport[dayIndex][hour];
      }
    }
  }

  for (let hour = 0; hour < 24; hour += 1) {
    if (hourSupport[hour] > 0) {
      offPeakByHour[hour] /= hourSupport[hour];
      peakByHour[hour] /= hourSupport[hour];
    }

    if (weekdayHourSupport[hour] > 0) {
      offPeakByWeekdayHour[hour] /= weekdayHourSupport[hour];
      peakByWeekdayHour[hour] /= weekdayHourSupport[hour];
    }

    if (weekendHourSupport[hour] > 0) {
      offPeakByWeekendHour[hour] /= weekendHourSupport[hour];
      peakByWeekendHour[hour] /= weekendHourSupport[hour];
    }

    if (holidayHourSupport[hour] > 0) {
      offPeakByHolidayHour[hour] /= holidayHourSupport[hour];
      peakByHolidayHour[hour] /= holidayHourSupport[hour];
    }
  }

  return {
    offPeakBySlot,
    peakBySlot,
    slotSupport,
    offPeakByWeekdayHour,
    peakByWeekdayHour,
    weekdayHourSupport,
    offPeakByWeekendHour,
    peakByWeekendHour,
    weekendHourSupport,
    offPeakByHolidayHour,
    peakByHolidayHour,
    holidayHourSupport,
    offPeakByHour,
    peakByHour,
    hourSupport,
    offPeakGlobal: globalSupport > 0 ? offPeakGlobal / globalSupport : 0.5,
    peakGlobal: globalSupport > 0 ? peakGlobal / globalSupport : 0.5,
    totalWeight,
    baselineWeight: totalWeight > 0 ? BASELINE_WITH_HISTORY_WEIGHT : BASELINE_WITHOUT_HISTORY_WEIGHT,
    baselineSupport: PERMANENT_WEEKDAY_PEAK_BASELINE.support,
  };
}

function getPhaseScores(
  model: PhaseProbabilityModel,
  atUtc: DateTime,
  holidayDates: Set<string>,
): { offPeak: number; peak: number; support: number } {
  const referenceTime = atUtc.setZone('America/New_York');
  const dayIndex = referenceTime.weekday - 1;
  const hour = referenceTime.hour;
  const weekend = referenceTime.weekday >= 6;
  const holiday = isHoliday(referenceTime, holidayDates);
  const slotSupport = model.slotSupport[dayIndex][hour];
  const contextSupport = weekend ? model.weekendHourSupport[hour] : model.weekdayHourSupport[hour];
  const hourSupport = model.hourSupport[hour];
  const holidaySupport = holiday ? model.holidayHourSupport[hour] : 0;
  const slotWeight = slotSupport > 0 ? 0.4 : 0;
  const contextWeight = contextSupport > 0 ? (slotSupport > 0 ? 0.3 : 0.5) : 0;
  const holidayWeight = holidaySupport > 0 ? 0.2 : 0;
  const hourWeight = hourSupport > 0 ? (slotSupport > 0 ? 0.1 : 0.2) : 0;
  const globalWeight = 1 - slotWeight - contextWeight - holidayWeight - hourWeight;
  const normalizedSupport =
    model.totalWeight > 0
      ? Math.max(slotSupport, contextSupport, holidaySupport, hourSupport) / model.totalWeight
      : 0;
  const baselinePeak = isPermanentWeekdayPeak(atUtc)
    ? PERMANENT_WEEKDAY_PEAK_BASELINE.peakProbability
    : 1 - PERMANENT_WEEKDAY_PEAK_BASELINE.offPeakProbability;
  const baselineOffPeak = isPermanentWeekdayPeak(atUtc)
    ? 1 - PERMANENT_WEEKDAY_PEAK_BASELINE.peakProbability
    : PERMANENT_WEEKDAY_PEAK_BASELINE.offPeakProbability;
  const historicalWeight = 1 - model.baselineWeight;
  const contextOffPeak = weekend ? model.offPeakByWeekendHour[hour] : model.offPeakByWeekdayHour[hour];
  const contextPeak = weekend ? model.peakByWeekendHour[hour] : model.peakByWeekdayHour[hour];

  return {
    offPeak:
      historicalWeight *
        (slotWeight * model.offPeakBySlot[dayIndex][hour] +
          contextWeight * contextOffPeak +
          holidayWeight * model.offPeakByHolidayHour[hour] +
          hourWeight * model.offPeakByHour[hour] +
          globalWeight * model.offPeakGlobal) +
      model.baselineWeight * baselineOffPeak,
    peak:
      historicalWeight *
        (slotWeight * model.peakBySlot[dayIndex][hour] +
          contextWeight * contextPeak +
          holidayWeight * model.peakByHolidayHour[hour] +
          hourWeight * model.peakByHour[hour] +
          globalWeight * model.peakGlobal) +
      model.baselineWeight * baselinePeak,
    support: clamp(Math.max(normalizedSupport, model.baselineSupport), 0, 1),
  };
}

function findOfficialPhaseForecast(
  windows: PromotionWindow[],
  activeCampaignIds: Set<string>,
  phase: PromotionPhase,
  nowUtc: DateTime,
  includeCurrentWindow: boolean,
): PromotionForecast['nextOffPeak'] {
  const match = [...windows]
    .filter((window) => window.phase === phase && activeCampaignIds.has(window.campaignId))
    .sort((left, right) => left.startedAtUtc.localeCompare(right.startedAtUtc))
    .find((window) => {
      const windowStart = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' });
      const windowEnd = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' });

      if (includeCurrentWindow) {
        return windowEnd >= nowUtc;
      }

      return windowStart > nowUtc;
    });

  if (!match) {
    return null;
  }

  const windowStart = DateTime.fromISO(match.startedAtUtc, { zone: 'utc' });
  const windowEnd = DateTime.fromISO(match.endedAtUtc, { zone: 'utc' });
  const isCurrentWindow = nowUtc >= windowStart && nowUtc < windowEnd;

  return {
    kind: 'official_window',
    phase,
    startsAtUtc: isCurrentWindow ? nowUtc.toUTC().toISO() ?? match.startedAtUtc : match.startedAtUtc,
    endsAtUtc: match.endedAtUtc,
    confidence: 0.95,
    explanation: isCurrentWindow
      ? `You are currently inside an official ${getPhaseLabel(phase)} window.`
      : `Taken directly from the next official ${getPhaseLabel(phase)} window in the active promotion.`,
    basis: 'Current Claude Help Center promotion schedule',
  };
}

const PATTERN_FORECAST_HORIZON_HOURS = 7 * 24;

function inferNearTermPhaseForecast(
  model: PhaseProbabilityModel,
  holidayDates: Set<string>,
  phase: PromotionPhase,
  nowUtc: DateTime,
  includeCurrentWindow: boolean,
): PromotionForecast['nextOffPeak'] {
  const horizonEnd = nowUtc.plus({ hours: PATTERN_FORECAST_HORIZON_HOURS }).startOf('hour');
  let cursor = nowUtc.startOf('hour');

  while (cursor < horizonEnd) {
    const currentScores = getPhaseScores(model, cursor, holidayDates);
    const dominantPhase = currentScores.offPeak >= currentScores.peak ? 'off_peak' : 'peak';

    if (dominantPhase === phase) {
      const runStart = cursor;
      if (!includeCurrentWindow && runStart <= nowUtc) {
        while (cursor < horizonEnd) {
          const nextCursor = cursor.plus({ hours: 1 });
          const nextScores = getPhaseScores(model, nextCursor, holidayDates);
          const nextDominantPhase = nextScores.offPeak >= nextScores.peak ? 'off_peak' : 'peak';
          if (nextDominantPhase !== phase) {
            cursor = nextCursor;
            break;
          }
          cursor = nextCursor;
        }
        continue;
      }
      let runEnd = cursor;
      let scoreTotal = 0;
      let marginTotal = 0;
      let supportTotal = 0;
      let samples = 0;

      while (runEnd < horizonEnd) {
        const runScores = getPhaseScores(model, runEnd, holidayDates);
        const runDominantPhase = runScores.offPeak >= runScores.peak ? 'off_peak' : 'peak';
        if (runDominantPhase !== phase) {
          break;
        }

        const targetScore = phase === 'off_peak' ? runScores.offPeak : runScores.peak;
        const rivalScore = phase === 'off_peak' ? runScores.peak : runScores.offPeak;
        scoreTotal += targetScore;
        marginTotal += Math.max(0, targetScore - rivalScore);
        supportTotal += runScores.support;
        samples += 1;
        runEnd = runEnd.plus({ hours: 1 });
      }

      const averageScore = samples > 0 ? scoreTotal / samples : 0.5;
      const averageMargin = samples > 0 ? marginTotal / samples : 0;
      const averageSupport = samples > 0 ? supportTotal / samples : 0;
      const confidence = clamp(
        0.2 + averageScore * 0.2 + averageMargin * 0.3 + averageSupport * 0.2,
        0.2,
        0.72,
      );

      return {
        kind: 'historical_inference',
        phase,
        startsAtUtc: (runStart <= nowUtc ? nowUtc : runStart).toUTC().toISO() ?? runStart.toString(),
        endsAtUtc: runEnd.toUTC().toISO() ?? runEnd.toString(),
        confidence,
        explanation: `Near-term estimate from Anthropic's published weekday baseline plus historical weekday and hour patterns seen in previous official ${getPhaseLabel(phase)} windows.`,
        basis: 'Permanent 5 AM-11 AM PT weekday peak baseline blended with ET day-of-week, weekend, hour, and US public holiday probabilities over the next 7 days; not a live official schedule',
      };
    }

    cursor = cursor.plus({ hours: 1 });
  }

  return null;
}

function buildForecast(
  campaigns: PromotionCampaign[],
  windows: PromotionWindow[],
  model: PhaseProbabilityModel,
  holidayDates: Set<string>,
  nowUtc: DateTime,
): PromotionForecast | null {
  const campaignForecast = buildCampaignForecast(campaigns, nowUtc);

  if (campaignForecast?.kind === 'official_campaign') {
    const activeCampaignIds = new Set(
      campaigns
        .filter((campaign) => {
          const start = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' });
          const end = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' });
          return nowUtc >= start && nowUtc <= end;
        })
        .map((campaign) => campaign.id),
    );

    return {
      campaign: campaignForecast,
      nextOffPeak: findOfficialPhaseForecast(windows, activeCampaignIds, 'off_peak', nowUtc, true),
      nextPeak: findOfficialPhaseForecast(windows, activeCampaignIds, 'peak', nowUtc, false),
    };
  }

  return {
    campaign: campaignForecast,
    nextOffPeak: inferNearTermPhaseForecast(model, holidayDates, 'off_peak', nowUtc, true),
    nextPeak: inferNearTermPhaseForecast(model, holidayDates, 'peak', nowUtc, false),
  };
}

function buildHourlyScores(
  model: PhaseProbabilityModel,
  windows: PromotionWindow[],
  holidayDates: Set<string>,
  nowUtc: DateTime,
): HourlyScore[] {
  const scores: HourlyScore[] = [];
  let cursor = nowUtc.startOf('hour');
  const horizon = cursor.plus({ hours: 24 });

  while (cursor < horizon) {
    const phaseScores = getPhaseScores(model, cursor, holidayDates);
    const total = phaseScores.peak + phaseScores.offPeak;
    const peakProbability = total > 0 ? phaseScores.peak / total : 0.5;

    const officialWindow = windows.find((w) => {
      const s = DateTime.fromISO(w.startedAtUtc, { zone: 'utc' });
      const e = DateTime.fromISO(w.endedAtUtc, { zone: 'utc' });
      return cursor >= s && cursor < e;
    });

    scores.push({
      hourUtc: cursor.toISO() ?? cursor.toString(),
      peakProbability: Math.round(peakProbability * 100) / 100,
      support: Math.round(phaseScores.support * 100) / 100,
      officialPhase: officialWindow?.phase ?? null,
    });

    cursor = cursor.plus({ hours: 1 });
  }

  return scores;
}

async function buildPromotionSnapshot(): Promise<PromotionSnapshotResponse> {
  const sitemapXml = await fetchText(SUPPORT_SITEMAP_URL);
  const sourceUrls = extractPromotionUrls(sitemapXml);
  const parsedArticles = await Promise.all(
    sourceUrls.map(async (sourceUrl) => {
      try {
        const html = await fetchText(sourceUrl);
        return parsePromotionArticle(sourceUrl, html);
      } catch (error) {
        return {
          bundle: null,
          warnings: [
            {
              sourceUrl,
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    }),
  );
  const parseWarnings = parsedArticles.flatMap((result) => result.warnings);
  const bundles = parsedArticles.flatMap((result) => (result.bundle ? [result.bundle] : []));
  const campaigns = bundles.map((bundle) => bundle.campaign).sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc));
  const windows = bundles
    .flatMap((bundle) => bundle.windows)
    .sort((left, right) => left.startedAtUtc.localeCompare(right.startedAtUtc));
  const nowUtc = DateTime.utc();
  const campaignForecast = buildCampaignForecast(campaigns, nowUtc);
  const manualOverride = readManualSignalsFile();
  const statusPage = await fetchStatusPageSummary();
  const relevantYears = new Set<number>();

  campaigns.forEach((campaign) => {
    relevantYears.add(DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' }).setZone('America/New_York').year);
    relevantYears.add(DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' }).setZone('America/New_York').year);
  });

  if (campaignForecast) {
    relevantYears.add(
      DateTime.fromISO(campaignForecast.startsAtUtc, { zone: 'utc' }).setZone('America/New_York').year,
    );
    if (campaignForecast.endsAtUtc) {
      relevantYears.add(
        DateTime.fromISO(campaignForecast.endsAtUtc, { zone: 'utc' }).setZone('America/New_York').year,
      );
    }
  }

  let holidayDates = new Set<string>();
  try {
    holidayDates = await getHolidayDates([...relevantYears]);
  } catch (error) {
    console.warn(
      `Holiday context unavailable, continuing with weekday/weekend model only: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const model = buildPhaseProbabilityModel(campaigns, windows, holidayDates);

  return {
    fetchedAtUtc: nowUtc.toISO() ?? nowUtc.toString(),
    sourceLabel: SOURCE_LABEL,
    sourceUrls,
    campaigns,
    windows,
    forecast: buildForecast(campaigns, windows, model, holidayDates, nowUtc),
    hourlyScores: buildHourlyScores(model, windows, holidayDates, nowUtc),
    parseWarnings,
    statusPage,
    manualOverride,
  };
}

export async function getPromotionSnapshot(): Promise<PromotionSnapshotResponse> {
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot.snapshot;
  }

  if (pendingRefresh) {
    return pendingRefresh;
  }

  pendingRefresh = buildPromotionSnapshot()
    .then((snapshot) => {
      cachedSnapshot = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot };
      return snapshot;
    })
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
}

export const _testExports = {
  extractPromotionUrls,
  extractUtcCampaignRange,
  extractPtCampaignRange,
  extractWeekdayPeakBand,
  extractArticleText,
};
