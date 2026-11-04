import type { AgreementStatus, DepartmentType, DocumentType, ItemResult, PlanStatus } from "@prisma/client";

export const CLOSE_NEEDS_DOCUMENT = "Yakunlash uchun avval asos hujjatini biriktiring";

/** Share of the sum that has arrived; 100% only when all of it has. */
export function progressFromMoney(amount: number, absorbed: number) {
  if (amount <= 0) return 0;
  return Math.min(100, Math.floor((Math.round(absorbed * 100) * 100) / Math.round(amount * 100)));
}

export function remainingAmount(a: { amount: number; absorbedAmount: number }) {
  return (Math.round(a.amount * 100) - Math.round(a.absorbedAmount * 100)) / 100;
}

type MoneyRow = { status: AgreementStatus; amount?: number | null; absorbedAmount?: number; currency?: string | null };

/** Sums per currency; cancelled agreements and those without a sum are left out. */
export function moneyTotals(agreements: MoneyRow[]) {
  const totals = new Map<string, { currency: string; amount: number; absorbed: number; remaining: number }>();
  for (const a of agreements) {
    if (a.status === "CANCELLED" || a.amount === null || a.amount === undefined) continue;
    const currency = a.currency ?? "";
    const row = totals.get(currency) ?? { currency, amount: 0, absorbed: 0, remaining: 0 };
    row.amount += a.amount;
    row.absorbed += a.absorbedAmount ?? 0;
    row.remaining = remainingAmount({ amount: row.amount, absorbedAmount: row.absorbed });
    totals.set(currency, row);
  }
  return [...totals.values()];
}

/** A trip's overall figure: by money when comparable, otherwise the average; cancelled ones no longer count. */
export function overallAbsorption(agreements: (MoneyRow & { progress: number })[]) {
  const counted = agreements.filter((a) => a.status !== "CANCELLED");
  if (counted.length === 0) return 0;
  const totals = moneyTotals(counted);
  if (totals.length === 1 && counted.every((a) => a.amount !== null && a.amount !== undefined)) {
    return progressFromMoney(totals[0].amount, totals[0].absorbed);
  }
  return Math.round(counted.reduce((sum, a) => sum + a.progress, 0) / counted.length);
}

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
