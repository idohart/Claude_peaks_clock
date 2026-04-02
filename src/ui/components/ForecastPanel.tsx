import type { ForecastResult } from '../../types/promotion';

interface ForecastPanelProps {
  forecast: ForecastResult;
}

export function ForecastPanel({ forecast }: ForecastPanelProps) {
  return (
    <section className="panel hero-panel">
      <div className="panel-heading">
        <p className="eyebrow">Forecast</p>
        <span className="badge badge-cool">{Math.round(forecast.confidence * 100)}% confidence</span>
      </div>

      <h2 className="forecast-title">Next likely promotion start</h2>
      <p className="forecast-start">{forecast.startsAtLabel}</p>
      <p className="forecast-end">Expected to hold until about {forecast.endsAtLabel} local time.</p>

      <div className="confidence-track" aria-hidden="true">
        <span className="confidence-fill" style={{ width: `${forecast.confidence * 100}%` }} />
      </div>

      <div className="forecast-meta">
        <div>
          <p className="mini-label">Pattern cluster</p>
          <p className="mini-value">{forecast.clusterLabel}</p>
        </div>
        <div>
          <p className="mini-label">Historical matches</p>
          <p className="mini-value">{forecast.matches}</p>
        </div>
      </div>

      <p className="panel-copy">{forecast.explanation}</p>
    </section>
  );
}
