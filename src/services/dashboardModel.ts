import { DateTime } from 'luxon';

import { formatCountdown, formatDuration, getViewerTimeZone, shortHourLabel } from '../lib/time';
import type {
  CampaignForecastViewModel,
  DashboardViewModel,
  ForecastTransitionViewModel,
  ForecastViewModel,
  PromotionPhase,
  PromotionSnapshotResponse,
  PromotionWindow,
  UsageHourPoint,
  WeeklyHeatmapCell,
} from '../types/promotion';

interface HourAccumulator {
  peak: number;
  offPeak: number;
}

function buildHourlyMatrix(windows: PromotionWindow[], zone: string): HourAccumulator[][] {
  const matrix = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ peak: 0, offPeak: 0 })),
  );

  for (const window of windows) {
    const startedAt = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' }).setZone(zone);
    const endedAt = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' }).setZone(zone);
    let cursor = startedAt.startOf('hour');

    while (cursor < endedAt) {
      const nextCursor = cursor.plus({ hours: 1 });
      const activeStart = startedAt > cursor ? startedAt : cursor;
      const activeEnd = endedAt < nextCursor ? endedAt : nextCursor;
      const overlapHours = activeEnd.diff(activeStart, 'minutes').minutes / 60;

      if (overlapHours > 0) {
        const bucket = matrix[cursor.weekday - 1][cursor.hour];
        if (window.phase === 'peak') {
          bucket.peak += overlapHours;
        } else {
          bucket.offPeak += overlapHours;
        }
      }

      cursor = nextCursor;
    }
  }

  return matrix;
}

function buildUsageHours(dayBuckets: HourAccumulator[]): UsageHourPoint[] {
  return dayBuckets.map((bucket, hour) => {
    const total = bucket.peak + bucket.offPeak;
    const hasData = total > 0;
    const usage = hasData ? Math.round((bucket.peak / total) * 100) : 0;

    return {
      hour,
      label: shortHourLabel(hour),
      usage,
      hasData,
      isPeak: usage >= 60,
    };
  });
}

function buildRangeBuckets(
  windows: PromotionWindow[],
  zone: string,
  rangeStart: DateTime,
  dayCount: number,
): Array<{ day: DateTime; buckets: HourAccumulator[] }> {
  const days = Array.from({ length: dayCount }, (_, index) => ({
    day: rangeStart.plus({ days: index }),
    buckets: Array.from({ length: 24 }, () => ({ peak: 0, offPeak: 0 })),
  }));
  const dayMap = new Map(days.map((entry) => [entry.day.toISODate(), entry]));
  const rangeEnd = rangeStart.plus({ days: dayCount });

  for (const window of windows) {
    const startedAt = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' }).setZone(zone);
    const endedAt = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' }).setZone(zone);
    const effectiveStart = startedAt < rangeStart ? rangeStart : startedAt;
    const effectiveEnd = endedAt > rangeEnd ? rangeEnd : endedAt;

    if (effectiveEnd <= effectiveStart) {
      continue;
    }

    let cursor = effectiveStart.startOf('hour');
    while (cursor < effectiveEnd) {
      const nextCursor = cursor.plus({ hours: 1 });
      const activeStart = effectiveStart > cursor ? effectiveStart : cursor;
      const activeEnd = effectiveEnd < nextCursor ? effectiveEnd : nextCursor;
      const overlapHours = activeEnd.diff(activeStart, 'minutes').minutes / 60;

      if (overlapHours > 0) {
        const key = cursor.toISODate();
        const targetDay = key ? dayMap.get(key) : undefined;
        if (targetDay) {
          const bucket = targetDay.buckets[cursor.hour];
          if (window.phase === 'peak') {
            bucket.peak += overlapHours;
          } else {
            bucket.offPeak += overlapHours;
          }
        }
      }

      cursor = nextCursor;
    }
  }

  return days;
}

function buildHeatmap(days: Array<{ day: DateTime; buckets: HourAccumulator[] }>): WeeklyHeatmapCell[][] {
  return days.map(({ day, buckets }) =>
    buckets.map((bucket, hour) => {
      const total = bucket.peak + bucket.offPeak;
      const hasData = total > 0;
      const usage = hasData ? Math.round((bucket.peak / total) * 100) : 0;

      return {
        dayLabel: day.toFormat('ccc'),
        dateLabel: day.toFormat('dd LLL'),
        hour,
        usage,
        hasData,
      };
    }),
  );
}

function buildTransitionViewModel(
  forecast: PromotionSnapshotResponse['forecast'] extends infer T
    ? T extends { nextOffPeak: infer P }
      ? P
      : never
    : never,
  zone: string,
  now: DateTime,
): ForecastTransitionViewModel | null {
  if (!forecast) {
    return null;
  }

  const startsAt = DateTime.fromISO(forecast.startsAtUtc, { zone: 'utc' }).setZone(zone);
  const countdownMinutes = Math.max(0, Math.round(startsAt.diff(now, 'minutes').minutes));

  return {
    phaseLabel: forecast.phase === 'off_peak' ? 'Off-Peak' : 'Peak',
    label: startsAt.toFormat("ccc, dd LLL yyyy '|' HH:mm"),
    countdown: formatCountdown(countdownMinutes),
    reason: forecast.explanation,
    confidence: forecast.confidence,
    kindLabel: forecast.kind === 'official_window' ? 'Official Window' : 'History-Inferred',
    basis: forecast.basis,
  };
}

