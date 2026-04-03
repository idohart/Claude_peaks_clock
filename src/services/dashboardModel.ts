import { DateTime } from 'luxon';

import { formatCountdown, getViewerTimeZone } from '../lib/time';
import type {
  BaselineDay,
  BestTimeRecommendation,
  CampaignForecastViewModel,
  CampaignSummary,
  DashboardNotice,
  DashboardViewModel,
  ForecastTransitionViewModel,
  ForecastViewModel,
  PromotionSnapshotResponse,
} from '../types/promotion';
import { PERMANENT_WEEKDAY_PEAK_BASELINE } from '../types/promotion';

function isPermanentWeekdayPeak(hour: number, weekday: number): boolean {
  return (
    weekday <= 5 &&
    hour >= PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayStartHour &&
    hour < PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayEndHour
  );
}

function isPermanentWeekdayPeakUtc(atUtc: DateTime): boolean {
  const ref = atUtc.setZone(PERMANENT_WEEKDAY_PEAK_BASELINE.zone);
  return isPermanentWeekdayPeak(ref.hour, ref.weekday);
}

function buildBaselineSchedule(): BaselineDay[] {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return dayNames.map((dayLabel, index) => ({
    dayLabel,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      isPeak: isPermanentWeekdayPeak(hour, index + 1),
    })),
  }));
}

