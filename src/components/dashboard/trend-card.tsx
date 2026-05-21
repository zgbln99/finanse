"use client";

import { useRouter } from "next/navigation";
import { CostTrendChart } from "./charts";

export function TrendCard({
  data,
  year,
}: {
  data: { month: string; total: number; prev?: number }[];
  year: number;
}) {
  const router = useRouter();

  function drilldown(monthIndex: number) {
    const from = new Date(year, monthIndex, 1).toISOString().slice(0, 10);
    const to = new Date(year, monthIndex + 1, 0).toISOString().slice(0, 10);
    router.push(`/invoices?dateFrom=${from}&dateTo=${to}`);
  }

  return <CostTrendChart data={data} onMonthClick={drilldown} />;
}
