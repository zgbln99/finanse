"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const INK = "#23251d";
const PRIMARY = "#f7a501";
const PALETTE = ["#2c84e0", "#2c8c66", "#b17816", "#cd4239", "#1078a3", "#7c44a6", "#6c6e63", "#9b9c92"];

function compactEUR(v: number) {
  return new Intl.NumberFormat("de-DE", { notation: "compact", style: "currency", currency: "EUR" }).format(v);
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-hairline bg-surface-card px-3 py-2 text-[13px] shadow-sm">
      {label && <div className="mb-1 font-semibold text-ink">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-body">
          <span className="size-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}:</span>
          <span className="font-semibold text-ink">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function CostTrendChart({
  data,
  onMonthClick,
}: {
  data: { month: string; total: number; prev?: number }[];
  onMonthClick?: (monthIndex: number) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
        onClick={(e: any) => {
          if (onMonthClick && e && typeof e.activeTooltipIndex === "number") {
            onMonthClick(e.activeTooltipIndex);
          }
        }}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={compactEUR} tickLine={false} axisLine={false} width={64} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="prev"
          name="Vorjahr"
          stroke="#b6b7af"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Gesamtkosten"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#trendFill)"
          style={{ cursor: onMonthClick ? "pointer" : "default" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function VendorBarChart({ data }: { data: { name: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <XAxis type="number" tickFormatter={compactEUR} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#e5e7e0" }} />
        <Bar dataKey="total" name="Kosten" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KwBarChart({ data }: { data: { kw: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <XAxis dataKey="kw" tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={compactEUR} tickLine={false} axisLine={false} width={56} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#e5e7e0" }} />
        <Bar dataKey="total" name="Kosten" fill={INK} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TagPieChart({ data }: { data: { name: string; total: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
