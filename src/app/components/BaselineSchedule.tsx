import { useState } from 'react';

import type { BaselineDay } from '../../types/promotion';
import { PERMANENT_WEEKDAY_PEAK_BASELINE } from '../../types/promotion';

interface BaselineScheduleProps {
  data: BaselineDay[];
  timezone: string;
}

export function BaselineSchedule({ data, timezone }: BaselineScheduleProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; isPeak: boolean } | null>(null);

  const nowHour = new Date().getHours();
  const nowDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Weekly Baseline Schedule
        </span>
        {hoveredCell ? (
          <span className="text-xs font-['JetBrains_Mono'] text-[#e2e2e8]">
            {hoveredCell.day} {hoveredCell.hour.toString().padStart(2, '0')}:00 PT —{' '}
            <span style={{ color: hoveredCell.isPeak ? '#e05252' : '#4ade80' }}>
              {hoveredCell.isPeak ? 'Peak' : 'Off-Peak'}
            </span>
          </span>
        ) : null}
      </div>
      <p className="text-[#6b6b80]/60 text-xs mb-5">
        Anthropic&apos;s permanent baseline: weekday {PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayStartHour} AM - {PERMANENT_WEEKDAY_PEAK_BASELINE.weekdayEndHour} AM PT is peak.
        All other hours and weekends are off-peak. Times shown in PT ({PERMANENT_WEEKDAY_PEAK_BASELINE.zone}).
      </p>

      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          <div className="flex mb-3">
            <div className="w-12 md:w-14 flex-shrink-0" />
            <div className="flex-1 flex">
              {Array.from({ length: 24 }, (_, i) => i)
                .filter((h) => h % 3 === 0)
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

          {data.map((day) => {
            const isToday = day.dayLabel === nowDay;
            return (
              <div className="flex items-center mb-1" key={day.dayLabel}>
                <div className={`w-12 md:w-14 text-xs font-['JetBrains_Mono'] flex-shrink-0 ${isToday ? 'text-[#c4a1ff]' : 'text-[#6b6b80]'}`}>
                  {day.dayLabel}
                </div>
                <div className="flex-1 flex gap-[2px]">
                  {day.hours.map((h) => {
                    const isNow = isToday && h.hour === nowHour;
                    return (
                      <div
                        className={`flex-1 h-7 md:h-9 rounded-[2px] transition-all duration-150 hover:brightness-125 cursor-crosshair ${isNow ? 'ring-1 ring-[#c4a1ff]' : ''}`}
                        key={`${day.dayLabel}-${h.hour}`}
                        onMouseEnter={() => setHoveredCell({ day: day.dayLabel, hour: h.hour, isPeak: h.isPeak })}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          backgroundColor: h.isPeak
                            ? 'rgba(224, 82, 82, 0.55)'
                            : 'rgba(74, 222, 128, 0.25)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-5 text-[10px] font-['JetBrains_Mono'] text-[#6b6b80]">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: 'rgba(224, 82, 82, 0.55)' }} />
          Peak
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: 'rgba(74, 222, 128, 0.25)' }} />
          Off-Peak
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[2px] ring-1 ring-[#c4a1ff]" style={{ backgroundColor: 'rgba(74, 222, 128, 0.25)' }} />
          Current hour
        </span>
      </div>
      <p className="text-[#6b6b80]/50 text-[11px] font-['JetBrains_Mono'] mt-2">
        Your timezone: {timezone}
      </p>
    </div>
  );
}
