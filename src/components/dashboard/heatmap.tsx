import { formatCurrency } from "@/lib/utils";

// Tag (rows) x month (cols) intensity heatmap. Uses primary-orange opacity ramp.
export function CostHeatmap({
  months,
  rows,
}: {
  months: string[];
  rows: { tag: string; cells: number[] }[];
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.cells));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-[12px]">
        <thead>
          <tr>
            <th className="w-28" />
            {months.map((m) => (
              <th key={m} className="px-1 pb-1 text-center font-semibold text-mute">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tag}>
              <td className="pr-2 text-right font-medium text-body">{row.tag}</td>
              {row.cells.map((value, i) => {
                const intensity = value / max;
                return (
                  <td key={i} className="p-0">
                    <div
                      title={`${row.tag} · ${months[i]}: ${formatCurrency(value)}`}
                      className="flex h-9 items-center justify-center rounded-sm text-[11px] font-medium"
                      style={{
                        backgroundColor: `rgba(247,165,1,${0.08 + intensity * 0.85})`,
                        color: intensity > 0.55 ? "#23251d" : "#6c6e63",
                      }}
                    >
                      {value > 0 ? Math.round(value / 1000) + "k" : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
