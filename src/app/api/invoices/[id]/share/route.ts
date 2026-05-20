import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireWriter } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/** POST — create (or return existing) public share token for an invoice. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const actor = auth.user.email;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  let token = doc.shareToken;
  if (!token) {
    token = randomBytes(18).toString("base64url");
    await prisma.document.update({ where: { id }, data: { shareToken: token } });
    await logAudit({ documentId: id, action: "status_changed", field: "shareToken", newValue: "öffentlicher Link erstellt", actor });
  }
  return NextResponse.json({ token, path: `/share/${token}` });
}

/** DELETE — revoke the public link. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const actor = auth.user.email;
  await prisma.document.update({ where: { id }, data: { shareToken: null } });
  await logAudit({ documentId: id, action: "status_changed", field: "shareToken", newValue: "öffentlicher Link widerrufen", actor });
  return NextResponse.json({ ok: true });
}
