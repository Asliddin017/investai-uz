import type { AgreementStatus, DepartmentType, DocumentType, ItemResult, PlanStatus } from "@prisma/client";

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Qoralama",
  PENDING: "Tasdiqlashda",
  REJECTED: "Rad etilgan",
  APPROVED: "Tasdiqlangan",
  REPORTED: "Hisobot kiritilgan",
  COMPLETED: "Yakunlangan",
};

export const PLAN_STATUS_TONE: Record<PlanStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
  APPROVED: "bg-sky-100 text-sky-800",
  REPORTED: "bg-violet-100 text-violet-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
};

export const ITEM_RESULT_LABELS: Record<ItemResult, string> = {
  PENDING: "Natija kiritilmagan",
  ACHIEVED: "Erishildi",
  NOT_ACHIEVED: "Erishilmadi",
};

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus | "OVERDUE", string> = {
  ACTIVE: "Monitoringda",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
  OVERDUE: "Muddati o'tgan",
};

export const AGREEMENT_STATUS_TONE: Record<AgreementStatus | "OVERDUE", string> = {
  ACTIVE: "bg-sky-100 text-sky-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  OVERDUE: "bg-red-100 text-red-700",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SHARTNOMA: "Shartnoma",
  MEMORANDUM: "Memorandum",
  BITIM: "Bitim",
  BOSHQA: "Boshqa hujjat",
};

export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  APPARAT: "Viloyat apparati",
  INVESTITSIYA_BOLIMI: "Investitsiya bo'limi",
  BOSHQARMA: "Boshqarma",
  TUMAN_HOKIMLIGI: "Tuman hokimligi",
  SHAHAR_HOKIMLIGI: "Shahar hokimligi",
};

export function agreementDisplayStatus(a: { status: AgreementStatus; deadline: Date | string }) {
  if (a.status === "ACTIVE" && new Date(a.deadline).getTime() < Date.now()) return "OVERDUE" as const;
  return a.status;
}
