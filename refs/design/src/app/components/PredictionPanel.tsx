import { useState, useEffect } from 'react';
import { predictNextPromotion } from './UsageData';

export function PredictionPanel() {
  const [prediction, setPrediction] = useState(predictNextPromotion());
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const predictionTimer = setInterval(() => setPrediction(predictNextPromotion()), 60000);

    const countdownTimer = setInterval(() => {
      const now = new Date();
      const targetDate = new Date();

      const daysToAdd = getDaysUntil(prediction.day);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      targetDate.setHours(prediction.hour, 0, 0, 0);

      if (targetDate < now) targetDate.setDate(targetDate.getDate() + 7);

      const diff = targetDate.getTime() - now.getTime();
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => {
      clearInterval(predictionTimer);
      clearInterval(countdownTimer);
    };
  }, [prediction.day, prediction.hour]);

  const getDaysUntil = (targetDay: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    const target = days.indexOf(targetDay);
    let diff = target - today;
    if (diff < 0) diff += 7;
    return diff;
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  };

  const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <span className="font-['JetBrains_Mono'] text-3xl md:text-4xl text-[#e2e2e8] tabular-nums">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[#6b6b80] text-[10px] font-['JetBrains_Mono'] uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );

  return (
    <div className="h-full rounded-lg bg-[#111118] border border-white/[0.06] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Next Optimal Window
        </span>
        <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded">
          Off-Peak
        </span>
      </div>

      {/* Target */}
      <div className="flex items-baseline gap-4">
        <span className="font-['JetBrains_Mono'] text-2xl text-[#c4a1ff]">
          {prediction.day.slice(0, 3)}
        </span>
        <span className="font-['JetBrains_Mono'] text-2xl text-[#e2e2e8]">
          {formatHour(prediction.hour)}
        </span>
      </div>

      {/* Countdown */}
      <div className="bg-[#0a0a0f] rounded-md p-5 border border-white/[0.04]">
        <div className="flex items-center justify-center gap-6">
          <CountdownUnit value={countdown.days} label="days" />
          <span className="text-[#c4a1ff]/40 font-['JetBrains_Mono'] text-2xl mb-4">:</span>
          <CountdownUnit value={countdown.hours} label="hrs" />
          <span className="text-[#c4a1ff]/40 font-['JetBrains_Mono'] text-2xl mb-4">:</span>
          <CountdownUnit value={countdown.minutes} label="min" />
          <span className="text-[#c4a1ff]/40 font-['JetBrains_Mono'] text-2xl mb-4">:</span>
          <CountdownUnit value={countdown.seconds} label="sec" />
        </div>
      </div>

      {/* Reason */}
      <p className="text-[#6b6b80] text-sm border-l-2 border-[#c4a1ff]/30 pl-3">
        {prediction.reason}
      </p>
    </div>
  );
}
