import type { ClockStatus } from '../../types/promotion';

interface ClockDisplayProps {
  currentTime: Date;
  status: ClockStatus;
  sourceLabel: string;
  timezone: string;
}

export function ClockDisplay({ currentTime, status, sourceLabel, timezone }: ClockDisplayProps) {
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');

  const officialColor =
    status.officialTone === 'peak'
      ? '#e05252'
      : status.officialTone === 'off_peak'
        ? '#4ade80'
        : '#6b6b80';
  const patternColor =
    status.patternTone === 'peak'
      ? '#e05252'
      : status.patternTone === 'moderate'
        ? '#c4a1ff'
        : '#4ade80';

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
        <p className="text-[#e2e2e8]/70 text-sm">
          {currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="text-[#6b6b80] text-xs font-['JetBrains_Mono']">{timezone}</p>

        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
          <div className="flex flex-col items-start gap-2">
            <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
              Official Status
            </span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 mt-1">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: officialColor }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: officialColor }}
                />
              </span>
              <div>
                <p className="text-xs font-['JetBrains_Mono']" style={{ color: officialColor }}>
                  {status.officialLabel}
                </p>
                <p className="text-[11px] text-[#6b6b80]">{status.officialDetail}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2">
            <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
              Historical Pattern
            </span>
            <div>
              <p className="text-xs font-['JetBrains_Mono']" style={{ color: patternColor }}>
                {status.patternLabel} ({status.patternUsage}%)
              </p>
              <p className="text-[11px] text-[#6b6b80]">Used for inference when no official window is live</p>
            </div>
          </div>
        </div>

        <p className="text-[#6b6b80]/60 text-[11px] leading-relaxed pt-3">{sourceLabel}</p>
      </div>
    </div>
  );
}
