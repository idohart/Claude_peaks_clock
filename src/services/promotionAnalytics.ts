import { DateTime } from 'luxon';

import { promotionHistory, promotionHistoryMeta } from '../data/promotionHistory';
import {
  clamp,
  circularDistance,
  formatCountdown,
  formatDelta,
  formatDuration,
  minuteOfWeek,
  shortHourLabel,
} from '../lib/time';
import type {
  DashboardModel,
  ForecastResult,
  HeatmapCell,
  LiveSnapshot,
  LocalizedWindow,
  MetricSnapshot,
  PromotionWindow,
  SignalHour,
  TimelineSegment,
} from '../types/promotion';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MINUTES_PER_WEEK = 7 * 24 * 60;
const SLOT_MINUTES = 15;
const FORECAST_HOURS = 7 * 24;
const FORECAST_SIGMA_MINUTES = 85;
const FORECAST_HALF_LIFE_DAYS = 21;

function utcToZone(utcIso: string, zone: string): DateTime {
  return DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(zone);
}

function buildTimelineSegments(start: DateTime, end: DateTime): TimelineSegment[] {
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;

  if (start.hasSame(end, 'day')) {
    return [
      {
        left: (startMinute / 1440) * 100,
        width: ((endMinute - startMinute) / 1440) * 100,
      },
    ];
  }

  return [
    {
      left: (startMinute / 1440) * 100,
      width: ((1440 - startMinute) / 1440) * 100,
    },
    {
      left: 0,
      width: (endMinute / 1440) * 100,
    },
  ];
}

