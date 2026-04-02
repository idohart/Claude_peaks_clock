import { load } from 'cheerio';
import { DateTime } from 'luxon';

import type {
  PromotionCampaign,
  PromotionForecast,
  PromotionPhase,
  PromotionSnapshotResponse,
  PromotionWindow,
} from '../src/types/promotion';

const SUPPORT_SITEMAP_URL = 'https://support.claude.com/sitemap.xml';
const SOURCE_LABEL = 'Official Claude Help Center promotion pages';
const CACHE_TTL_MS = 10 * 60 * 1000;

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

interface CachedSnapshot {
  expiresAt: number;
  snapshot: PromotionSnapshotResponse;
}

interface PhaseProbabilityModel {
  offPeakBySlot: number[][];
  peakBySlot: number[][];
  slotSupport: number[][];
  offPeakByHour: number[];
  peakByHour: number[];
  hourSupport: number[];
  offPeakGlobal: number;
  peakGlobal: number;
  totalWeight: number;
}

let cachedSnapshot: CachedSnapshot | null = null;

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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

function extractWeekdayPeakBand(articleText: string): { peakStartHour: number; peakEndHour: number } | null {
  const match = articleText.match(
    /outside\s+(\d{1,2})(?::\d{2})?\s*(AM|PM)\s*-\s*(\d{1,2})(?::\d{2})?\s*(AM|PM)\s*ET/i,
  );
  if (!match) {
    return null;
  }

  const [, rawStartHour, rawStartMeridiem, rawEndHour, rawEndMeridiem] = match;

  return {
    peakStartHour: toTwentyFourHour(Number.parseInt(rawStartHour, 10), rawStartMeridiem),
    peakEndHour: toTwentyFourHour(Number.parseInt(rawEndHour, 10), rawEndMeridiem),
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

function parseFullDayPromotion(articleText: string, title: string, sourceUrl: string, updatedAtUtc: string | null): ParsedCampaignBundle {
  const range = extractUtcCampaignRange(articleText);
  if (!range) {
    throw new Error(`Could not parse full-day promotion range from ${sourceUrl}`);
  }
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

function parseWeekdayBandPromotion(articleText: string, title: string, sourceUrl: string, updatedAtUtc: string | null): ParsedCampaignBundle {
  const range = extractPtCampaignRange(articleText);
  const peakBand = extractWeekdayPeakBand(articleText);
  if (!range || !peakBand) {
    throw new Error(`Could not parse weekday-band promotion from ${sourceUrl}`);
  }
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

function parsePromotionArticle(sourceUrl: string, html: string): ParsedCampaignBundle {
  const article = extractArticleText(html);
  if (extractWeekdayPeakBand(article.text) && extractPtCampaignRange(article.text)) {
    return parseWeekdayBandPromotion(article.text, article.title, sourceUrl, article.updatedAtUtc);
  }

  if (extractUtcCampaignRange(article.text)) {
    return parseFullDayPromotion(article.text, article.title, sourceUrl, article.updatedAtUtc);
  }

  throw new Error(`Unsupported promotion article shape: ${article.title}`);
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
  const nextStart = DateTime.fromMillis(startTimes[startTimes.length - 1] + averageInterval, { zone: 'utc' });
  const nextEnd = nextStart.plus({ milliseconds: averageDuration });

  return {
    kind: 'estimated_campaign',
    startsAtUtc: nextStart.toISO() ?? nextStart.toString(),
    endsAtUtc: nextEnd.toISO() ?? nextEnd.toString(),
    confidence: clamp(0.45 - relativeVolatility * 0.2, 0.2, 0.55),
    explanation: 'Estimated from the spacing between official Claude usage promotions discovered on support.claude.com.',
    basis: `Average gap of ${Math.round(averageInterval / (1000 * 60 * 60 * 24))} days between published campaigns`,
    matchedCampaigns: sortedCampaigns.length,
  };
}

function buildPhaseProbabilityModel(
  campaigns: PromotionCampaign[],
  windows: PromotionWindow[],
): PhaseProbabilityModel {
  const canonicalZone = 'America/New_York';
  const sortedCampaigns = [...campaigns].sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc));
  const offPeakBySlot = createDayHourMatrix();
  const peakBySlot = createDayHourMatrix();
  const slotSupport = createDayHourMatrix();
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

          totalBySlot[dayIndex][hour] += overlapHours;
          totalByHour[hour] += overlapHours;
          totalHours += overlapHours;

          if (window.phase === 'off_peak') {
            offPeakHoursBySlot[dayIndex][hour] += overlapHours;
            offPeakHoursByHour[hour] += overlapHours;
            totalOffPeakHours += overlapHours;
          } else {
            peakHoursBySlot[dayIndex][hour] += overlapHours;
            peakHoursByHour[hour] += overlapHours;
            totalPeakHours += overlapHours;
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
  }

  return {
    offPeakBySlot,
    peakBySlot,
    slotSupport,
    offPeakByHour,
    peakByHour,
    hourSupport,
    offPeakGlobal: globalSupport > 0 ? offPeakGlobal / globalSupport : 0.5,
    peakGlobal: globalSupport > 0 ? peakGlobal / globalSupport : 0.5,
    totalWeight,
  };
}

function getPhaseScores(
  model: PhaseProbabilityModel,
  atUtc: DateTime,
): { offPeak: number; peak: number; support: number } {
  const referenceTime = atUtc.setZone('America/New_York');
  const dayIndex = referenceTime.weekday - 1;
  const hour = referenceTime.hour;
  const slotSupport = model.slotSupport[dayIndex][hour];
  const hourSupport = model.hourSupport[hour];
  const slotWeight = slotSupport > 0 ? 0.6 : 0;
  const hourWeight = hourSupport > 0 ? (slotSupport > 0 ? 0.25 : 0.7) : 0;
  const globalWeight = 1 - slotWeight - hourWeight;
  const normalizedSupport =
    model.totalWeight > 0 ? Math.max(slotSupport, hourSupport) / model.totalWeight : 0;

  return {
    offPeak:
      slotWeight * model.offPeakBySlot[dayIndex][hour] +
      hourWeight * model.offPeakByHour[hour] +
      globalWeight * model.offPeakGlobal,
    peak:
      slotWeight * model.peakBySlot[dayIndex][hour] +
      hourWeight * model.peakByHour[hour] +
      globalWeight * model.peakGlobal,
    support: clamp(normalizedSupport, 0, 1),
  };
}

function findOfficialPhaseForecast(
  windows: PromotionWindow[],
  activeCampaignIds: Set<string>,
  phase: PromotionPhase,
  nowUtc: DateTime,
): PromotionForecast['nextOffPeak'] {
  const match = [...windows]
    .filter((window) => window.phase === phase && activeCampaignIds.has(window.campaignId))
    .sort((left, right) => left.startedAtUtc.localeCompare(right.startedAtUtc))
    .find((window) => DateTime.fromISO(window.endedAtUtc, { zone: 'utc' }) >= nowUtc);

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

function inferPhaseForecast(
  campaignForecast: NonNullable<PromotionForecast['campaign']>,
  model: PhaseProbabilityModel,
  phase: PromotionPhase,
  nowUtc: DateTime,
): PromotionForecast['nextOffPeak'] {
  if (!campaignForecast.endsAtUtc) {
    return null;
  }

  const campaignStart = DateTime.fromISO(campaignForecast.startsAtUtc, { zone: 'utc' });
  const campaignEnd = DateTime.fromISO(campaignForecast.endsAtUtc, { zone: 'utc' });
  let cursor = (nowUtc > campaignStart ? nowUtc : campaignStart).startOf('hour');

  while (cursor < campaignEnd) {
    const currentScores = getPhaseScores(model, cursor);
    const dominantPhase = currentScores.offPeak >= currentScores.peak ? 'off_peak' : 'peak';

    if (dominantPhase === phase) {
      const runStart = cursor;
      let runEnd = cursor;
      let scoreTotal = 0;
      let marginTotal = 0;
      let supportTotal = 0;
      let samples = 0;

      while (runEnd < campaignEnd) {
        const runScores = getPhaseScores(model, runEnd);
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
        campaignForecast.confidence * (0.55 + averageScore * 0.2 + averageMargin * 0.35 + averageSupport * 0.1),
        0.15,
        0.8,
      );

      return {
        kind: 'historical_inference',
        phase,
        startsAtUtc: runStart.toUTC().toISO() ?? runStart.toString(),
        endsAtUtc: runEnd.toUTC().toISO() ?? runEnd.toString(),
        confidence,
        explanation: `Inferred from weekday and hour patterns inside previous official ${getPhaseLabel(phase)} windows.`,
        basis: 'Estimated campaign window plus ET weekday/hour phase probabilities',
      };
    }

    cursor = cursor.plus({ hours: 1 });
  }

  return null;
}

function buildForecast(
  campaigns: PromotionCampaign[],
  windows: PromotionWindow[],
  nowUtc: DateTime,
): PromotionForecast | null {
  const campaignForecast = buildCampaignForecast(campaigns, nowUtc);
  if (!campaignForecast) {
    return null;
  }

  if (campaignForecast.kind === 'official_campaign') {
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
      nextOffPeak: findOfficialPhaseForecast(windows, activeCampaignIds, 'off_peak', nowUtc),
      nextPeak: findOfficialPhaseForecast(windows, activeCampaignIds, 'peak', nowUtc),
    };
  }

  const model = buildPhaseProbabilityModel(campaigns, windows);

  return {
    campaign: campaignForecast,
    nextOffPeak: inferPhaseForecast(campaignForecast, model, 'off_peak', nowUtc),
    nextPeak: inferPhaseForecast(campaignForecast, model, 'peak', nowUtc),
  };
}

async function buildPromotionSnapshot(): Promise<PromotionSnapshotResponse> {
  const sitemapXml = await fetchText(SUPPORT_SITEMAP_URL);
  const sourceUrls = extractPromotionUrls(sitemapXml);
  const bundles = await Promise.all(
    sourceUrls.map(async (sourceUrl) => {
      const html = await fetchText(sourceUrl);
      return parsePromotionArticle(sourceUrl, html);
    }),
  );
  const campaigns = bundles.map((bundle) => bundle.campaign).sort((left, right) => left.startsAtUtc.localeCompare(right.startsAtUtc));
  const windows = bundles
    .flatMap((bundle) => bundle.windows)
    .sort((left, right) => left.startedAtUtc.localeCompare(right.startedAtUtc));
  const nowUtc = DateTime.utc();

  return {
    fetchedAtUtc: nowUtc.toISO() ?? nowUtc.toString(),
    sourceLabel: SOURCE_LABEL,
    sourceUrls,
    campaigns,
    windows,
    forecast: buildForecast(campaigns, windows, nowUtc),
  };
}

export async function getPromotionSnapshot(): Promise<PromotionSnapshotResponse> {
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot.snapshot;
  }

  const snapshot = await buildPromotionSnapshot();
  cachedSnapshot = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    snapshot,
  };

  return snapshot;
}
