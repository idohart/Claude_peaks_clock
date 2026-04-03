export type PromotionPhase = 'peak' | 'off_peak';

export const PERMANENT_WEEKDAY_PEAK_BASELINE = {
  zone: 'America/Los_Angeles',
  weekdayStartHour: 5,
  weekdayEndHour: 11,
  peakProbability: 0.82,
  offPeakProbability: 0.82,
  support: 0.55,
} as const;

export interface PromotionCampaign {
  id: string;
  title: string;
  sourceUrl: string;
  summary: string;
  startsAtUtc: string;
  endsAtUtc: string;
  updatedAtUtc: string | null;
  scheduleSummary: string;
}

export interface PromotionWindow {
  id: string;
  campaignId: string;
  phase: PromotionPhase;
  startedAtUtc: string;
  endedAtUtc: string;
  label: string;
  notes: string;
  sourceUrl: string;
}

export interface CampaignForecast {
  kind: 'official_campaign' | 'estimated_campaign';
  startsAtUtc: string;
  endsAtUtc: string | null;
  confidence: number;
  explanation: string;
  basis: string;
  matchedCampaigns: number;
}

export interface PhaseForecast {
  kind: 'official_window' | 'historical_inference';
  phase: PromotionPhase;
  startsAtUtc: string;
  endsAtUtc: string | null;
  confidence: number;
  explanation: string;
  basis: string;
}

export interface PromotionForecast {
  campaign: CampaignForecast | null;
  nextOffPeak: PhaseForecast | null;
  nextPeak: PhaseForecast | null;
}

export interface PromotionParseWarning {
  sourceUrl: string;
  message: string;
}

export interface ClaudeStatusIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  shortlink: string | null;
  updatedAtUtc: string | null;
}

export interface ClaudeStatusSummary {
  indicator: string;
  description: string;
  url: string;
  latencyMs: number;
  activeIncidents: ClaudeStatusIncident[];
}

export interface PromotionManualOverride {
  message: string;
  severity: 'info' | 'warning' | 'critical';
  source: string | null;
  updatedAtUtc: string | null;
}

export interface HourlyScore {
  hourUtc: string;
  peakProbability: number;
  support: number;
  officialPhase: PromotionPhase | null;
}

export interface PromotionSnapshotResponse {
  fetchedAtUtc: string;
  sourceLabel: string;
  sourceUrls: string[];
  campaigns: PromotionCampaign[];
  windows: PromotionWindow[];
  forecast: PromotionForecast | null;
  hourlyScores: HourlyScore[];
  parseWarnings: PromotionParseWarning[];
  statusPage: ClaudeStatusSummary | null;
  manualOverride: PromotionManualOverride | null;
}

export interface ForecastTransitionViewModel {
  phaseLabel: string;
  label: string;
  countdown: string;
  reason: string;
  confidence: number;
  kindLabel: string;
  basis: string;
}

export interface CampaignForecastViewModel {
  label: string;
  countdown: string;
  reason: string;
  confidence: number;
  kindLabel: string;
  basis: string;
}

export interface ForecastViewModel {
  campaign: CampaignForecastViewModel | null;
  nextOffPeak: ForecastTransitionViewModel | null;
  nextPeak: ForecastTransitionViewModel | null;
}

export interface ClockStatus {
  phaseLabel: string;
  phaseTone: 'peak' | 'off_peak';
  phaseSource: string;
  platformLabel: string;
  platformTone: 'normal' | 'warning' | 'critical';
  platformDetail: string;
  latencyMs: number | null;
}

export interface HourlyScoreLocal {
  hour: number;
  label: string;
  peakProbability: number;
  support: number;
  officialPhase: PromotionPhase | null;
  isCurrent: boolean;
}

export interface CampaignSummary {
  id: string;
  title: string;
  dateRange: string;
  scheduleSummary: string;
  sourceUrl: string;
  isActive: boolean;
}

export interface DashboardNotice {
  id: string;
  title: string;
  detail: string;
  tone: 'info' | 'warning' | 'critical';
}

export interface DashboardViewModel {
  sourceLabel: string;
  timezone: string;
  notices: DashboardNotice[];
  hourlyScores: HourlyScoreLocal[];
  forecast: ForecastViewModel | null;
  campaignHistory: CampaignSummary[];
  currentStatus: ClockStatus;
}
