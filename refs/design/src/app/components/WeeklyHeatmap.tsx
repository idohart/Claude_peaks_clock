import { generateUsageData } from './UsageData';
import { useState, useMemo } from 'react';

export function WeeklyHeatmap() {
  const weeklyData = useMemo(() => generateUsageData(), []);
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; usage: number } | null>(null);

  const getColor = (usage: number) => {
    const t = Math.min(usage / 100, 1);
    // Bright green -> Purple -> Red (colorblind-friendly)
    let r, g, b;
    if (t < 0.5) {
      const s = t / 0.5;
      r = Math.round(20 + s * 110);
      g = Math.round(240 - s * 180);
      b = Math.round(50 + s * 160);
    } else {
      const s = (t - 0.5) / 0.5;
      r = Math.round(130 + s * 120);
      g = Math.round(60 - s * 10);
      b = Math.round(210 - s * 160);
    }
    return `rgba(${r},${g},${b},${0.75 + t * 0.25})`;
  };

  const getColorHex = getColor;

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Weekly Heatmap
        </span>
        {hoveredCell && (
          <span className="text-xs font-['JetBrains_Mono'] text-[#e2e2e8]">
            {hoveredCell.day.slice(0, 3)} {hoveredCell.hour.toString().padStart(2, '0')}:00
            <span className="ml-2" style={{ color: getColorHex(hoveredCell.usage) }}>
              {hoveredCell.usage}%
            </span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex mb-3">
            <div className="w-12 md:w-16 flex-shrink-0" />
            <div className="flex-1 flex">
              {Array.from({ length: 24 }, (_, i) => i).filter(h => h % 3 === 0).map(hour => (
                <div
                  key={hour}
                  className="text-[10px] font-['JetBrains_Mono'] text-[#6b6b80] text-center"
                  style={{ width: `${(3 / 24) * 100}%` }}
                >
                  {hour.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {weeklyData.map((dayData) => (
            <div key={dayData.day} className="flex items-center mb-1">
              <div className="w-12 md:w-16 text-xs font-['JetBrains_Mono'] text-[#6b6b80] flex-shrink-0">
                {dayData.day.slice(0, 3)}
              </div>
              <div className="flex-1 flex gap-[2px]">
                {dayData.data.map((hourData) => (
                  <div
                    key={hourData.hour}
                    className="flex-1 h-7 md:h-9 rounded-[2px] transition-all duration-150 hover:scale-y-110 hover:brightness-125 cursor-crosshair"
                    style={{ backgroundColor: getColor(hourData.usage) }}
                    onMouseEnter={() => setHoveredCell({ day: dayData.day, hour: hourData.hour, usage: hourData.usage })}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center justify-center gap-4 text-[10px] font-['JetBrains_Mono'] text-[#6b6b80]">
        <span>0%</span>
        <div
          className="w-24 h-3 rounded-[2px]"
          style={{ background: `linear-gradient(to right, ${getColor(0)}, ${getColor(25)}, ${getColor(50)}, ${getColor(75)}, ${getColor(100)})` }}
        />
        <span>100%</span>
      </div>
    </div>
  );
}