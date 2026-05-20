"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

export function YearSwitcher({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  function change(value: string) {
    document.cookie = `cockpit_year=${value}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-card px-2 py-1 text-[13px] text-ink">
      <Calendar className="size-3.5 text-mute" />
      <select
        value={year}
        onChange={(e) => change(e.target.value)}
        className="bg-transparent font-semibold focus:outline-none"
        aria-label="Geschäftsjahr"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
            {y < currentYear ? " · Archiv" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
