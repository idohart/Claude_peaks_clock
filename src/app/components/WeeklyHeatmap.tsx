import { useState } from 'react';

import type { WeeklyHeatmapCell } from '../../types/promotion';

interface WeeklyHeatmapProps {
  data: WeeklyHeatmapCell[][];
}

export function WeeklyHeatmap({ data }: WeeklyHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<WeeklyHeatmapCell | null>(null);

  const getColor = (usage: number) => {
    const t = Math.min(usage / 100, 1);
    if (t < 0.5) {
      const s = t / 0.5;
      const r = Math.round(20 + s * 110);
      const g = Math.round(240 - s * 180);
      const b = Math.round(50 + s * 160);
      return `rgba(${r},${g},${b},${0.75 + t * 0.25})`;
    }

    const s = (t - 0.5) / 0.5;
    const r = Math.round(130 + s * 120);
    const g = Math.round(60 - s * 10);
    const b = Math.round(210 - s * 160);
    return `rgba(${r},${g},${b},${0.75 + t * 0.25})`;
  };

  const getDisplayColor = (usage: number, hasData: boolean) => {
    if (!hasData) {
      return 'rgba(107,107,128,0.18)';
    }

    return getColor(usage);
  };

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Last 7 Days
        </span>
        {hoveredCell ? (
          <span className="text-xs font-['JetBrains_Mono'] text-[#e2e2e8]">
            {hoveredCell.dayLabel} {hoveredCell.dateLabel} {hoveredCell.hour.toString().padStart(2, '0')}:00
            {hoveredCell.hasData ? (
              <span className="ml-2" style={{ color: getColor(hoveredCell.usage) }}>
                {hoveredCell.usage}%
              </span>
            ) : (
              <span className="ml-2 text-[#6b6b80]">No official data</span>
            )}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          <div className="flex mb-3">
            <div className="w-12 md:w-16 flex-shrink-0" />
            <div className="flex-1 flex">
              {Array.from({ length: 24 }, (_, index) => index)
                .filter((hour) => hour % 3 === 0)
                .map((hour) => (
                  <div
                    className="text-[10px] font-['JetBrains_Mono'] text-[#6b6b80] text-center"
                    key={hour}
                    style={{ width: `${(3 / 24) * 100}%` }}
                  >
                    {hour.toString().padStart(2, '0')}
                  </div>
                ))}
            </div>
          </div>

          {data.map((dayData, index) => (
            <div className="flex items-center mb-1" key={dayData[0]?.dayLabel ?? `day-${index}`}>
              <div className="w-20 md:w-24 text-xs font-['JetBrains_Mono'] text-[#6b6b80] flex-shrink-0">
                {dayData[0] ? `${dayData[0].dayLabel} ${dayData[0].dateLabel}` : ''}
              </div>
              <div className="flex-1 flex gap-[2px]">
                {dayData.map((hourData) => (
                  <div
                    className="flex-1 h-7 md:h-9 rounded-[2px] transition-all duration-150 hover:scale-y-110 hover:brightness-125 cursor-crosshair"
                    key={`${hourData.dayLabel}-${hourData.hour}`}
                    onMouseEnter={() => setHoveredCell(hourData)}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{ backgroundColor: getDisplayColor(hourData.usage, hourData.hasData) }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4 text-[10px] font-['JetBrains_Mono'] text-[#6b6b80]">
        <span>0%</span>
        <div
          className="w-24 h-3 rounded-[2px]"
          style={{
            background: `linear-gradient(to right, ${getColor(0)}, ${getColor(25)}, ${getColor(50)}, ${getColor(75)}, ${getColor(100)})`,
          }}
        />
        <span>100%</span>
      </div>
      <p className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] mt-3 text-center">
        Real official windows only, ordered from 6 days ago to today
      </p>
    </div>
  );
}