function buildBestTimes(nowUtc: DateTime, zone: string, snapshot: PromotionSnapshotResponse): BestTimeRecommendation[] {
  const recommendations: BestTimeRecommendation[] = [];
  const nowLocal = nowUtc.setZone(zone);
  const horizonEnd = nowLocal.plus({ hours: 12 });

  const hasActiveIncident = (snapshot.statusPage?.activeIncidents.length ?? 0) > 0;
  const activeWindow = snapshot.windows.find((w) => {
    const s = DateTime.fromISO(w.startedAtUtc, { zone: 'utc' });
    const e = DateTime.fromISO(w.endedAtUtc, { zone: 'utc' });
    return nowUtc >= s && nowUtc < e;
  });

  let cursor = nowLocal.startOf('hour');
  let runStart: DateTime | null = null;
  let runQuality: 'great' | 'good' | 'fair' = 'great';

  const flushRun = () => {
    if (runStart && cursor > runStart) {
      recommendations.push({
        label: `${runStart.toFormat('HH:mm')} - ${cursor.toFormat('HH:mm')}`,
        startHour: runStart.hour,
        endHour: cursor.hour,
        reason:
          runQuality === 'great'
            ? 'Off-peak baseline, low expected demand'
            : runQuality === 'good'
              ? 'Outside core US business hours'
              : 'Weekday business hours — expect higher demand',
        quality: runQuality,
      });
    }
    runStart = null;
  };

  while (cursor < horizonEnd) {
    const cursorUtc = cursor.toUTC();
    const ptTime = cursorUtc.setZone(PERMANENT_WEEKDAY_PEAK_BASELINE.zone);
    const isBaselinePeak = isPermanentWeekdayPeak(ptTime.hour, ptTime.weekday);

    let officialPhase: 'peak' | 'off_peak' | null = null;
    if (activeWindow) {
      const wEnd = DateTime.fromISO(activeWindow.endedAtUtc, { zone: 'utc' });
      if (cursorUtc < wEnd) {
        officialPhase = activeWindow.phase;
      }
    }

    let hourQuality: 'great' | 'good' | 'fair';
    if (officialPhase === 'off_peak') {
      hourQuality = 'great';
    } else if (officialPhase === 'peak') {
      hourQuality = 'fair';
    } else if (!isBaselinePeak) {
      hourQuality = hasActiveIncident ? 'good' : 'great';
    } else {
      hourQuality = 'fair';
    }

    if (runStart === null) {
      runStart = cursor;
      runQuality = hourQuality;
    } else if (hourQuality !== runQuality) {
      flushRun();
      runStart = cursor;
      runQuality = hourQuality;
    }

    cursor = cursor.plus({ hours: 1 });
  }

  flushRun();
  return recommendations;
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

  if (forecast.confidence < 0.2) {
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

function getPlatformTone(snapshot: PromotionSnapshotResponse): 'normal' | 'warning' | 'critical' {
  if (!snapshot.statusPage) {
    return 'warning';
  }

  if (
    snapshot.statusPage.indicator === 'critical' ||
    snapshot.statusPage.indicator === 'major'
  ) {
    return 'critical';
  }

  if (snapshot.statusPage.activeIncidents.length > 0 || snapshot.statusPage.indicator !== 'none') {
    return 'warning';
  }

  return 'normal';
}

function buildNotices(snapshot: PromotionSnapshotResponse): DashboardNotice[] {
  const notices: DashboardNotice[] = [];

  if (snapshot.manualOverride) {
    notices.push({
      id: 'manual-override',
      title: 'Manual Advisory',
      detail: snapshot.manualOverride.source
        ? `${snapshot.manualOverride.message} Source: ${snapshot.manualOverride.source}.`
        : snapshot.manualOverride.message,
      tone: snapshot.manualOverride.severity,
    });
  }

  if (snapshot.statusPage?.activeIncidents.length) {
    const incidentNames = snapshot.statusPage.activeIncidents
      .slice(0, 2)
      .map((incident) => incident.name)
      .join(' | ');

    notices.push({
      id: 'status-page-incidents',
      title: 'Active Status Incident',
      detail:
        snapshot.statusPage.activeIncidents.length > 2
          ? `${incidentNames} | +${snapshot.statusPage.activeIncidents.length - 2} more unresolved incident(s).`
          : incidentNames,
      tone: getPlatformTone(snapshot) === 'critical' ? 'critical' : 'warning',
    });
  }

  if (snapshot.parseWarnings.length > 0) {
    notices.push({
      id: 'parse-warnings',
      title: 'Parser Warning',
      detail:
        snapshot.parseWarnings.length === 1
          ? snapshot.parseWarnings[0].message
          : `${snapshot.parseWarnings.length} article warnings detected. ${snapshot.parseWarnings[0].message}`,
      tone: 'warning',
    });
  }

  return notices;
}

function buildCampaignHistory(
  snapshot: PromotionSnapshotResponse,
  zone: string,
  nowUtc: DateTime,
): CampaignSummary[] {
  return [...snapshot.campaigns]
    .sort((a, b) => b.startsAtUtc.localeCompare(a.startsAtUtc))
    .map((campaign) => {
      const start = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' }).setZone(zone);
      const end = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' }).setZone(zone);
      const campaignStart = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' });
      const campaignEnd = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' });
      const isActive = nowUtc >= campaignStart && nowUtc <= campaignEnd;

      return {
        id: campaign.id,
        title: campaign.title.replace(/^Claude\s+/i, ''),
        dateRange: `${start.toFormat('LLL dd, yyyy')} - ${end.toFormat('LLL dd, yyyy')}`,
        scheduleSummary: campaign.scheduleSummary,
        sourceUrl: campaign.sourceUrl,
        isActive,
      };
    });
}

export function buildDashboardModel(
  snapshot: PromotionSnapshotResponse,
  nowMillis: number,
  zone = getViewerTimeZone(),
): DashboardViewModel {
  const now = DateTime.fromMillis(nowMillis).setZone(zone);
  const nowUtc = now.toUTC();

  const activeOfficialWindow = snapshot.windows.find((window) => {
    const startedAtUtc = DateTime.fromISO(window.startedAtUtc, { zone: 'utc' });
    const endedAtUtc = DateTime.fromISO(window.endedAtUtc, { zone: 'utc' });
    return nowUtc >= startedAtUtc && nowUtc < endedAtUtc;
  });

  const platformTone = getPlatformTone(snapshot);
  const platformDetail = !snapshot.statusPage
    ? 'Could not reach status.claude.ai during the latest backend refresh.'
    : snapshot.statusPage.activeIncidents.length > 0
      ? snapshot.statusPage.activeIncidents
          .slice(0, 2)
          .map((incident) => incident.name)
          .join(' | ')
      : `Live feed: ${snapshot.statusPage.url}`;

  let phaseLabel: string;
  let phaseTone: 'peak' | 'off_peak';
  let phaseSource: string;

  if (activeOfficialWindow) {
    phaseTone = activeOfficialWindow.phase;
    phaseLabel = activeOfficialWindow.phase === 'off_peak' ? 'Off-Peak' : 'Peak';
    phaseSource = 'Official promotion window';
  } else {
    const isBaselinePeak = isPermanentWeekdayPeakUtc(nowUtc);
    phaseTone = isBaselinePeak ? 'peak' : 'off_peak';
    phaseLabel = isBaselinePeak ? 'Peak (Baseline)' : 'Off-Peak (Baseline)';
    phaseSource = '5 AM - 11 AM PT weekday baseline';
  }

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
    notices: buildNotices(snapshot),
    baselineSchedule: buildBaselineSchedule(),
    bestTimes: buildBestTimes(nowUtc, zone, snapshot),
    forecast: buildForecastViewModel(snapshot, zone, now),
    campaignHistory: buildCampaignHistory(snapshot, zone, nowUtc),
    currentStatus: {
      phaseLabel,
      phaseTone,
      phaseSource,
      platformLabel: snapshot.statusPage?.description ?? 'Status Feed Unavailable',
      platformTone,
      platformDetail,
    },
  };
}
