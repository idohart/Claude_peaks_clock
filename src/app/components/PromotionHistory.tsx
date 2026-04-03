import type { CampaignSummary } from '../../types/promotion';

interface PromotionHistoryProps {
  campaigns: CampaignSummary[];
}

export function PromotionHistory({ campaigns }: PromotionHistoryProps) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
            Campaign History
          </span>
          <p className="text-[#6b6b80]/60 text-xs mt-1">
            Official Claude promotions discovered from the Help Center
          </p>
        </div>
        <span className="text-[#6b6b80]/40 text-xs font-['JetBrains_Mono']">
          {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {campaigns.map((campaign) => (
          <div
            className={`rounded-md bg-[#0a0a0f] border p-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 ${
              campaign.isActive
                ? 'border-[#4ade80]/30'
                : 'border-white/[0.06] hover:border-[#c4a1ff]/20'
            } transition-colors`}
            key={campaign.id}
          >
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[#e2e2e8] text-sm font-['JetBrains_Mono']">
                  {campaign.title}
                </span>
                <div className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] mt-0.5">
                  {campaign.dateRange}
                </div>
              </div>
              {campaign.isActive ? (
                <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider px-2 py-0.5 rounded text-[#4ade80] bg-[#4ade80]/10">
                  Active
                </span>
              ) : null}
            </div>
            <p className="text-[#6b6b80] text-xs">{campaign.scheduleSummary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
