import { useState, useEffect } from 'react';
import { getCurrentDayData } from './UsageData';
import { useMemo } from 'react';

export function ClockDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const dayData = useMemo(() => getCurrentDayData(), []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const currentHour = currentTime.getHours();
  const currentUsage = dayData[currentHour]?.usage ?? 0;
  const isPeak = currentUsage > 60;
  const statusLabel = isPeak ? 'Peak' : currentUsage > 35 ? 'Moderate' : 'Off-Peak';
  const statusColor = isPeak ? '#e05252' : currentUsage > 35 ? '#c4a1ff' : '#4ade80';

  return (
    <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-6 flex flex-col justify-between">
      <div>
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Local Time
        </span>
      </div>
      <div className="py-6">
        <div className="font-['JetBrains_Mono'] text-5xl md:text-6xl text-[#e2e2e8] tracking-tight tabular-nums">
          <span>{hours}</span>
          <span className="text-[#c4a1ff] animate-pulse">:</span>
          <span>{minutes}</span>
          <span className="text-[#c4a1ff] animate-pulse">:</span>
          <span className="text-[#6b6b80]">{seconds}</span>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[#e2e2e8]/70 text-sm">{formatDate(currentTime)}</p>
        <p className="text-[#6b6b80] text-xs font-['JetBrains_Mono']">{timezone}</p>
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">Current Status</span>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: statusColor }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: statusColor }} />
            </span>
            <span className="text-xs font-['JetBrains_Mono']" style={{ color: statusColor }}>
              {statusLabel} ({currentUsage}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}