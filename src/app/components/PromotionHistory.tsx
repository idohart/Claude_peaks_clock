import type { CampaignSummary } from '../../types/promotion';

interface PromotionHistoryProps {
  campaigns: CampaignSummary[];
}

export function PromotionHistory({ campaigns }: PromotionHistoryProps) {
  if (campaigns.length === 0) return null;

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-5">
      <span className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">
        Campaigns
      </span>
      <div className="flex flex-col gap-2 mt-3">
        {campaigns.map((c) => (
          <div
            className={`rounded-md bg-[#0a0a0f] border px-4 py-3 flex items-center justify-between gap-4 ${
              c.isActive ? 'border-[#4ade80]/30' : 'border-white/[0.06]'
            }`}
            key={c.id}
          >
            <div className="flex items-center gap-3">
              <span className="text-[#e2e2e8] text-sm font-['JetBrains_Mono']">{c.title}</span>
              {c.isActive ? (
                <span className="text-[9px] font-['JetBrains_Mono'] uppercase text-[#4ade80] bg-[#4ade80]/10 px-1.5 py-0.5 rounded">Live</span>
              ) : null}
            </div>
            <span className="text-[#8b8ba0] text-xs font-['JetBrains_Mono'] shrink-0">{c.dateRange}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
