import { DateTime } from 'luxon';

import { formatCountdown, formatDuration, getViewerTimeZone, shortHourLabel } from '../lib/time';
import type {
  DashboardViewModel,
  ForecastViewModel,
  PromotionSnapshotResponse,
  PromotionWindow,
  UsageHourPoint,
  WeeklyHeatmapCell,
} from '../types/promotion';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function buildUsageHours(matrix: HourAccumulator[][], weekdayIndex: number): UsageHourPoint[] {
  return matrix[weekdayIndex].map((bucket, hour) => {
    const total = bucket.peak + bucket.offPeak;
    const usage = total === 0 ? 0 : Math.round((bucket.peak / total) * 100);

    return {
      hour,
      label: shortHourLabel(hour),
      usage,
      isPeak: usage >= 60,
    };
  });
}

function buildHeatmap(matrix: HourAccumulator[][]): WeeklyHeatmapCell[][] {
  return matrix.map((row, dayIndex) =>
    row.map((bucket, hour) => {
      const total = bucket.peak + bucket.offPeak;
      const usage = total === 0 ? 0 : Math.round((bucket.peak / total) * 100);

      return {
        dayLabel: DAYS[dayIndex],
        hour,
        usage,
      };
    }),
  );
}

function buildForecastViewModel(
  snapshot: PromotionSnapshotResponse,
  zone: string,
  now: DateTime,
): ForecastViewModel | null {
  if (!snapshot.forecast) {
    return null;
  }

  const startsAt = DateTime.fromISO(snapshot.forecast.startsAtUtc, { zone: 'utc' }).setZone(zone);
  const countdownMinutes = Math.max(0, Math.round(startsAt.diff(now, 'minutes').minutes));

  return {
    label: startsAt.toFormat("ccc, dd LLL yyyy '|' HH:mm"),
    countdown: formatCountdown(countdownMinutes),
    reason: snapshot.forecast.explanation,
    confidence: snapshot.forecast.confidence,
    kindLabel: snapshot.forecast.kind === 'official_window' ? 'Official Window' : 'Estimated Campaign',
    basis: snapshot.forecast.basis,
  };
}

function usageForWindowStart(matrix: HourAccumulator[][], startedAt: DateTime): number {
  const bucket = matrix[startedAt.weekday - 1][startedAt.hour];
  const total = bucket.peak + bucket.offPeak;
  return total === 0 ? 0 : Math.round((bucket.peak / total) * 100);
}

export function buildDashboardModel(
  snapshot: PromotionSnapshotResponse,
  nowMillis: number,
  zone = getViewerTimeZone(),
): DashboardViewModel {
  const now = DateTime.fromMillis(nowMillis).setZone(zone);
  const matrix = buildHourlyMatrix(snapshot.windows, zone);
  const todayUsage = buildUsageHours(matrix, now.weekday - 1);
  const weeklyHeatmap = buildHeatmap(matrix);
  const currentUsage = todayUsage[now.hour]?.usage ?? 0;
  const currentStatus =
    currentUsage >= 60
      ? { label: 'Peak', usage: currentUsage, tone: 'peak' as const }
      : currentUsage >= 35
        ? { label: 'Moderate', usage: currentUsage, tone: 'moderate' as const }
        : { label: 'Off-Peak', usage: currentUsage, tone: 'off_peak' as const };

  const history = [...snapshot.windows]
    .sort((left, right) => right.startedAtUtc.localeCompare(left.startedAtUtc))
    .map((window) => {
      const startedAt = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' }).setZone(zone);
      const endedAt = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' }).setZone(zone);

      return {
        id: window.id,
        date: startedAt.toFormat('LLL dd, yyyy'),
        time: startedAt.toFormat('HH:mm'),
        day: startedAt.toFormat('ccc'),
        usage: usageForWindowStart(matrix, startedAt),
        duration: formatDuration(Math.round(endedAt.diff(startedAt, 'minutes').minutes)),
        reason: window.label,
        phase: window.phase,
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
    timezone: zone,
    todayUsage,
    weeklyHeatmap,
    forecast: buildForecastViewModel(snapshot, zone, now),
    history,
    currentStatus,
  };
}
