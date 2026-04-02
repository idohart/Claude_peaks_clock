import type { SignalHour } from '../../types/promotion';

interface ProbabilityStripProps {
  hours: SignalHour[];
}

export function ProbabilityStrip({ hours }: ProbabilityStripProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Today signal strip</p>
        <span className="badge badge-neutral">24h local pattern</span>
      </div>

      <div className="signal-strip">
        {hours.map((hour) => (
          <div className="signal-column" key={hour.hour}>
            <div className="signal-bars">
              <span
                className="signal-bar signal-bar-offpeak"
                style={{
                  height: `${Math.max(10, hour.offPeak * 90)}%`,
                  opacity: 0.3 + hour.intensity * 0.7,
                }}
                title={`${hour.label} off-peak score ${hour.offPeak.toFixed(2)}`}
              />
              <span
                className="signal-bar signal-bar-peak"
                style={{
                  height: `${Math.max(10, hour.peak * 90)}%`,
                  opacity: 0.3 + hour.intensity * 0.7,
                }}
                title={`${hour.label} peak score ${hour.peak.toFixed(2)}`}
              />
            </div>
            <span className="signal-label">{hour.hour % 3 === 0 ? hour.label.slice(0, 2) : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
