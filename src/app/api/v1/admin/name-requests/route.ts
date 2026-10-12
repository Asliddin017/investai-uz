import type { RequestStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, withUser } from "@/lib/api";

const STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export const GET = withUser(async ({ req, user }) => {
  requirePermission(user, "admin:users");
  const status = new URL(req.url).searchParams.get("status");
  return db.nameChangeRequest.findMany({
    where: status && STATUSES.has(status) ? { status: status as RequestStatus } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, username: true, fullName: true, role: true, department: { select: { name: true } } } },
      reviewer: { select: { fullName: true, username: true } },
    },
  });
});