function buildCampaignViewModel(
  forecast: PromotionSnapshotResponse['forecast'] extends infer T
    ? T extends { campaign: infer P }
      ? P
      : never
    : never,
  zone: string,
  now: DateTime,
): CampaignForecastViewModel | null {
  if (!forecast) {
    return null;
  }

  const startsAt = DateTime.fromISO(forecast.startsAtUtc, { zone: 'utc' }).setZone(zone);
  const countdownMinutes = Math.max(0, Math.round(startsAt.diff(now, 'minutes').minutes));

  return {
    label: startsAt.toFormat("ccc, dd LLL yyyy '|' HH:mm"),
    countdown: formatCountdown(countdownMinutes),
    reason: forecast.explanation,
    confidence: forecast.confidence,
    kindLabel: forecast.kind === 'official_campaign' ? 'Official Campaign' : 'Estimated Campaign',
    basis: forecast.basis,
  };
}

function buildForecastViewModel(
  snapshot: PromotionSnapshotResponse,
  zone: string,
  now: DateTime,
): ForecastViewModel | null {
  if (!snapshot.forecast) {
    return null;
  }

  return {
    campaign: buildCampaignViewModel(snapshot.forecast.campaign, zone, now),
    nextOffPeak: buildTransitionViewModel(snapshot.forecast.nextOffPeak, zone, now),
    nextPeak: buildTransitionViewModel(snapshot.forecast.nextPeak, zone, now),
  };
}

function usageForWindowStart(matrix: HourAccumulator[][], startedAt: DateTime): number {
  const bucket = matrix[startedAt.weekday - 1][startedAt.hour];
  const total = bucket.peak + bucket.offPeak;
  return total === 0 ? 0 : Math.round((bucket.peak / total) * 100);
}

function getPatternTone(usage: number): 'peak' | 'moderate' | 'off_peak' {
  if (usage >= 60) {
    return 'peak';
  }

  if (usage >= 35) {
    return 'moderate';
  }

  return 'off_peak';
}

function getPhaseLabel(phase: PromotionPhase): string {
  return phase === 'off_peak' ? 'Off-Peak' : 'Peak';
}

function getPatternLabel(tone: 'peak' | 'moderate' | 'off_peak'): string {
  if (tone === 'peak') {
    return 'Peak-leaning';
  }

  if (tone === 'moderate') {
    return 'Balanced';
  }

  return 'Off-peak-leaning';
}

export function buildDashboardModel(
  snapshot: PromotionSnapshotResponse,
  nowMillis: number,
  zone = getViewerTimeZone(),
): DashboardViewModel {
  const now = DateTime.fromMillis(nowMillis).setZone(zone);
  const nowUtc = now.toUTC();
  const patternMatrix = buildHourlyMatrix(snapshot.windows, zone);
  const recentDays = buildRangeBuckets(snapshot.windows, zone, now.startOf('day').minus({ days: 6 }), 7);
  const todayUsage = buildUsageHours(recentDays[recentDays.length - 1].buckets);
  const weeklyHeatmap = buildHeatmap(recentDays);
  const currentBucket = patternMatrix[now.weekday - 1][now.hour];
  const currentTotal = currentBucket.peak + currentBucket.offPeak;
  const currentUsage = currentTotal === 0 ? 0 : Math.round((currentBucket.peak / currentTotal) * 100);
  const patternTone = getPatternTone(currentUsage);
  const activeOfficialWindow = snapshot.windows.find((window) => {
    const startedAtUtc = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' });
    const endedAtUtc = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' });
    return nowUtc >= startedAtUtc && nowUtc < endedAtUtc;
  });

  const currentStatus = activeOfficialWindow
    ? {
        officialLabel: `${getPhaseLabel(activeOfficialWindow.phase)} Window`,
        officialTone: activeOfficialWindow.phase,
        officialDetail: 'Official promotion live now',
        patternLabel: `${getPatternLabel(patternTone)} pattern`,
        patternUsage: currentUsage,
        patternTone,
      }
    : {
        officialLabel: 'No Promotion Live',
        officialTone: 'inactive' as const,
        officialDetail: 'Current signal below is historical, not live Claude telemetry',
        patternLabel: `${getPatternLabel(patternTone)} pattern`,
        patternUsage: currentUsage,
        patternTone,
      };

  const history = [...snapshot.windows]
    .sort((left, right) => right.startedAtUtc.localeCompare(left.startedAtUtc))
    .map((window) => {
      const startedAt = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' }).setZone(zone);
      const endedAt = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' }).setZone(zone);
      const crossesDay = !startedAt.hasSame(endedAt, 'day');

      return {
        id: window.id,
        date: startedAt.toFormat('LLL dd, yyyy'),
        timeRange: crossesDay
          ? `${startedAt.toFormat('HH:mm')} -> ${endedAt.toFormat('ccc HH:mm')}`
          : `${startedAt.toFormat('HH:mm')} -> ${endedAt.toFormat('HH:mm')}`,
        day: startedAt.toFormat('ccc'),
        usage: usageForWindowStart(patternMatrix, startedAt),
        duration: formatDuration(Math.round(endedAt.diff(startedAt, 'minutes').minutes)),
        reason: window.label,
        phase: window.phase,
        phaseLabel: getPhaseLabel(window.phase),
        sourceUrl: window.sourceUrl,
      };
    });

  return {
    sourceLabel: `${snapshot.sourceLabel} | refreshed ${DateTime.fromISO(snapshot.fetchedAtUtc, {
      zone: 'utc',
    })
      .setZone(zone)
      .toFormat('dd LLL yyyy HH:mm')}`,
    sourceUrls: snapshot.sourceUrls,
    sourceLinks: snapshot.campaigns.map((campaign) => ({
      url: campaign.sourceUrl,
      label: campaign.title.replace(/^Claude\s+/i, ''),
    })),
    timezone: zone,
    todayUsage,
    weeklyHeatmap,
    forecast: buildForecastViewModel(snapshot, zone, now),
    history,
    currentStatus,
  };
}
