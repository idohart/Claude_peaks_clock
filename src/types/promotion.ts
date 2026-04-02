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

export interface PromotionForecast {
  kind: 'official_window' | 'estimated_campaign';
  startsAtUtc: string;
  endsAtUtc: string | null;
  confidence: number;
  explanation: string;
  basis: string;
  matchedCampaigns: number;
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
  isPeak: boolean;
}

export interface WeeklyHeatmapCell {
  dayLabel: string;
  hour: number;
  usage: number;
}

export interface ForecastViewModel {
  label: string;
  countdown: string;
  reason: string;
  confidence: number;
  kindLabel: string;
  basis: string;
}

export interface ClockStatus {
  label: string;
  usage: number;
  tone: 'peak' | 'moderate' | 'off_peak';
}

export interface PromotionHistoryEntry {
  id: string;
  date: string;
  time: string;
  day: string;
  usage: number;
  duration: string;
  reason: string;
  phase: PromotionPhase;
  sourceUrl: string;
}

export interface DashboardViewModel {
  sourceLabel: string;
  sourceUrls: string[];
  timezone: string;
  todayUsage: UsageHourPoint[];
  weeklyHeatmap: WeeklyHeatmapCell[][];
  forecast: ForecastViewModel | null;
  history: PromotionHistoryEntry[];
  currentStatus: ClockStatus;
}
