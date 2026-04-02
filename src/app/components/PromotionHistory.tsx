import type { PromotionHistoryEntry } from '../../types/promotion';

interface PromotionHistoryProps {
  history: PromotionHistoryEntry[];
}

export function PromotionHistory({ history }: PromotionHistoryProps) {
  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
            Promotion History
          </span>
          <p className="text-[#6b6b80]/60 text-xs mt-1">
            Published peak and off-peak windows from official Claude promotions
          </p>
        </div>
        <span className="text-[#6b6b80]/40 text-xs font-['JetBrains_Mono']">{history.length} records</span>
      </div>

      <div className="flex flex-col gap-3">
        {history.map((entry) => (
          <a
            className="rounded-md bg-[#0a0a0f] border border-white/[0.06] p-4 hover:border-[#c4a1ff]/20 transition-colors flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
            href={entry.sourceUrl}
            key={entry.id}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[#e2e2e8] text-sm font-['JetBrains_Mono']">
                  {entry.timeRange}
                </span>
                <div className="text-[#6b6b80] text-xs font-['JetBrains_Mono']">
                  {entry.day}, {entry.date}
                </div>
              </div>
              <span
                className={`text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider px-2 py-0.5 rounded ${
                  entry.phase === 'peak'
                    ? 'text-[#ff9a9a] bg-[#e05252]/10'
                    : 'text-[#7df2a6] bg-[#4ade80]/10'
                }`}
              >
                {entry.phaseLabel}
              </span>
            </div>
            <p className="text-[#6b6b80] text-xs">{entry.reason}</p>
            <div className="flex items-center gap-6 text-xs font-['JetBrains_Mono']">
              <div>
                <span className="text-[#6b6b80]/60">pattern </span>
                <span className={entry.phase === 'peak' ? 'text-[#e05252]' : 'text-[#4ade80]'}>
                  {entry.usage}%
                </span>
              </div>
              <div>
                <span className="text-[#6b6b80]/60">duration </span>
                <span className="text-[#c4a1ff]">{entry.duration}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
