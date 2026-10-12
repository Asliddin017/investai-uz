"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, cn, formatDate } from "@/lib/client";
import type { Inbox, InboxItem } from "@/lib/inbox";
import { PlanStatusBadge } from "@/components/status";
import { Card, EmptyState, ErrorBox, Spinner } from "@/components/ui";

export function useInbox(enabled = true) {
  return useQuery({ queryKey: ["inbox"], queryFn: () => api<Inbox>("/inbox"), refetchInterval: 30_000, enabled });
}

export function InboxList({
  kind,
  emptyTitle,
  emptyText,
}: {
  kind: keyof Inbox;
  emptyTitle: string;
  emptyText: string;
}) {
  const { data, isLoading, error } = useInbox();
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const items: InboxItem[] = data?.[kind] ?? [];
  const showCreator = kind === "approvals";
  if (items.length === 0)
    return (
      <EmptyState icon="inbox" title={emptyTitle}>
        {emptyText}
      </EmptyState>
    );

  return (
    <Card>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/plans/${item.id}`}
              className={cn("flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40", item.unseen && "bg-red-500/5")}
            >
              <span
                className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", item.unseen ? "bg-red-500" : "bg-transparent")}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn("truncate", item.unseen ? "font-semibold" : "font-medium")}>{item.title}</span>
                  {item.unseen && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">Yangi</span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {[
                    item.country,
                    showCreator ? item.creatorName : null,
                    item.submittedAt ? `Yuborildi: ${formatDate(item.submittedAt)}` : null,
                    item.decidedAt ? `Javob: ${formatDate(item.decidedAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {item.status === "REJECTED" && item.rejectionReason && (
                  <span className="mt-1 block text-sm text-destructive">Rad etish sababi: {item.rejectionReason}</span>
                )}
              </span>
              <PlanStatusBadge status={item.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
