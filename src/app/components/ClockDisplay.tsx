import type { ClockStatus } from '../../types/promotion';

interface ClockDisplayProps {
  currentTime: Date;
  status: ClockStatus;
  sourceLabel: string;
  timezone: string;
}

export function ClockDisplay({ currentTime, status, timezone }: ClockDisplayProps) {
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

  const phaseColor = status.phaseTone === 'peak' ? '#e05252' : '#4ade80';
  const platformColor =
    status.platformTone === 'critical' ? '#e05252'
      : status.platformTone === 'warning' ? '#f59e0b'
      : '#4ade80';

  return (
    <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-6 flex flex-col justify-between">
      <div className="flex items-baseline justify-between">
        <span className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">
          {timezone}
        </span>
        <span className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono']">
          {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="py-5">
        <div className="font-['JetBrains_Mono'] text-5xl md:text-6xl text-[#e2e2e8] tracking-tight tabular-nums">
          {hours}<span className="text-[#c4a1ff] motion-safe:animate-pulse">:</span>{minutes}<span className="text-[#c4a1ff] motion-safe:animate-pulse">:</span><span className="text-[#8b8ba0]">{seconds}</span>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: phaseColor }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: phaseColor }} />
          </span>
          <span className="text-sm font-['JetBrains_Mono'] font-medium" style={{ color: phaseColor }}>
            {status.phaseLabel}
          </span>
          <span className="text-[#8b8ba0] text-[11px] ml-auto">{status.phaseSource}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full h-2 w-2" style={{ backgroundColor: platformColor }} />
          <span className="text-xs font-['JetBrains_Mono']" style={{ color: platformColor }}>
            {status.platformLabel}
          </span>
          {status.platformDetail ? (
            <span className="text-[#8b8ba0] text-[11px] ml-auto truncate max-w-[200px]">{status.platformDetail}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
