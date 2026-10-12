import type { PlanStatus } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { planVisibilityWhere } from "./plans";

export type InboxItem = {
  id: string;
  title: string;
  country: string;
  status: PlanStatus;
  creatorName: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  /** Something happened after this user last opened the trip. */
  unseen: boolean;
};

export type Inbox = { approvals: InboxItem[]; submitted: InboxItem[] };

/** An event is new when it happened after the user last opened the trip (or they never did). */
export function isUnseen(eventAt: Date | null, seenAt: Date | undefined) {
  if (!eventAt) return false;
  return !seenAt || seenAt < eventAt;
}

/**
 * Approvers see trips waiting for a decision; authors see the trips they sent and what
 * happened to them. A trip counts as new until the user opens it after the latest event.
 */
export async function loadInbox(user: CurrentUser): Promise<Inbox> {
  const p = user.permissions;
  const [pending, own] = await Promise.all([
    p.has("plan:approve")
      ? db.plan.findMany({
          where: { AND: [planVisibilityWhere(user), { status: "PENDING", creatorId: { not: user.id } }] },
          orderBy: { submittedAt: "desc" },
          include: { creator: { select: { fullName: true } } },
        })
      : [],
    p.has("plan:create")
      ? db.plan.findMany({
          where: { creatorId: user.id, status: { not: "DRAFT" } },
          orderBy: { submittedAt: "desc" },
          include: {
            creator: { select: { fullName: true } },
            approvals: { where: { action: "REJECT" }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        })
      : [],
  ]);

  const seenRows = await db.planSeen.findMany({
    where: { userId: user.id, planId: { in: [...pending, ...own].map((x) => x.id) } },
  });
  const seen = new Map(seenRows.map((r) => [r.planId, r.seenAt]));

  const item = (
    plan: (typeof pending)[number],
    decidedAt: Date | null,
    eventAt: Date | null,
  ): InboxItem => ({
    id: plan.id,
    title: plan.title,
    country: plan.country,
    status: plan.status,
    creatorName: plan.creator?.fullName ?? null,
    submittedAt: plan.submittedAt?.toISOString() ?? null,
    decidedAt: decidedAt?.toISOString() ?? null,
    rejectionReason: plan.rejectionReason,
    unseen: isUnseen(eventAt, seen.get(plan.id)),
  });

  return {
    approvals: pending.map((plan) => item(plan, null, plan.submittedAt)),
    submitted: own.map((plan) => {
      const decidedAt =
        plan.status === "REJECTED" ? (plan.approvals[0]?.createdAt ?? null) : plan.status === "PENDING" ? null : plan.approvedAt;
      // For the author only the decision is news; their own submission is not.
      const eventAt = plan.status === "APPROVED" || plan.status === "REJECTED" ? decidedAt : null;
      return item(plan, decidedAt, eventAt);
    }),
  };
}

export async function markPlanSeen(userId: string, planId: string) {
  await db.planSeen.upsert({
    where: { userId_planId: { userId, planId } },
    update: { seenAt: new Date() },
    create: { userId, planId },
  });
}
