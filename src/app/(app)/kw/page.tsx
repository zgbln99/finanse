import { getKwOverview } from "@/lib/kw";
import { getActiveYear } from "@/lib/year";
import { getCurrentUser } from "@/lib/auth-server";
import { canWrite } from "@/lib/auth";
import { KwClient } from "@/components/kw/kw-client";

export const dynamic = "force-dynamic";

export default async function KwPage() {
  const [year, user] = await Promise.all([getActiveYear(), getCurrentUser()]);
  const overview = await getKwOverview(year);
  return <KwClient overview={overview} canWrite={canWrite(user?.role)} />;
}
