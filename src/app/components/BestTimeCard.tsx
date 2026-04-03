import { useState } from 'react';

import type { HourlyScoreLocal } from '../../types/promotion';

interface BestTimeCardProps {
  scores: HourlyScoreLocal[];
}

function getBarColor(peakProb: number, official: string | null): string {
  if (official === 'off_peak') return 'rgba(74, 222, 128, 0.8)';
  if (official === 'peak') return 'rgba(224, 82, 82, 0.8)';
  if (peakProb >= 0.7) return `rgba(224, 82, 82, ${0.4 + peakProb * 0.4})`;
  if (peakProb >= 0.4) return `rgba(245, 158, 11, ${0.4 + peakProb * 0.3})`;
  return `rgba(74, 222, 128, ${0.5 + (1 - peakProb) * 0.3})`;
}

function getLabel(peakProb: number, official: string | null): string {
  if (official === 'off_peak') return 'Off-Peak (Official)';
  if (official === 'peak') return 'Peak (Official)';
  if (peakProb >= 0.7) return 'High demand expected';
  if (peakProb >= 0.4) return 'Moderate demand';
  return 'Low demand expected';
}

export function BestTimeCard({ scores }: BestTimeCardProps) {
  const [hovered, setHovered] = useState<HourlyScoreLocal | null>(null);

  const bestHour = scores.reduce((best, s) =>
    (s.officialPhase === 'off_peak' || s.peakProbability < (best.officialPhase === 'off_peak' ? -1 : best.peakProbability))
      ? s : best,
    scores[0],
  );

  const bestColor = getBarColor(bestHour.peakProbability, bestHour.officialPhase);

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Next 24 Hours
        </span>
        {hovered ? (
          <span className="text-xs font-['JetBrains_Mono'] text-[#e2e2e8]">
            {hovered.label} — <span style={{ color: getBarColor(hovered.peakProbability, hovered.officialPhase) }}>
              {getLabel(hovered.peakProbability, hovered.officialPhase)}
            </span>
            {hovered.support > 0 && !hovered.officialPhase ? (
              <span className="text-[#6b6b80] ml-2">({Math.round(hovered.peakProbability * 100)}% peak prob)</span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs font-['JetBrains_Mono']">
            <span className="text-[#6b6b80]">Best window: </span>
            <span style={{ color: bestColor }}>{bestHour.label}</span>
          </span>
        )}
      </div>

      <div className="flex items-end gap-[3px] h-20">
        {scores.map((score) => {
          const height = 20 + (score.peakProbability * 80);
          const invHeight = 100 - height;
          return (
            <div
              className={`flex-1 rounded-t-[2px] transition-all duration-100 cursor-crosshair hover:brightness-125 ${score.isCurrent ? 'ring-1 ring-[#c4a1ff] ring-offset-1 ring-offset-[#111118]' : ''}`}
              key={score.label}
              onMouseEnter={() => setHovered(score)}
              onMouseLeave={() => setHovered(null)}
              style={{
                height: `${invHeight}%`,
                backgroundColor: getBarColor(score.peakProbability, score.officialPhase),
              }}
              title={`${score.label}: ${Math.round(score.peakProbability * 100)}% peak`}
            />
          );
        })}
      </div>

      <div className="flex mt-2">
        {scores.filter((_, i) => i % 3 === 0).map((score) => (
          <div
            className="text-[10px] font-['JetBrains_Mono'] text-[#6b6b80]"
            key={score.label}
            style={{ width: `${(3 / scores.length) * 100}%` }}
          >
            {score.label.slice(0, 2)}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[10px] font-['JetBrains_Mono'] text-[#6b6b80]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(74, 222, 128, 0.7)' }} />
          Low demand
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(245, 158, 11, 0.6)' }} />
          Moderate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(224, 82, 82, 0.7)' }} />
          High demand
        </span>
      </div>
    </div>
  );
}
