import { AppShell } from "@/components/layout/app-shell";
import { getActiveYear, getAvailableYears } from "@/lib/year";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const [year, years] = await Promise.all([getActiveYear(), getAvailableYears()]);
  return (
    <AppShell year={year} years={years}>
      {children}
    </AppShell>
  );
}
