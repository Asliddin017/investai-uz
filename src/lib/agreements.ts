import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { forbidden, notFound } from "./api";
import { agreementDisplayStatus } from "./labels";
import { canCompleteAgreement, canManageAgreements, canMonitorAgreement, canViewPlan } from "./plans";
import { decimalToNumber } from "./serialize";

const userName = { select: { id: true, fullName: true, username: true, position: true } } as const;

export const agreementDetailInclude = {
  plan: {
    select: {
      id: true,
      title: true,
      country: true,
      status: true,
      creatorId: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  },
  planItem: { select: { id: true, order: true, title: true } },
  createdBy: userName,
  attachments: { orderBy: { createdAt: "asc" }, include: { uploadedBy: userName } },
  updates: { orderBy: { createdAt: "desc" }, include: { createdBy: userName } },
} satisfies Prisma.AgreementInclude;

export type AgreementWithDetail = Prisma.AgreementGetPayload<{ include: typeof agreementDetailInclude }>;

export async function loadAgreementForUser(user: CurrentUser, id: string) {
  const agreement = await db.agreement.findUnique({ where: { id }, include: agreementDetailInclude });
  if (!agreement) throw notFound("Kelishuv topilmadi");
  if (!canViewPlan(user, agreement.plan)) throw forbidden("Bu kelishuvni ko'rishga ruxsat yo'q");
  return agreement;
}

export function serializeAgreement(user: CurrentUser, a: AgreementWithDetail) {
  const active = a.status === "ACTIVE";
  return {
    ...a,
    amount: decimalToNumber(a.amount),
    displayStatus: agreementDisplayStatus(a),
    attachments: a.attachments.map(({ url: _url, ...rest }) => rest),
    can: {
      edit: active && canManageAgreements(user, a.plan),
      attach: active && canManageAgreements(user, a.plan),
      monitor: active && canMonitorAgreement(user, a.plan),
      complete: active && canCompleteAgreement(user, a.plan),
    },
  };
}
