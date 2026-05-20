import { getKwOverview } from "@/lib/kw";
import { isoWeekYear } from "@/lib/utils";
import { KwClient } from "@/components/kw/kw-client";

export const dynamic = "force-dynamic";

export default async function KwPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const selectedYear = year ? Number(year) : isoWeekYear(new Date());
  const overview = await getKwOverview(selectedYear);

  return (
    <KwClient
      overview={overview}
      gf1Name={process.env.GF1_NAME ?? "Geschäftsführung 1"}
      gf2Name={process.env.GF2_NAME ?? "Geschäftsführung 2"}
    />
  );
}
