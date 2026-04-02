import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

import { getViewerTimeZone } from './lib/time';
import { buildDashboardModel } from './services/promotionAnalytics';
import { ClockPanel } from './ui/components/ClockPanel';
import { ForecastPanel } from './ui/components/ForecastPanel';
import { HistoryInfographic } from './ui/components/HistoryInfographic';
import { MetricCard } from './ui/components/MetricCard';
import { ProbabilityStrip } from './ui/components/ProbabilityStrip';
import { WeeklyMatrix } from './ui/components/WeeklyMatrix';

export default function App() {
  const [zone] = useState(() => getViewerTimeZone());
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const now = DateTime.fromMillis(tick).setZone(zone);
  const dashboard = buildDashboardModel(now, zone);

  return (
    <main className="shell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />

      <header className="hero">
        <p className="eyebrow">Claude Promotion Clock</p>
        <h1 className="hero-title">Know the quiet window before it opens.</h1>
        <p className="hero-copy">
          This dashboard localizes every recorded Claude peak and off-peak block to the
          viewer timezone, then scores the next likely promotion lift from that pattern in
          real time.
        </p>
        <div className="hero-tags">
          <span className="badge badge-neutral">Timezone-aware</span>
          <span className="badge badge-neutral">Real-time clock</span>
          <span className="badge badge-neutral">Forecast from history</span>
        </div>
      </header>

      <section className="hero-grid">
        <ClockPanel
          historySourceLabel={dashboard.historySourceLabel}
          live={dashboard.live}
          forecast={dashboard.forecast}
        />
        <ForecastPanel forecast={dashboard.forecast} />
      </section>

      <section className="metrics-grid">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="viz-grid">
        <ProbabilityStrip hours={dashboard.todaySignal} />
        <WeeklyMatrix cells={dashboard.heatmap} />
      </section>

      <HistoryInfographic history={dashboard.history} />

      <footer className="footer-note">
        Seed history is loaded from <code>src/data/promotionHistory.ts</code>. Replace it
        with your own observations to turn the forecast into a production-grade signal.
      </footer>
    </main>
  );
}
