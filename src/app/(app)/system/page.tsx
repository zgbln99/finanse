import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { SystemClient } from "@/components/admin/system-client";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/");
  return <SystemClient />;
}
