import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, withUser } from "@/lib/api";
import { AUDIT_ACTIONS } from "@/lib/audit";

const PAGE_SIZE = 50;

export const GET = withUser(async ({ req, user }) => {
  requirePermission(user, "admin:audit");
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const q = url.searchParams.get("q")?.trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (action && action in AUDIT_ACTIONS) where.action = action;
  if (q) {
    where.OR = [
      { actorLabel: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.createdAt = {
      ...(from && !Number.isNaN(Date.parse(from)) ? { gte: new Date(from) } : {}),
      // inclusive end date: everything before the next midnight
      ...(to && !Number.isNaN(Date.parse(to)) ? { lt: new Date(Date.parse(to) + 24 * 60 * 60 * 1000) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, actions: AUDIT_ACTIONS };
});
