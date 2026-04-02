import type { ForecastViewModel } from '../../types/promotion';

interface PredictionPanelProps {
  forecast: ForecastViewModel | null;
}

const CountdownUnit = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="font-['JetBrains_Mono'] text-3xl md:text-4xl text-[#e2e2e8] tabular-nums">
      {value}
    </span>
    <span className="text-[#6b6b80] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest mt-1">
      {label}
    </span>
  </div>
);

function countdownParts(countdown: string): { days: string; hours: string; minutes: string } {
  const days = countdown.match(/(\d+)d/)?.[1] ?? '00';
  const hours = countdown.match(/(\d+)h/)?.[1] ?? '00';
  const minutes = countdown.match(/(\d+)m/)?.[1] ?? '00';

  return {
    days: days.padStart(2, '0'),
    hours: hours.padStart(2, '0'),
    minutes: minutes.padStart(2, '0'),
  };
}

export function PredictionPanel({ forecast }: PredictionPanelProps) {
  if (!forecast) {
    return (
      <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-6 space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
            Next Optimal Window
          </span>
        </div>
        <p className="text-[#6b6b80]">Not enough official campaign history to build an estimate yet.</p>
      </div>
    );
  }

  const parts = countdownParts(forecast.countdown);
  const [dateLabel, timeLabel] = forecast.label.split('|').map((part) => part.trim());

  return (
    <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Next Optimal Window
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded">
            {forecast.kindLabel}
          </span>
          <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-[#c4a1ff] bg-[#c4a1ff]/10 px-2 py-0.5 rounded">
            {Math.round(forecast.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-4">
        <span className="font-['JetBrains_Mono'] text-2xl text-[#c4a1ff]">{dateLabel}</span>
        <span className="font-['JetBrains_Mono'] text-2xl text-[#e2e2e8]">{timeLabel ?? ''}</span>
      </div>

      <div className="bg-[#0a0a0f] rounded-md p-5 border border-white/[0.04]">
        <div className="flex items-center justify-center gap-6">
          <CountdownUnit value={parts.days} label="days" />
          <span className="text-[#c4a1ff]/40 font-['JetBrains_Mono'] text-2xl mb-4">:</span>
          <CountdownUnit value={parts.hours} label="hrs" />
          <span className="text-[#c4a1ff]/40 font-['JetBrains_Mono'] text-2xl mb-4">:</span>
          <CountdownUnit value={parts.minutes} label="min" />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[#6b6b80] text-sm border-l-2 border-[#c4a1ff]/30 pl-3">{forecast.reason}</p>
        <p className="text-[#6b6b80]/70 text-xs font-['JetBrains_Mono']">{forecast.basis}</p>
      </div>
    </div>
  );
}
