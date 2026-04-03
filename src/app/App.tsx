import { useEffect, useMemo, useState } from 'react';

import { buildDashboardModel } from '../services/dashboardModel';
import type { PromotionSnapshotResponse } from '../types/promotion';
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
        if (!response.ok) throw new Error(`API failed: ${response.status}`);
        const data = (await response.json()) as PromotionSnapshotResponse;
        if (!cancelled) { setSnapshot(data); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    fetchSnapshot().catch(() => undefined);
    const refresh = window.setInterval(() => fetchSnapshot().catch(() => undefined), SNAPSHOT_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  const dashboard = useMemo(
    () => (snapshot ? buildDashboardModel(snapshot, tick) : null),
    [snapshot, tick],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 md:p-8 text-left" dir="ltr">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#e2e2e8] font-['JetBrains_Mono'] text-2xl md:text-3xl tracking-tight">
                Claude Code <span className="text-[#c4a1ff]">Clock</span>
              </h1>
              <p className="text-[#8b8ba0] text-sm mt-1">Peak/off-peak status and demand forecast</p>
            </div>
            <div className="flex items-center gap-3">
              {dashboard ? (
                <>
                  <span className="text-[#8b8ba0]/50 text-[11px] font-['JetBrains_Mono']">{dashboard.sourceLabel}</span>
                  <NotificationToggle status={dashboard.currentStatus} />
                </>
              ) : null}
            </div>
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
                  sourceLabel=""
                  timezone={dashboard.timezone}
                />
              </div>
              <div className="lg:col-span-3">
                <PredictionPanel forecast={dashboard.forecast} />
              </div>
            </div>

            <BestTimeCard scores={dashboard.hourlyScores} />
            <PromotionHistory campaigns={dashboard.campaignHistory} />
          </>
        ) : (
          <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
            <p className="text-[#8b8ba0] font-['JetBrains_Mono'] text-sm">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}
