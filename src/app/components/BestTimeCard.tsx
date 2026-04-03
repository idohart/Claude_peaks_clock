import { useState } from 'react';

import type { HourlyScoreLocal } from '../../types/promotion';

interface BestTimeCardProps {
  scores: HourlyScoreLocal[];
}

function getColor(peakProb: number, official: string | null): string {
  if (official === 'off_peak') return '#4ade80';
  if (official === 'peak') return '#e05252';
  if (peakProb >= 0.7) return '#e05252';
  if (peakProb >= 0.4) return '#f59e0b';
  return '#4ade80';
}

export function BestTimeCard({ scores }: BestTimeCardProps) {
  const [hovered, setHovered] = useState<HourlyScoreLocal | null>(null);

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">
          Next 24h
        </span>
        {hovered ? (
          <span className="text-xs font-['JetBrains_Mono']" style={{ color: getColor(hovered.peakProbability, hovered.officialPhase) }}>
            {hovered.label} — {Math.round((1 - hovered.peakProbability) * 100)}% available
          </span>
        ) : (
          <div className="flex items-center gap-3 text-[10px] font-['JetBrains_Mono'] text-[#8b8ba0]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#4ade80]" />Go</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#f59e0b]" />Busy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#e05252]" />Peak</span>
          </div>
        )}
      </div>

      <div className="flex gap-[2px]">
        {scores.map((score) => (
          <div
            className={`flex-1 h-8 rounded-[2px] transition-colors duration-100 cursor-crosshair hover:brightness-125 ${score.isCurrent ? 'ring-1 ring-[#c4a1ff]' : ''}`}
            key={score.label}
            onMouseEnter={() => setHovered(score)}
            onMouseLeave={() => setHovered(null)}
            style={{ backgroundColor: getColor(score.peakProbability, score.officialPhase), opacity: score.isCurrent ? 1 : 0.7 }}
          />
        ))}
      </div>

      <div className="flex mt-1.5">
        {scores.filter((_, i) => i % 6 === 0).map((s) => (
          <div className="text-[9px] font-['JetBrains_Mono'] text-[#8b8ba0]/60" key={s.label} style={{ width: `${(6 / scores.length) * 100}%` }}>
            {s.label.slice(0, 2)}
          </div>
        ))}
      </div>
    </div>
  );
}
