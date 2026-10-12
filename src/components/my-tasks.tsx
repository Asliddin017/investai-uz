"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, cn } from "@/lib/client";
import { Card, CardHeader, MSIcon } from "./ui";

export type Task = {
  id: string;
  kind: "approve" | "fix" | "submit" | "results" | "close_report" | "overdue" | "name_request";
  title: string;
  hint: string;
  href: string;
  urgent?: boolean;
};

const KIND: Record<Task["kind"], { icon: string; action: string }> = {
  approve: { icon: "verified", action: "Ko'rib chiqish" },
  fix: { icon: "undo", action: "Tuzatish" },
  submit: { icon: "send", action: "Ochish" },
  results: { icon: "rule", action: "Natija kiritish" },
  close_report: { icon: "fact_check", action: "Yakunlash" },
  overdue: { icon: "warning", action: "Yangilash" },
  name_request: { icon: "edit_note", action: "Ko'rib chiqish" },
};

export function useMyTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: () => api<Task[]>("/tasks"), refetchInterval: 60_000 });
}

/** The first thing on the dashboard: what this person has to do now, one click each. */
export function MyTasks() {
  const { data, isLoading } = useMyTasks();
  if (isLoading) return null;
  return (
    <Card>
      <CardHeader title="Mening vazifalarim" icon="checklist" description="Sizdan hozir nima kutilmoqda" />
      {!data?.length ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
          <MSIcon name="task_alt" className="text-emerald-600" />
          Hozircha sizdan hech narsa kutilmayapti.
        </div>
      ) : (
        <ul className="divide-y">
          {data.map((t) => (
            <li key={t.id}>
              <Link href={t.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                <MSIcon
                  name={KIND[t.kind].icon}
                  className={cn("text-[20px]", t.urgent ? "text-destructive" : "text-primary")}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className={cn("text-xs", t.urgent ? "text-destructive" : "text-muted-foreground")}>{t.hint}</div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                  {KIND[t.kind].action}
                  <MSIcon name="arrow_forward" className="text-[16px]" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
