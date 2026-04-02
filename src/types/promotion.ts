export type PromotionPhase = 'peak' | 'off_peak';

export interface PromotionWindow {
  id: string;
  phase: PromotionPhase;
  startedAtUtc: string;
  endedAtUtc: string;
  observedCapacityDelta: number;
  label: string;
  notes: string;
}

export interface TimelineSegment {
  left: number;
  width: number;
}

export interface LocalizedWindow {
  id: string;
  phase: PromotionPhase;
  startedAtMillis: number;
  phaseLabel: string;
  startedAtLabel: string;
  endedAtLabel: string;
  dayLabel: string;
  dateLabel: string;
  durationLabel: string;
  deltaLabel: string;
  label: string;
  notes: string;
  segments: TimelineSegment[];
}

export interface ForecastResult {
  startsAtLabel: string;
  endsAtLabel: string;
  countdownLabel: string;
  confidence: number;
  matches: number;
  clusterLabel: string;
  explanation: string;
}

export interface HeatmapCell {
  dayIndex: number;
  dayLabel: string;
  hour: number;
  label: string;
  peak: number;
  offPeak: number;
  dominant: PromotionPhase | 'mixed';
  intensity: number;
}

export interface SignalHour {
  hour: number;
  label: string;
  peak: number;
  offPeak: number;
  dominant: PromotionPhase | 'balanced';
  intensity: number;
}

export interface MetricSnapshot {
  label: string;
  value: string;
  detail: string;
  tone: 'cool' | 'warm' | 'neutral';
}

export interface LiveSnapshot {
  zoneLabel: string;
  timeLabel: string;
  dateLabel: string;
  phaseLabel: string;
  phaseTone: PromotionPhase | 'balanced';
  signalDetail: string;
}

export interface DashboardModel {
  viewerZone: string;
  historySourceLabel: string;
  live: LiveSnapshot;
  forecast: ForecastResult;
  metrics: MetricSnapshot[];
  todaySignal: SignalHour[];
  heatmap: HeatmapCell[];
  history: LocalizedWindow[];
}
