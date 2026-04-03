import { DateTime } from 'luxon';

import { formatCountdown, getViewerTimeZone } from '../lib/time';
import type {
  CampaignForecastViewModel,
  CampaignSummary,
  DashboardNotice,
  DashboardViewModel,
  ForecastTransitionViewModel,
  ForecastViewModel,
  HourlyScoreLocal,
  PromotionSnapshotResponse,
} from '../types/promotion';
import { PERMANENT_WEEKDAY_PEAK_BASELINE } from '../types/promotion';

function isPermanentWeekdayPeakUtc(atUtc: DateTime): boolean {
  const ref = atUtc.setZone(PERMANENT_WEEKDAY_PEAK_BASELINE.zone);
  return (
    ref.weekday <= 5 &&
    ref.hour >= PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayStartHour &&
    ref.hour < PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayEndHour
  );
}

function buildHourlyScoresLocal(
  snapshot: PromotionSnapshotResponse,
  zone: string,
  nowHour: DateTime,
): HourlyScoreLocal[] {
  return snapshot.hourlyScores.map((score) => {
    const local = DateTime.fromISO(score.hourUtc, { zone: 'utc' }).setZone(zone);
    return {
      hour: local.hour,
      label: local.toFormat('HH:mm'),
      peakProbability: score.peakProbability,
      support: score.support,
      officialPhase: score.officialPhase,
      isCurrent: local.hasSame(nowHour, 'hour') && local.hasSame(nowHour, 'day'),
    };
  });
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
  if (!forecast) return null;

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
  if (!forecast || forecast.confidence < 0.2) return null;

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
  if (!snapshot.forecast) return null;

  return {
    campaign: buildCampaignViewModel(snapshot.forecast.campaign, zone, now),
    nextOffPeak: buildTransitionViewModel(snapshot.forecast.nextOffPeak, zone, now),
    nextPeak: buildTransitionViewModel(snapshot.forecast.nextPeak, zone, now),
  };
}

function getPlatformTone(snapshot: PromotionSnapshotResponse): 'normal' | 'warning' | 'critical' {
  if (!snapshot.statusPage) return 'warning';
  if (snapshot.statusPage.indicator === 'critical' || snapshot.statusPage.indicator === 'major') return 'critical';
  if (snapshot.statusPage.activeIncidents.length > 0 || snapshot.statusPage.indicator !== 'none') return 'warning';
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
    const names = snapshot.statusPage.activeIncidents.slice(0, 2).map((i) => i.name).join(' | ');
    notices.push({
      id: 'status-page-incidents',
      title: 'Active Status Incident',
      detail: snapshot.statusPage.activeIncidents.length > 2
        ? `${names} | +${snapshot.statusPage.activeIncidents.length - 2} more`
        : names,
      tone: getPlatformTone(snapshot) === 'critical' ? 'critical' : 'warning',
    });
  }

  if (snapshot.parseWarnings.length > 0) {
    notices.push({
      id: 'parse-warnings',
      title: 'Parser Warning',
      detail: snapshot.parseWarnings.length === 1
        ? snapshot.parseWarnings[0].message
        : `${snapshot.parseWarnings.length} article warnings. ${snapshot.parseWarnings[0].message}`,
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
      const cStart = DateTime.fromISO(campaign.startsAtUtc, { zone: 'utc' });
      const cEnd = DateTime.fromISO(campaign.endsAtUtc, { zone: 'utc' });

      return {
        id: campaign.id,
        title: campaign.title.replace(/^Claude\s+/i, ''),
        dateRange: `${start.toFormat('LLL dd, yyyy')} - ${end.toFormat('LLL dd, yyyy')}`,
        scheduleSummary: campaign.scheduleSummary,
        sourceUrl: campaign.sourceUrl,
        isActive: nowUtc >= cStart && nowUtc <= cEnd,
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

  const activeWindow = snapshot.windows.find((w) => {
    const s = DateTime.fromISO(w.startedAtUtc, { zone: 'utc' });
    const e = DateTime.fromISO(w.endedAtUtc, { zone: 'utc' });
    return nowUtc >= s && nowUtc < e;
  });

  const platformTone = getPlatformTone(snapshot);
  const platformDetail = !snapshot.statusPage
    ? 'Could not reach status.claude.ai'
    : snapshot.statusPage.activeIncidents.length > 0
      ? snapshot.statusPage.activeIncidents.slice(0, 2).map((i) => i.name).join(' | ')
      : '';

  let phaseLabel: string;
  let phaseTone: 'peak' | 'off_peak';
  let phaseSource: string;

  if (activeWindow) {
    phaseTone = activeWindow.phase;
    phaseLabel = activeWindow.phase === 'off_peak' ? 'Off-Peak' : 'Peak';
    phaseSource = 'Official promotion window';
  } else {
    const isBaselinePeak = isPermanentWeekdayPeakUtc(nowUtc);
    phaseTone = isBaselinePeak ? 'peak' : 'off_peak';
    phaseLabel = isBaselinePeak ? 'Peak' : 'Off-Peak';
    phaseSource = 'Baseline (5-11 AM PT weekdays)';
  }

  return {
    sourceLabel: `Refreshed ${DateTime.fromISO(snapshot.fetchedAtUtc, { zone: 'utc' }).setZone(zone).toFormat('HH:mm')}`,
    timezone: zone,
    notices: buildNotices(snapshot),
    hourlyScores: buildHourlyScoresLocal(snapshot, zone, now),
    forecast: buildForecastViewModel(snapshot, zone, now),
    campaignHistory: buildCampaignHistory(snapshot, zone, nowUtc),
    currentStatus: {
      phaseLabel,
      phaseTone,
      phaseSource,
      platformLabel: snapshot.statusPage?.description ?? 'Status Unavailable',
      platformTone,
      platformDetail,
      latencyMs: snapshot.statusPage?.latencyMs ?? null,
    },
  };
}
