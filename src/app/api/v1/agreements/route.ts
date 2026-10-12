import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, withUser } from "@/lib/api";
import { planVisibilityWhere } from "@/lib/plans";
import { agreementDisplayStatus } from "@/lib/labels";
import { decimalToNumber } from "@/lib/serialize";

export const GET = withUser(async ({ req, user }) => {
  requirePermission(user, "nav:agreements");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();

  const filters: Prisma.AgreementWhereInput[] = [{ plan: planVisibilityWhere(user) }];
  if (status === "OVERDUE") filters.push({ status: "ACTIVE", deadline: { lt: new Date() } });
  else if (status === "ACTIVE" || status === "COMPLETED" || status === "CANCELLED") filters.push({ status });
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { partner: { contains: q, mode: "insensitive" } },
        { documentNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const agreements = await db.agreement.findMany({
    where: { AND: filters },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    include: {
      plan: { select: { id: true, title: true, department: { select: { name: true } } } },
      planItem: { select: { order: true, title: true } },
      _count: { select: { attachments: true, updates: true } },
    },
  });

  return agreements.map((a) => ({
    ...a,
    amount: decimalToNumber(a.amount),
    displayStatus: agreementDisplayStatus(a),
  }));
});
