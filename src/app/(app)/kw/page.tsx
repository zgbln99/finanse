import { getKwOverview } from "@/lib/kw";
import { getActiveYear } from "@/lib/year";
import { KwClient } from "@/components/kw/kw-client";

export const dynamic = "force-dynamic";

export default async function KwPage() {
  const year = await getActiveYear();
  const overview = await getKwOverview(year);
  return <KwClient overview={overview} />;
}
