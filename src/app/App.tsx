import { useEffect, useMemo, useState } from 'react';

import { buildDashboardModel } from '../services/dashboardModel';
import type { PromotionSnapshotResponse } from '../types/promotion';
import { ClockDisplay } from './components/ClockDisplay';
import { PredictionPanel } from './components/PredictionPanel';
import { PromotionHistory } from './components/PromotionHistory';
import { UsageChart } from './components/UsageChart';
import { WeeklyHeatmap } from './components/WeeklyHeatmap';

export default function App() {
  const [tick, setTick] = useState(() => Date.now());
  const [snapshot, setSnapshot] = useState<PromotionSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchSnapshot() {
      try {
        const response = await fetch('/api/promotions');
        if (!response.ok) {
          throw new Error(`Promotion API failed with ${response.status}`);
        }
        const data = (await response.json()) as PromotionSnapshotResponse;
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        }
      } finally {
        // no-op: the app shell stays visible while data syncs
      }
    }

    fetchSnapshot().catch(() => undefined);
    const refreshTimer = window.setInterval(() => {
      fetchSnapshot().catch(() => undefined);
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const dashboard = useMemo(
    () => (snapshot ? buildDashboardModel(snapshot, tick) : null),
    [snapshot, tick],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 md:p-8 text-left" dir="ltr">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="pt-8 pb-4">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-[#c4a1ff] font-['JetBrains_Mono'] tracking-wider text-sm uppercase">
              sys://monitor
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-[#c4a1ff]/30 to-transparent" />
          </div>
          <h1 className="text-[#e2e2e8] font-['JetBrains_Mono'] text-3xl md:text-4xl tracking-tight mt-3">
            Claude Code
            <br />
            <span className="text-[#c4a1ff]">Promotion Clock</span>
          </h1>
          <p className="text-[#6b6b80] mt-3 max-w-lg">
            Real-time clock with official Claude promotion schedules from the web, localized
            to your timezone and projected forward from published campaign history.
          </p>
          {error ? <p className="text-[#ff7a90] text-sm mt-2">{error}</p> : null}
        </header>

        {dashboard ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <ClockDisplay
                  currentTime={new Date(tick)}
                  status={dashboard.currentStatus}
                  sourceLabel={dashboard.sourceLabel}
                  timezone={dashboard.timezone}
                />
              </div>
              <div className="lg:col-span-3">
                <PredictionPanel forecast={dashboard.forecast} />
              </div>
            </div>

            <UsageChart data={dashboard.todayUsage} />
            <WeeklyHeatmap data={dashboard.weeklyHeatmap} />
            <PromotionHistory history={dashboard.history} />

            <footer className="border-t border-white/5 pt-6 pb-8">
              <p className="text-[#6b6b80] text-sm max-w-xl">
                Web data is fetched from official Claude Help Center promotion pages and converted
                into local-time peak and off-peak windows.
              </p>
            </footer>
          </>
        ) : (
          <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
            <p className="text-[#6b6b80] font-['JetBrains_Mono'] text-sm">
              Syncing official promotion data...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
