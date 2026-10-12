"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, formatDate, formatDateTime } from "@/lib/client";
import type { ReportReminder } from "@/lib/types";
import { Card, CardHeader, MSIcon } from "./ui";

export function useReportReminders(enabled: boolean) {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => api<ReportReminder[]>("/reminders"),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Dashboard card: trips whose report the approver asked this user to close. */
export function ReportRemindersCard() {
  const { data } = useReportReminders(true);
  if (!data?.length) return null;
  return (
    <Card className="border-amber-400/50">
      <CardHeader
        title="Sizdan hisobot kutilmoqda"
        icon="notifications_active"
        description="Kotibiyat mudiri ushbu safarlar hisobotini yakunlashni so'radi"
      />
      <ul className="divide-y">
        {data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <div>
              <Link href={`/plans/${r.plan.id}`} className="font-medium hover:text-primary hover:underline">
                {r.plan.title}
              </Link>
              <div className="text-xs text-muted-foreground">
                Safar tugashi: {formatDate(r.plan.endDate)} · so&apos;radi {r.requestedBy.fullName}, {formatDateTime(r.createdAt)}
                {r.message && ` · ${r.message}`}
              </div>
            </div>
            <Link href={`/plans/${r.plan.id}`} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Hisobotni yakunlash <MSIcon name="arrow_forward" className="text-[16px]" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
