import { useMemo } from 'react';

interface PromotionEntry {
  id: number;
  date: string;
  time: string;
  day: string;
  usage: number;
  duration: string;
  reason: string;
}

function generateHistory(): PromotionEntry[] {
  const reasons = [
    'Late night - lowest usage period',
    'Early morning - pre-work hours',
    'Weekend low-traffic window',
    'Off-peak period detected',
    'Scheduled maintenance window',
    'Holiday reduced activity',
  ];
  const durations = ['12 min', '18 min', '8 min', '25 min', '15 min', '22 min', '10 min', '30 min', '14 min', '20 min'];
  const entries: PromotionEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i - 1);
    // Promotions typically happen at off-peak hours
    const hour = [2, 3, 4, 5, 6, 1, 3, 2, 5, 4, 6, 1][i];
    const minute = [14, 42, 5, 30, 18, 55, 22, 48, 10, 37, 3, 50][i];
    d.setHours(hour, minute, 0);

    entries.push({
      id: i,
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      usage: Math.round(5 + Math.random() * 25),
      duration: durations[i % durations.length],
      reason: reasons[i % reasons.length],
    });
  }

  return entries;
}

export function PromotionHistory() {
  const history = useMemo(() => generateHistory(), []);

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
            Promotion History
          </span>
          <p className="text-[#6b6b80]/60 text-xs mt-1">Past deployments during off-peak windows</p>
        </div>
        <span className="text-[#6b6b80]/40 text-xs font-['JetBrains_Mono']">{history.length} records</span>
      </div>

      <div className="flex flex-col gap-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="rounded-md bg-[#0a0a0f] border border-white/[0.06] p-4 hover:border-[#c4a1ff]/20 transition-colors flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
          >
            <div className="flex items-center gap-4">
              <span className="text-[#e2e2e8] text-sm font-['JetBrains_Mono']">{entry.time}</span>
              <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono']">{entry.day}, {entry.date}</span>
            </div>
            <p className="text-[#6b6b80] text-xs">{entry.reason}</p>
            <div className="flex items-center gap-6 text-xs font-['JetBrains_Mono']">
              <div>
                <span className="text-[#6b6b80]/60">usage </span>
                <span className="text-[#4ade80]">{entry.usage}%</span>
              </div>
              <div>
                <span className="text-[#6b6b80]/60">duration </span>
                <span className="text-[#c4a1ff]">{entry.duration}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}