function localizeWindow(window: PromotionWindow, zone: string): LocalizedWindow {
  const startedAt = utcToZone(window.startedAtUtc, zone);
  const endedAt = utcToZone(window.endedAtUtc, zone);
  const durationMinutes = Math.round(endedAt.diff(startedAt, 'minutes').minutes);

  return {
    id: window.id,
    phase: window.phase,
    startedAtMillis: startedAt.toMillis(),
    phaseLabel: window.phase === 'off_peak' ? 'Off-peak' : 'Peak',
    startedAtLabel: startedAt.toFormat('HH:mm'),
    endedAtLabel: endedAt.toFormat('HH:mm'),
    dayLabel: startedAt.toFormat('ccc'),
    dateLabel: startedAt.toFormat('dd LLL yyyy'),
    durationLabel: formatDuration(durationMinutes),
    deltaLabel: formatDelta(window.observedCapacityDelta),
    label: window.label,
    notes: window.notes,
    segments: buildTimelineSegments(startedAt, endedAt),
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function trackedWeeks(): number {
  const earliest = DateTime.fromISO(promotionHistory[0].startedAtUtc, { zone: 'utc' });
  const latest = DateTime.fromISO(
    promotionHistory[promotionHistory.length - 1].endedAtUtc,
    { zone: 'utc' },
  );

  return Math.max(1, latest.diff(earliest, 'weeks').weeks);
}

function buildHeatmap(zone: string): HeatmapCell[] {
  const rawCells = Array.from({ length: 7 * 24 }, (_, index) => ({
    dayIndex: Math.floor(index / 24),
    hour: index % 24,
    peak: 0,
    offPeak: 0,
  }));
  const normalizationWindow = trackedWeeks();

  for (const window of promotionHistory) {
    const startedAt = utcToZone(window.startedAtUtc, zone);
    const endedAt = utcToZone(window.endedAtUtc, zone);
    let cursor = startedAt.startOf('hour');

    while (cursor < endedAt) {
      const nextCursor = cursor.plus({ hours: 1 });
      const activeStart = startedAt > cursor ? startedAt : cursor;
      const activeEnd = endedAt < nextCursor ? endedAt : nextCursor;
      const overlapHours = activeEnd.diff(activeStart, 'minutes').minutes / 60;

      if (overlapHours > 0) {
        const index = (cursor.weekday - 1) * 24 + cursor.hour;
        if (window.phase === 'off_peak') {
          rawCells[index].offPeak += overlapHours;
        } else {
          rawCells[index].peak += overlapHours;
        }
      }

      cursor = nextCursor;
    }
  }

  return rawCells.map((cell) => {
    const peak = cell.peak / normalizationWindow;
    const offPeak = cell.offPeak / normalizationWindow;
    const dominant =
      offPeak > peak * 1.1 ? 'off_peak' : peak > offPeak * 1.1 ? 'peak' : 'mixed';
    const intensity = clamp(Math.max(peak, offPeak) / 0.9, 0.08, 1);

    return {
      dayIndex: cell.dayIndex,
      dayLabel: DAYS[cell.dayIndex],
      hour: cell.hour,
      label: `${DAYS[cell.dayIndex]} ${shortHourLabel(cell.hour)}`,
      peak,
      offPeak,
      dominant,
      intensity,
    };
  });
}

function buildForecast(now: DateTime, zone: string): ForecastResult {
  const offPeakWindows = promotionHistory
    .filter((window) => window.phase === 'off_peak')
    .map((window) => {
      const startedAt = utcToZone(window.startedAtUtc, zone);
      const endedAt = utcToZone(window.endedAtUtc, zone);

      return {
        startedAt,
        durationMinutes: Math.round(endedAt.diff(startedAt, 'minutes').minutes),
      };
    });

  let strongestCandidate = {
    startsAt: now.plus({ hours: 1 }),
    score: -1,
    rawScore: 0,
    matches: 0,
    durationMinutes: 0,
  };

  const totalRecencyWeight = offPeakWindows.reduce((total, window) => {
    const daysAgo = Math.max(now.diff(window.startedAt, 'days').days, 0);
    return total + Math.exp(-daysAgo / FORECAST_HALF_LIFE_DAYS);
  }, 0);

  for (let slot = 1; slot <= (FORECAST_HOURS * 60) / SLOT_MINUTES; slot += 1) {
    const candidate = now.plus({ minutes: slot * SLOT_MINUTES });
    const candidateMinute = minuteOfWeek(candidate);
    let rawScore = 0;
    let weightedDuration = 0;
    let matches = 0;

    for (const window of offPeakWindows) {
      const historicalMinute = minuteOfWeek(window.startedAt);
      const distance = circularDistance(candidateMinute, historicalMinute, MINUTES_PER_WEEK);
      const kernel = Math.exp(
        -((distance * distance) / (2 * FORECAST_SIGMA_MINUTES * FORECAST_SIGMA_MINUTES)),
      );
      const daysAgo = Math.max(now.diff(window.startedAt, 'days').days, 0);
      const recencyWeight = Math.exp(-daysAgo / FORECAST_HALF_LIFE_DAYS);
      const weightedScore = kernel * recencyWeight;

      rawScore += weightedScore;
      weightedDuration += weightedScore * window.durationMinutes;

      if (distance <= 90) {
        matches += 1;
      }
    }

    const timeBias = 1 / Math.sqrt(1 + slot / 12);
    const adjustedScore = rawScore * timeBias;

    if (adjustedScore > strongestCandidate.score) {
      strongestCandidate = {
        startsAt: candidate,
        score: adjustedScore,
        rawScore,
        matches,
        durationMinutes: rawScore > 0 ? Math.round(weightedDuration / rawScore) : 0,
      };
    }
  }

  const recentStarts = offPeakWindows
    .slice(-4)
    .map((window) => window.startedAt.hour * 60 + window.startedAt.minute);
  const earlierStarts = offPeakWindows
    .slice(0, Math.max(1, offPeakWindows.length - 4))
    .map((window) => window.startedAt.hour * 60 + window.startedAt.minute);
  const startDriftMinutes = average(recentStarts) - average(earlierStarts);
  const driftLabel =
    Math.abs(startDriftMinutes) < 8
      ? 'holding steady'
      : startDriftMinutes > 0
        ? `drifting ${Math.round(startDriftMinutes)} min later`
        : `drifting ${Math.round(Math.abs(startDriftMinutes))} min earlier`;

  const confidence = clamp(
    (strongestCandidate.rawScore / totalRecencyWeight) * 0.7 +
      (strongestCandidate.matches / offPeakWindows.length) * 0.3,
    0.18,
    0.95,
  );
  const endsAt = strongestCandidate.startsAt.plus({
    minutes: strongestCandidate.durationMinutes || 240,
  });
  const countdownMinutes = Math.round(strongestCandidate.startsAt.diff(now, 'minutes').minutes);

  return {
    startsAtLabel: strongestCandidate.startsAt.toFormat("ccc, dd LLL yyyy 'at' HH:mm"),
    endsAtLabel: endsAt.toFormat('HH:mm'),
    countdownLabel: formatCountdown(countdownMinutes),
    confidence,
    matches: strongestCandidate.matches,
    clusterLabel: `${strongestCandidate.startsAt.toFormat('ccc')} around ${strongestCandidate.startsAt.toFormat('HH:mm')}`,
    explanation: `Weighted from ${strongestCandidate.matches} similar off-peak starts, with the recent pattern ${driftLabel}.`,
  };
}

function buildLiveSnapshot(now: DateTime, heatmap: HeatmapCell[], zone: string): LiveSnapshot {
  const currentCell = heatmap.find(
    (cell) => cell.dayIndex === now.weekday - 1 && cell.hour === now.hour,
  );
  const offPeak = currentCell?.offPeak ?? 0;
  const peak = currentCell?.peak ?? 0;

  let phaseLabel = 'Balanced';
  let phaseTone: LiveSnapshot['phaseTone'] = 'balanced';
  let signalDetail = 'Historic pattern is evenly split around this hour.';

  if (offPeak > peak * 1.1) {
    phaseLabel = 'Off-peak leaning';
    phaseTone = 'off_peak';
    signalDetail = 'Recorded history suggests lower demand around this local hour.';
  } else if (peak > offPeak * 1.1) {
    phaseLabel = 'Peak leaning';
    phaseTone = 'peak';
    signalDetail = 'Recorded history suggests heavier demand around this local hour.';
  }

  return {
    zoneLabel: zone,
    timeLabel: now.toFormat('HH:mm:ss'),
    dateLabel: now.toFormat('cccc, dd LLL yyyy'),
    phaseLabel,
    phaseTone,
    signalDetail,
  };
}

function buildMetrics(forecast: ForecastResult): MetricSnapshot[] {
  const offPeakWindows = promotionHistory.filter((window) => window.phase === 'off_peak');
  const peakWindows = promotionHistory.filter((window) => window.phase === 'peak');
  const offPeakDurations = offPeakWindows.map((window) =>
    DateTime.fromISO(window.endedAtUtc, { zone: 'utc' })
      .diff(DateTime.fromISO(window.startedAtUtc, { zone: 'utc' }), 'minutes')
      .minutes,
  );

  return [
    {
      label: 'Recorded windows',
      value: `${promotionHistory.length}`,
      detail: `${offPeakWindows.length} off-peak and ${peakWindows.length} peak observations.`,
      tone: 'neutral',
    },
    {
      label: 'Median quiet window',
      value: formatDuration(Math.round(median(offPeakDurations))),
      detail: 'Typical off-peak lift duration across the sample.',
      tone: 'cool',
    },
    {
      label: 'Median off-peak lift',
      value: formatDelta(median(offPeakWindows.map((window) => window.observedCapacityDelta))),
      detail: 'Observed capacity change during quiet windows.',
      tone: 'cool',
    },
    {
      label: 'Median peak slowdown',
      value: formatDelta(median(peakWindows.map((window) => window.observedCapacityDelta))),
      detail: `Forecast confidence is ${Math.round(forecast.confidence * 100)}% for the next lift.`,
      tone: 'warm',
    },
  ];
}

export function buildDashboardModel(now: DateTime, zone: string): DashboardModel {
  const heatmap = buildHeatmap(zone);
  const live = buildLiveSnapshot(now, heatmap, zone);
  const forecast = buildForecast(now, zone);
  const history = [...promotionHistory]
    .map((window) => localizeWindow(window, zone))
    .sort((left, right) => right.startedAtMillis - left.startedAtMillis);
  const historySourceLabel = `${promotionHistoryMeta.sourceLabel} through ${utcToZone(
    promotionHistoryMeta.lastUpdatedUtc,
    zone,
  ).toFormat("dd LLL yyyy 'at' HH:mm")} local`;
  const todaySignal = heatmap
    .filter((cell) => cell.dayIndex === now.weekday - 1)
    .map<SignalHour>((cell) => ({
      hour: cell.hour,
      label: shortHourLabel(cell.hour),
      peak: cell.peak,
      offPeak: cell.offPeak,
      dominant:
        cell.offPeak > cell.peak * 1.1
          ? 'off_peak'
          : cell.peak > cell.offPeak * 1.1
            ? 'peak'
            : 'balanced',
      intensity: cell.intensity,
    }));

  return {
    viewerZone: zone,
    historySourceLabel,
    live,
    forecast,
    metrics: buildMetrics(forecast),
    todaySignal,
    heatmap,
    history,
  };
}
