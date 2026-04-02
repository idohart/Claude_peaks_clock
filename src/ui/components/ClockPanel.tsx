import type { ForecastResult, LiveSnapshot } from '../../types/promotion';

interface ClockPanelProps {
  historySourceLabel: string;
  live: LiveSnapshot;
  forecast: ForecastResult;
}

export function ClockPanel({ historySourceLabel, live, forecast }: ClockPanelProps) {
  return (
    <section className="panel hero-panel hero-panel-primary">
      <div className="panel-heading">
        <p className="eyebrow">Live local clock</p>
        <span className="badge badge-neutral">{live.zoneLabel}</span>
      </div>

      <div className="clock-block">
        <p className="clock-date">{live.dateLabel}</p>
        <h2 className="clock-time">{live.timeLabel}</h2>
      </div>

      <div className="signal-row">
        <span className={`signal-pill signal-pill-${live.phaseTone}`}>{live.phaseLabel}</span>
        <span className="countdown-pill">Next lift in {forecast.countdownLabel}</span>
      </div>

      <p className="panel-copy">{live.signalDetail}</p>
      <p className="caption">{historySourceLabel}</p>
    </section>
  );
}
