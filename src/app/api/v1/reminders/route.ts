import { db } from "@/lib/db";
import { withUser } from "@/lib/api";

/** Open report requests on plans this user is expected to close (author or same-organization colleague). */
export const GET = withUser(async ({ user }) => {
  if (!user.permissions.has("plan:report")) return [];
  const reminders = await db.reportReminder.findMany({
    where: {
      resolvedAt: null,
      plan: {
        status: "APPROVED",
        OR: [{ creatorId: user.id }, ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { id: true, title: true, endDate: true } },
      requestedBy: { select: { fullName: true, username: true } },
    },
  });
  // One entry per plan: the latest request.
  const seen = new Set<string>();
  return reminders.filter((r) => !seen.has(r.planId) && seen.add(r.planId));
});
