import type { HeatmapCell } from '../../types/promotion';

interface WeeklyMatrixProps {
  cells: HeatmapCell[];
}

function cellClassName(cell: HeatmapCell): string {
  if (cell.dominant === 'off_peak') {
    return 'matrix-cell matrix-cell-offpeak';
  }

  if (cell.dominant === 'peak') {
    return 'matrix-cell matrix-cell-peak';
  }

  return 'matrix-cell matrix-cell-mixed';
}

export function WeeklyMatrix({ cells }: WeeklyMatrixProps) {
  const days = [...new Set(cells.map((cell) => cell.dayLabel))];
  const hours = Array.from({ length: 24 }, (_, index) => index);

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Weekly load map</p>
        <div className="legend">
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-offpeak" />
            Off-peak
          </span>
          <span className="legend-item">
            <i className="legend-swatch legend-swatch-peak" />
            Peak
          </span>
        </div>
      </div>

      <div className="matrix-wrap">
        <div className="matrix-hours">
          <span />
          {hours.map((hour) => (
            <span key={hour}>{hour % 3 === 0 ? `${hour}` : ''}</span>
          ))}
        </div>

        <div className="matrix-grid">
          {days.map((day) => (
            <div className="matrix-row" key={day}>
              <span className="matrix-day">{day}</span>
              {cells
                .filter((cell) => cell.dayLabel === day)
                .map((cell) => (
                  <span
                    className={cellClassName(cell)}
                    key={cell.label}
                    style={{ opacity: 0.22 + cell.intensity * 0.78 }}
                    title={`${cell.label}: off-peak ${cell.offPeak.toFixed(2)}, peak ${cell.peak.toFixed(2)}`}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
