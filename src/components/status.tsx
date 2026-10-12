import { Badge, MSIcon } from "./ui";
import { cn } from "@/lib/client";
import type { AgreementDisplayStatus, ItemResult, PlanStatus } from "@/lib/types";

/* Mirrors lib/labels.ts, plus the tone and icon each status gets on screen. */

const PLAN_STATUS: Record<PlanStatus, [string, string, string]> = {
  DRAFT: ["Qoralama", "bg-slate-100 text-slate-700", "edit_note"],
  PENDING: ["Tasdiqlashda", "bg-amber-100 text-amber-800", "hourglass_top"],
  REJECTED: ["Rad etilgan", "bg-red-100 text-red-700", "undo"],
  APPROVED: ["Tasdiqlangan", "bg-sky-100 text-sky-800", "verified"],
  REPORTED: ["Hisobot kiritilgan", "bg-violet-100 text-violet-800", "fact_check"],
  COMPLETED: ["Yakunlangan", "bg-emerald-100 text-emerald-800", "task_alt"],
};

export const PLAN_STATUS_OPTIONS = Object.entries(PLAN_STATUS).map(([value, [label]]) => ({
  value: value as PlanStatus,
  label,
}));

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const [label, tone, icon] = PLAN_STATUS[status];
  return (
    <Badge className={tone}>
      <MSIcon name={icon} className="text-[14px]" />
      {label}
    </Badge>
  );
}

const AGREEMENT_STATUS: Record<AgreementDisplayStatus, [string, string]> = {
  ACTIVE: ["Monitoringda", "bg-sky-100 text-sky-800"],
  OVERDUE: ["Muddati o'tgan", "bg-red-100 text-red-700"],
  COMPLETED: ["Yakunlangan", "bg-emerald-100 text-emerald-800"],
  CANCELLED: ["Bekor qilingan", "bg-slate-100 text-slate-600"],
};

export function AgreementStatusBadge({ status }: { status: AgreementDisplayStatus }) {
  const [label, tone] = AGREEMENT_STATUS[status];
  return <Badge className={tone}>{label}</Badge>;
}

const ITEM_RESULT: Record<ItemResult, [string, string, string]> = {
  PENDING: ["Natija kiritilmagan", "text-muted-foreground", "radio_button_unchecked"],
  ACHIEVED: ["Erishildi", "text-emerald-700", "check_circle"],
  NOT_ACHIEVED: ["Erishilmadi", "text-destructive", "cancel"],
};

export function ItemResultLabel({ result }: { result: ItemResult }) {
  const [label, tone, icon] = ITEM_RESULT[result];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", tone)}>
      <MSIcon name={icon} className="text-[16px]" filled={result !== "PENDING"} />
      {label}
    </span>
  );
}

export const DOCUMENT_TYPES = [
  { value: "SHARTNOMA", label: "Shartnoma" },
  { value: "MEMORANDUM", label: "Memorandum" },
  { value: "BITIM", label: "Bitim" },
  { value: "BOSHQA", label: "Boshqa hujjat" },
] as const;

export const documentTypeLabel = (v: string) => DOCUMENT_TYPES.find((d) => d.value === v)?.label ?? v;
