import { useEffect, useMemo, useState } from 'react';

import { buildDashboardModel } from '../services/dashboardModel';
import type { PromotionSnapshotResponse } from '../types/promotion';
import { BaselineSchedule } from './components/BaselineSchedule';
import { BestTimeCard } from './components/BestTimeCard';
import { ClockDisplay } from './components/ClockDisplay';
import { NotificationToggle } from './components/NotificationToggle';
import { PredictionPanel } from './components/PredictionPanel';
import { PromotionHistory } from './components/PromotionHistory';
import { StatusNotices } from './components/StatusNotices';

const SNAPSHOT_REFRESH_MS = 2 * 60 * 1000;

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
      }
    }

    fetchSnapshot().catch(() => undefined);
    const refreshTimer = window.setInterval(() => {
      fetchSnapshot().catch(() => undefined);
    }, SNAPSHOT_REFRESH_MS);

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
          <div className="flex items-start justify-between gap-4 mt-3">
            <div>
              <h1 className="text-[#e2e2e8] font-['JetBrains_Mono'] text-3xl md:text-4xl tracking-tight">
                Claude Code
                <br />
                <span className="text-[#c4a1ff]">Promotion Clock</span>
              </h1>
              <p className="text-[#6b6b80] mt-3 max-w-lg">
                Real-time peak/off-peak status and best usage windows — localized to your timezone.
              </p>
            </div>
            {dashboard ? <NotificationToggle status={dashboard.currentStatus} /> : null}
          </div>
          {error ? <p className="text-[#ff7a90] text-sm mt-2">{error}</p> : null}
        </header>

        {dashboard ? (
          <>
            <StatusNotices notices={dashboard.notices} />

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

            <BestTimeCard recommendations={dashboard.bestTimes} />
            <BaselineSchedule data={dashboard.baselineSchedule} timezone={dashboard.timezone} />
            <PromotionHistory campaigns={dashboard.campaignHistory} />

            <footer className="border-t border-white/5 pt-6 pb-8">
              <p className="text-[#6b6b80] text-sm max-w-xl">
                Peak/off-peak baseline from Anthropic&apos;s published schedule. Campaign data fetched
                from official Claude Help Center promotion pages.
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
