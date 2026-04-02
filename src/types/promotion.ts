export type PromotionPhase = 'peak' | 'off_peak';

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

export interface PromotionSnapshotResponse {
  fetchedAtUtc: string;
  sourceLabel: string;
  sourceUrls: string[];
  campaigns: PromotionCampaign[];
  windows: PromotionWindow[];
  forecast: PromotionForecast | null;
}

export interface LocalizedPromotionWindow {
  id: string;
  campaignId: string;
  phase: PromotionPhase;
  phaseLabel: string;
  startedAtMillis: number;
  startedAtLabel: string;
  endedAtLabel: string;
  dayLabel: string;
  dateLabel: string;
  durationLabel: string;
  label: string;
  notes: string;
  sourceUrl: string;
}

export interface UsageHourPoint {
  hour: number;
  label: string;
  usage: number;
  hasData: boolean;
  isPeak: boolean;
}

export interface WeeklyHeatmapCell {
  dayLabel: string;
  dateLabel: string;
  hour: number;
  usage: number;
  hasData: boolean;
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
  officialLabel: string;
  officialTone: 'peak' | 'off_peak' | 'inactive';
  officialDetail: string;
  patternLabel: string;
  patternUsage: number;
  patternTone: 'peak' | 'moderate' | 'off_peak';
}

export interface PromotionHistoryEntry {
  id: string;
  date: string;
  timeRange: string;
  day: string;
  usage: number;
  duration: string;
  reason: string;
  phase: PromotionPhase;
  phaseLabel: string;
  sourceUrl: string;
}

export interface DashboardViewModel {
  sourceLabel: string;
  sourceUrls: string[];
  sourceLinks: Array<{ url: string; label: string }>;
  timezone: string;
  todayUsage: UsageHourPoint[];
  weeklyHeatmap: WeeklyHeatmapCell[][];
  forecast: ForecastViewModel | null;
  history: PromotionHistoryEntry[];
  currentStatus: ClockStatus;
}
