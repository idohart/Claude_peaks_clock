import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { getCurrentDayData } from './UsageData';
import { useMemo } from 'react';

export function UsageChart() {
  const data = useMemo(() => getCurrentDayData(), []);
  const currentHour = new Date().getHours();

  const getBarColor = (usage: number) => {
    const t = Math.min(usage / 100, 1);
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
    return `rgb(${r},${g},${b})`;
  };

  const chartData = data.map(d => ({
    hour: `${d.hour.toString().padStart(2, '0')}`,
    usage: d.usage,
    isPeak: d.isPeak,
    isCurrent: d.hour === currentHour,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[#1a1a24] border border-white/10 rounded px-3 py-2 font-['JetBrains_Mono'] text-xs">
          <p className="text-[#e2e2e8]">{d.hour}:00</p>
          <p className="text-[#c4a1ff]">{d.usage}%</p>
          <p className="text-[#6b6b80]">{d.isPeak ? 'Peak' : 'Off-Peak'}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Today's Usage
        </span>
        <div className="flex items-center gap-5 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getBarColor(85) }} />
            <span className="text-[#6b6b80]">Peak</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getBarColor(15) }} />
            <span className="text-[#6b6b80]">Off-Peak</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: '#6b6b80', fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b6b80', fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine y={60} stroke="#c4a1ff" strokeDasharray="6 4" strokeOpacity={0.3} />
          <Bar dataKey="usage" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isCurrent ? '#c4a1ff' : getBarColor(entry.usage)}
                fillOpacity={entry.isCurrent ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] mt-3 text-center">
        Dashed line marks 60% peak threshold &middot; Highlighted bar is current hour
      </p>
    </div>
  );
}