import { getActiveYear } from "@/lib/year";
import { VendorsClient } from "@/components/vendors/vendors-client";

export const dynamic = "force-dynamic";

export default async function LieferantenPage() {
  const year = await getActiveYear();
  return <VendorsClient year={year} />;
}
