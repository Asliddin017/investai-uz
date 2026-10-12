import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { notFound, forbidden } from "./api";
import { agreementDisplayStatus } from "./labels";
import {
  canApprovePlan,
  canCompleteAgreement,
  canEditPlan,
  canManageAgreements,
  canMonitorAgreement,
  canRemindReport,
  canReportPlan,
  canViewPlan,
} from "./plans";

const userName = { select: { id: true, fullName: true, username: true, position: true } } as const;

export const planDetailInclude = {
  creator: userName,
  approvedBy: userName,
  department: { select: { id: true, name: true } },
  items: { orderBy: { order: "asc" } },
  versions: { orderBy: { version: "asc" }, include: { createdBy: userName } },
  approvals: { orderBy: { createdAt: "asc" }, include: { user: userName } },
  agreements: {
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { attachments: true, updates: true } } },
  },
  analyses: { orderBy: { createdAt: "desc" }, include: { createdBy: userName } },
  reminders: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, include: { requestedBy: userName } },
} satisfies Prisma.PlanInclude;

export type PlanWithDetail = Prisma.PlanGetPayload<{ include: typeof planDetailInclude }>;

export async function loadPlanForUser(user: CurrentUser, id: string) {
  const plan = await db.plan.findUnique({ where: { id }, include: planDetailInclude });
  if (!plan) throw notFound("Reja topilmadi");
  if (!canViewPlan(user, plan)) throw forbidden("Bu rejani ko'rishga ruxsat yo'q");
  return plan;
}

export function decimalToNumber(v: Prisma.Decimal | null) {
  return v === null ? null : Number(v);
}

export function serializePlan(user: CurrentUser, plan: PlanWithDetail) {
  return {
    ...plan,
    agreements: plan.agreements.map((a) => ({
      ...a,
      amount: decimalToNumber(a.amount),
      displayStatus: agreementDisplayStatus(a),
    })),
    can: {
      edit: canEditPlan(user, plan),
      submit: canEditPlan(user, plan),
      delete: canEditPlan(user, plan) && plan.status === "DRAFT",
      approve: canApprovePlan(user, plan),
      report: canReportPlan(user, plan),
      remind: canRemindReport(user, plan),
      manageAgreements: canManageAgreements(user, plan),
      monitor: canMonitorAgreement(user, plan),
      completeAgreements: canCompleteAgreement(user, plan),
      analyze:
        user.permissions.has("ai:analyze") &&
        (plan.status === "REPORTED" || plan.status === "COMPLETED") &&
        canViewPlan(user, plan),
    },
  };
}
