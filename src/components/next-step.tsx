"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/client";
import type { PlanDetail } from "@/lib/types";
import { MSIcon } from "./ui";

type Step = { tone: "action" | "wait" | "done" | "warn"; icon: string; title: string; text?: ReactNode };

/** One plain sentence: what this person should do with this plan now. */
export function nextStepFor(plan: PlanDetail): Step {
  const pending = plan.items.filter((i) => i.result === "PENDING").length;
  const c = plan.can;
  switch (plan.status) {
    case "DRAFT":
      return c.submit
        ? { tone: "action", icon: "send", title: "Reja tayyor bo'lsa — «Tasdiqqa yuborish»ni bosing", text: "Yuborilgandan keyin rejani o'zgartirib bo'lmaydi." }
        : { tone: "wait", icon: "edit_note", title: "Muallif rejani hali tasdiqqa yubormagan" };
    case "REJECTED":
      return c.edit
        ? { tone: "warn", icon: "undo", title: "Reja qaytarildi — «Tahrirlash»ni bosib tuzating va qayta yuboring", text: plan.rejectionReason }
        : { tone: "wait", icon: "undo", title: "Reja muallifga tuzatish uchun qaytarilgan", text: plan.rejectionReason };
    case "PENDING":
      return c.approve
        ? { tone: "action", icon: "verified", title: "Rejani ko'rib chiqing: «Tasdiqlash» yoki «Rad etish»" }
        : { tone: "wait", icon: "hourglass_top", title: "Kotibiyat mudiri ko'rib chiqmoqda", text: "Sizdan hozir hech narsa talab qilinmaydi." };
    case "APPROVED":
      if (c.report) {
        return pending > 0
          ? {
              tone: "action",
              icon: "rule",
              title: `Safardan keyin: har bir band yonidagi «Natija» tugmasini bosing (${pending} ta qoldi)`,
              text: "Shartnoma imzolangan bo'lsa, o'sha band yonidagi «Kelishuv» orqali uni muddati bilan qo'shing.",
            }
          : { tone: "action", icon: "fact_check", title: "Natijalar to'liq — «Hisobotni yakunlash»ni bosing", text: "Shundan so'ng AI xulosa avtomatik tayyor bo'ladi." };
      }
      return c.remind
        ? { tone: "wait", icon: "flight", title: "Xodim safar natijalarini kiritmoqda", text: "Kechiksa — «Hisobotni so'rash» tugmasi bilan eslating." }
        : { tone: "wait", icon: "flight", title: "Reja tasdiqlangan, safar natijalari kutilmoqda" };
    case "REPORTED":
      return {
        tone: "done",
        icon: "auto_awesome",
        title: `Hisobot tayyor${plan.analyses[0] ? ` — AI moslik ${plan.analyses[0].score}%` : ""}`,
        text: c.manageAgreements || c.monitor
          ? "Kelishuvlar muddatigacha kuzatiladi: «Kelishuvlar» bo'limida bajarilgan ishlarni yozib boring."
          : "Kelishuvlar yakunlanguncha kuzatiladi.",
      };
    case "COMPLETED":
      return { tone: "done", icon: "task_alt", title: "Reja to'liq yakunlangan", text: "Barcha kelishuvlar yopilgan." };
  }
}

const TONE: Record<Step["tone"], string> = {
  action: "border-primary/40 bg-primary-soft",
  wait: "border-border bg-muted/40",
  done: "border-emerald-500/40 bg-emerald-500/10",
  warn: "border-destructive/40 bg-destructive/5",
};
const ICON_TONE: Record<Step["tone"], string> = {
  action: "text-primary",
  wait: "text-muted-foreground",
  done: "text-emerald-600",
  warn: "text-destructive",
};

export function NextStep({ plan }: { plan: PlanDetail }) {
  const step = nextStepFor(plan);
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", TONE[step.tone])}>
      <MSIcon name={step.icon} className={cn("mt-0.5 text-[22px]", ICON_TONE[step.tone])} />
      <div>
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Keyingi qadam</div>
        <div className="font-medium">{step.title}</div>
        {step.text && <div className="mt-0.5 text-sm text-muted-foreground">{step.text}</div>}
      </div>
    </div>
  );
}
