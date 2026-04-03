import type { BestTimeRecommendation } from '../../types/promotion';

interface BestTimeCardProps {
  recommendations: BestTimeRecommendation[];
}

const qualityConfig = {
  great: { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)', label: 'Best', icon: '▲' },
  good: { color: '#c4a1ff', bg: 'rgba(196, 161, 255, 0.1)', label: 'Good', icon: '●' },
  fair: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'Busy', icon: '▼' },
} as const;

export function BestTimeCard({ recommendations }: BestTimeCardProps) {
  const best = recommendations.find((r) => r.quality === 'great') ?? recommendations[0];

  if (!best) {
    return null;
  }

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Best Time — Next 12 Hours
        </span>
      </div>

      {best.quality === 'great' ? (
        <div className="rounded-md bg-[#4ade80]/5 border border-[#4ade80]/20 p-4 mb-5">
          <p className="text-[#4ade80] font-['JetBrains_Mono'] text-lg font-medium">
            {best.label}
          </p>
          <p className="text-[#6b6b80] text-sm mt-1">{best.reason}</p>
        </div>
      ) : (
        <div className="rounded-md bg-[#f59e0b]/5 border border-[#f59e0b]/20 p-4 mb-5">
          <p className="text-[#f59e0b] font-['JetBrains_Mono'] text-lg font-medium">
            No great windows right now
          </p>
          <p className="text-[#6b6b80] text-sm mt-1">
            Best available: {best.label} — {best.reason}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {recommendations.map((rec) => {
          const config = qualityConfig[rec.quality];
          return (
            <div
              className="flex items-center gap-3 rounded-md px-3 py-2"
              key={rec.label}
              style={{ backgroundColor: config.bg }}
            >
              <span className="text-xs font-['JetBrains_Mono']" style={{ color: config.color }}>
                {config.icon}
              </span>
              <span className="text-sm font-['JetBrains_Mono'] text-[#e2e2e8] min-w-[120px]">
                {rec.label}
              </span>
              <span
                className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ color: config.color, backgroundColor: config.bg }}
              >
                {config.label}
              </span>
              <span className="text-[#6b6b80] text-xs ml-auto hidden sm:block">{rec.reason}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
