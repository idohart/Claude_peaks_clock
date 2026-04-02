import type { LocalizedWindow } from '../../types/promotion';

interface HistoryInfographicProps {
  history: LocalizedWindow[];
}

export function HistoryInfographic({ history }: HistoryInfographicProps) {
  const axisLabels = ['00', '06', '12', '18', '24'];

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Historical windows</p>
        <span className="badge badge-neutral">{history.length} tracked blocks</span>
      </div>

      <div className="timeline-axis">
        <div className="timeline-axis-copy">
          {axisLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="history-list">
        {history.map((window) => (
          <article className="history-row" key={window.id}>
            <div className="history-meta">
              <div>
                <p className="history-date">
                  {window.dayLabel}, {window.dateLabel}
                </p>
                <p className="history-copy">{window.label}</p>
              </div>
              <div className="history-stats">
                <span className={`badge ${window.phase === 'off_peak' ? 'badge-cool' : 'badge-warm'}`}>
                  {window.phaseLabel}
                </span>
                <span className="delta-chip">{window.deltaLabel}</span>
                <span className="history-range">
                  {window.startedAtLabel} to {window.endedAtLabel}
                </span>
              </div>
            </div>

            <div className="timeline-track">
              {window.segments.map((segment, index) => (
                <span
                  className={`timeline-segment timeline-segment-${window.phase}`}
                  key={`${window.id}-${index}`}
                  style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                />
              ))}
            </div>

            <div className="history-footer">
              <span>{window.durationLabel}</span>
              <span>{window.notes}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
