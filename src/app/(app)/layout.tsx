import { AppShell } from "@/components/layout/app-shell";
import { getActiveYear, getAvailableYears } from "@/lib/year";
import { getCurrentUser } from "@/lib/auth-server";
import { canWrite } from "@/lib/auth";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const [year, years, user] = await Promise.all([
    getActiveYear(),
    getAvailableYears(),
    getCurrentUser(),
  ]);
  return (
    <AppShell
      year={year}
      years={years}
      user={user ? { email: user.email, role: user.role } : null}
      canWrite={canWrite(user?.role)}
    >
      {children}
    </AppShell>
  );
}
