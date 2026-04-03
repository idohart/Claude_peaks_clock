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

  const phaseColor = status.phaseTone === 'peak' ? '#e05252' : '#4ade80';
  const platformColor =
    status.platformTone === 'critical'
      ? '#e05252'
      : status.platformTone === 'warning'
        ? '#f59e0b'
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
              Right Now
            </span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 mt-0.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: phaseColor }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: phaseColor }}
                />
              </span>
              <div>
                <p className="text-sm font-['JetBrains_Mono'] font-medium" style={{ color: phaseColor }}>
                  {status.phaseLabel}
                </p>
                <p className="text-[11px] text-[#6b6b80]">{status.phaseSource}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2">
            <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
              Platform Health
            </span>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: platformColor }}
              />
              <div>
                <p className="text-xs font-['JetBrains_Mono']" style={{ color: platformColor }}>
                  {status.platformLabel}
                </p>
                <p className="text-[11px] text-[#6b6b80]">{status.platformDetail}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[#6b6b80]/60 text-[11px] leading-relaxed pt-3">{sourceLabel}</p>
      </div>
    </div>
  );
}
