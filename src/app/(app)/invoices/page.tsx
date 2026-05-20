import { InvoicesClient } from "@/components/invoices/invoices-client";
import { getCurrentUser } from "@/lib/auth-server";
import { canWrite } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  return <InvoicesClient canWrite={canWrite(user?.role)} />;
}
