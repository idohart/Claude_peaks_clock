import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { UsageHourPoint } from '../../types/promotion';

interface UsageChartProps {
  data: UsageHourPoint[];
}

export function UsageChart({ data }: UsageChartProps) {
  const currentHour = new Date().getHours();

  const getBarColor = (usage: number) => {
    const t = Math.min(usage / 100, 1);
    if (t < 0.5) {
      const s = t / 0.5;
      const r = Math.round(20 + s * 110);
      const g = Math.round(240 - s * 180);
      const b = Math.round(50 + s * 160);
      return `rgb(${r},${g},${b})`;
    }

    const s = (t - 0.5) / 0.5;
    const r = Math.round(130 + s * 120);
    const g = Math.round(60 - s * 10);
    const b = Math.round(210 - s * 160);
    return `rgb(${r},${g},${b})`;
  };

  const getDisplayColor = (usage: number, hasData: boolean) => {
    if (!hasData) {
      return 'rgba(107,107,128,0.35)';
    }

    return getBarColor(usage);
  };

  return (
    <div className="rounded-lg bg-[#111118] border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] uppercase tracking-widest">
          Today&apos;s Official Timeline
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
      <ResponsiveContainer height={280} width="100%">
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            dataKey="label"
            interval={2}
            tick={{ fill: '#6b6b80', fontFamily: 'JetBrains Mono', fontSize: 11 }}
            tickFormatter={(value: string) => value.slice(0, 2)}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: '#6b6b80', fontFamily: 'JetBrains Mono', fontSize: 11 }}
            tickFormatter={(value: number) => `${value}%`}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-[#1a1a24] border border-white/10 rounded px-3 py-2 font-['JetBrains_Mono'] text-xs">
                  <p className="text-[#e2e2e8]">{payload[0].payload.label}</p>
                  {payload[0].payload.hasData ? (
                    <>
                      <p className="text-[#c4a1ff]">{payload[0].payload.usage}%</p>
                      <p className="text-[#6b6b80]">{payload[0].payload.isPeak ? 'Peak' : 'Off-Peak'}</p>
                    </>
                  ) : (
                    <p className="text-[#6b6b80]">No official data for this hour</p>
                  )}
                </div>
              ) : null
            }
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <ReferenceLine stroke="#c4a1ff" strokeDasharray="6 4" strokeOpacity={0.3} y={60} />
          <Bar dataKey="usage" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell
                fill={entry.hour === currentHour && entry.hasData ? '#c4a1ff' : getDisplayColor(entry.usage, entry.hasData)}
                fillOpacity={entry.hour === currentHour && entry.hasData ? 1 : 0.8}
                key={entry.label}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[#6b6b80] text-xs font-['JetBrains_Mono'] mt-3">
        Official published windows only | Dashed line marks 60% peak threshold | Highlighted bar is current hour when official data exists
      </p>
    </div>
  );
}
