import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  currency,
  delta,
  hint,
}: {
  label: string;
  value: number | string;
  currency?: boolean;
  delta?: number | null;
  hint?: string;
}) {
  const display = typeof value === "number" && currency ? formatCurrency(value) : value;
  const up = (delta ?? 0) >= 0;

  return (
    <Card className="p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-tight text-ink">{display}</div>
      <div className="mt-2 flex items-center gap-2 text-[13px]">
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              up ? "text-accent-green" : "text-accent-red",
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-mute">{hint}</span>}
      </div>
    </Card>
  );
}
