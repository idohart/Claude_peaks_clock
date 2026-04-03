import type {
  CampaignForecastViewModel,
  ForecastTransitionViewModel,
  ForecastViewModel,
} from '../../types/promotion';

interface PredictionPanelProps {
  forecast: ForecastViewModel | null;
}

function countdownParts(countdown: string): { days: string; hours: string; minutes: string } {
  return {
    days: (countdown.match(/(\d+)d/)?.[1] ?? '00').padStart(2, '0'),
    hours: (countdown.match(/(\d+)h/)?.[1] ?? '00').padStart(2, '0'),
    minutes: (countdown.match(/(\d+)m/)?.[1] ?? '00').padStart(2, '0'),
  };
}

function MiniCard({ title, forecast }: { title: string; forecast: ForecastTransitionViewModel | CampaignForecastViewModel | null }) {
  if (!forecast) return null;
  const time = forecast.label.split('|').map((s) => s.trim());

  return (
    <div className="rounded-md bg-[#0a0a0f] border border-white/[0.04] p-3">
      <p className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">{title}</p>
      <div className="flex items-baseline justify-between mt-2">
        <span className="text-[#e2e2e8] font-['JetBrains_Mono'] text-sm">{time[0]}</span>
        <span className="text-[#c4a1ff] font-['JetBrains_Mono'] text-sm">{time[1] ?? ''}</span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[#8b8ba0]/60 text-[10px] font-['JetBrains_Mono']">{forecast.kindLabel}</span>
        <span className="text-[10px] font-['JetBrains_Mono'] text-[#c4a1ff]">{Math.round(forecast.confidence * 100)}%</span>
      </div>
    </div>
  );
}

export function PredictionPanel({ forecast }: PredictionPanelProps) {
  if (!forecast?.nextOffPeak) {
    return (
      <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-5 flex items-center">
        <p className="text-[#8b8ba0] text-sm font-['JetBrains_Mono']">No forecast data yet.</p>
      </div>
    );
  }

  const primary = forecast.nextOffPeak;
  const parts = countdownParts(primary.countdown);
  const time = primary.label.split('|').map((s) => s.trim());

  return (
    <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest">
          Next Off-Peak
        </span>
        <span className="text-[10px] font-['JetBrains_Mono'] text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded">
          {primary.kindLabel}
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="font-['JetBrains_Mono'] text-xl text-[#c4a1ff]">{time[0]}</span>
        <span className="font-['JetBrains_Mono'] text-xl text-[#e2e2e8]">{time[1] ?? ''}</span>
      </div>

      <div className="bg-[#0a0a0f] rounded-md p-4 border border-white/[0.04] flex items-center gap-5">
        <span className="font-['JetBrains_Mono'] text-2xl md:text-3xl text-[#e2e2e8] tabular-nums">{parts.days}</span>
        <span className="text-[#c4a1ff]/30 text-xl">:</span>
        <span className="font-['JetBrains_Mono'] text-2xl md:text-3xl text-[#e2e2e8] tabular-nums">{parts.hours}</span>
        <span className="text-[#c4a1ff]/30 text-xl">:</span>
        <span className="font-['JetBrains_Mono'] text-2xl md:text-3xl text-[#e2e2e8] tabular-nums">{parts.minutes}</span>
        <span className="text-[#8b8ba0] text-[10px] font-['JetBrains_Mono'] ml-auto">{Math.round(primary.confidence * 100)}% conf</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniCard forecast={forecast.nextPeak} title="Next Peak" />
        <MiniCard forecast={forecast.campaign} title="Next Campaign" />
      </div>
    </div>
  );
}
