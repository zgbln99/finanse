import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-server";
import { canWrite } from "@/lib/auth";
import { TagsClient } from "@/components/admin/tags-client";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const me = await getCurrentUser();
  if (!canWrite(me?.role)) redirect("/");

  const [tags, rules] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { documents: true } } } }),
    prisma.tagRule.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <TagsClient
      initialTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.documents }))}
      initialRules={rules.map((r) => ({ id: r.id, contains: r.contains, field: r.field, tagId: r.tagId }))}
    />
  );
}
