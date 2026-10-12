import type { Plan, PlanItem, Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";

type PlanAccess = Pick<Plan, "creatorId" | "departmentId" | "status">;

/** Prisma filter for the plans this user is allowed to see. */
export function planVisibilityWhere(user: CurrentUser): Prisma.PlanWhereInput {
  const p = user.permissions;
  if (p.has("plan:view_all")) return {};
  const or: Prisma.PlanWhereInput[] = [];
  if (p.has("plan:view_own")) or.push({ creatorId: user.id });
  if (p.has("plan:view_department") && user.departmentId) or.push({ departmentId: user.departmentId });
  if (p.has("plan:approve")) or.push({ status: { not: "DRAFT" } });
  if (or.length === 0) return { id: "__none__" };
  return { OR: or };
}

export function canViewPlan(user: CurrentUser, plan: PlanAccess) {
  const p = user.permissions;
  if (p.has("plan:view_all")) return true;
  if (p.has("plan:view_own") && plan.creatorId === user.id) return true;
  if (p.has("plan:view_department") && user.departmentId && plan.departmentId === user.departmentId) return true;
  if (p.has("plan:approve") && plan.status !== "DRAFT") return true;
  return false;
}

/** Only the author edits, and only before approval: a draft, or a plan returned after rejection. */
export function canEditPlan(user: CurrentUser, plan: Pick<Plan, "creatorId" | "status">) {
  return (
    user.permissions.has("plan:create") &&
    plan.creatorId === user.id &&
    (plan.status === "DRAFT" || plan.status === "REJECTED")
  );
}

/** The approver never decides on a plan they wrote themselves. */
export function canApprovePlan(user: CurrentUser, plan: Pick<Plan, "creatorId" | "status">) {
  return user.permissions.has("plan:approve") && plan.status === "PENDING" && plan.creatorId !== user.id;
}

function isAuthorOrColleague(user: CurrentUser, plan: PlanAccess) {
  return plan.creatorId === user.id || (!!user.departmentId && plan.departmentId === user.departmentId);
}

/** Trip results are entered by the author or a colleague from the same organization. */
export function canReportPlan(user: CurrentUser, plan: PlanAccess) {
  return plan.status === "APPROVED" && user.permissions.has("plan:report") && isAuthorOrColleague(user, plan);
}

/** Approver-side nudge: ask the author to close an approved trip's report. */
export function canRemindReport(user: CurrentUser, plan: PlanAccess) {
  return plan.status === "APPROVED" && user.permissions.has("plan:remind_report") && canViewPlan(user, plan);
}

export function canManageAgreements(user: CurrentUser, plan: PlanAccess) {
  return (
    (plan.status === "APPROVED" || plan.status === "REPORTED") &&
    user.permissions.has("agreement:manage") &&
    isAuthorOrColleague(user, plan)
  );
}

export function canMonitorAgreement(user: CurrentUser, plan: PlanAccess) {
  if (!user.permissions.has("agreement:monitor")) return false;
  if (user.permissions.has("plan:view_all") || user.permissions.has("plan:approve")) return true;
  return isAuthorOrColleague(user, plan);
}

export function canCompleteAgreement(user: CurrentUser, plan: PlanAccess) {
  return user.permissions.has("agreement:complete") && canViewPlan(user, plan);
}

export type PlanSnapshot = {
  title: string;
  goal: string;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string;
  items: { order: number; title: string; expectedResult: string; dueDate: string | null }[];
};

export function snapshotPlan(plan: Plan & { items: PlanItem[] }): PlanSnapshot {
  return {
    title: plan.title,
    goal: plan.goal,
    country: plan.country,
    city: plan.city,
    startDate: plan.startDate.toISOString(),
    endDate: plan.endDate.toISOString(),
    items: [...plan.items]
      .sort((a, b) => a.order - b.order)
      .map((i) => ({
        order: i.order,
        title: i.title,
        expectedResult: i.expectedResult,
        dueDate: i.dueDate?.toISOString() ?? null,
      })),
  };
}

/** A reported plan is finished once none of its agreements is still being monitored. */
export async function completePlanIfDone(planId: string) {
  const plan = await db.plan.findUnique({
    where: { id: planId },
    select: { status: true, _count: { select: { agreements: { where: { status: "ACTIVE" } } } } },
  });
  if (plan?.status === "REPORTED" && plan._count.agreements === 0) {
    await db.plan.update({ where: { id: planId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
}
