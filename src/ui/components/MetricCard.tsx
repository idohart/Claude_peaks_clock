import type { MetricSnapshot } from '../../types/promotion';

interface MetricCardProps {
  metric: MetricSnapshot;
}

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${metric.tone}`}>
      <p className="metric-label">{metric.label}</p>
      <strong className="metric-value">{metric.value}</strong>
      <p className="metric-detail">{metric.detail}</p>
    </article>
  );
}
