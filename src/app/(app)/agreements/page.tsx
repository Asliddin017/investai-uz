"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, cn, daysUntil, formatDate, formatMoney } from "@/lib/client";
import type { AgreementListItem } from "@/lib/types";
import { AgreementStatusBadge, documentTypeLabel } from "@/components/status";
import { Card, ClickableRow, EmptyState, ErrorBox, Input, MSIcon, PageHeader, ProgressBar, Select, Spinner } from "@/components/ui";

const FILTERS = [
  { value: "", label: "Barchasi" },
  { value: "ACTIVE", label: "Monitoringda" },
  { value: "OVERDUE", label: "Muddati o'tgan" },
  { value: "COMPLETED", label: "Yakunlangan" },
  { value: "CANCELLED", label: "Bekor qilingan" },
];

export default function AgreementsPage() {
  const [status, setStatus] = useState("ACTIVE");
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());

  const { data, isLoading, error } = useQuery({
    queryKey: ["agreements", status, q.trim()],
    queryFn: () => api<AgreementListItem[]>(`/agreements?${params}`),
  });

  return (
    <div>
      <PageHeader
        title="Kelishuvlar monitoringi"
        description="Safarlarda erishilgan kelishuvlar — amalga oshish muddatigacha kuzatib boriladi"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MSIcon
            name="search"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[18px] text-muted-foreground"
          />
          <Input
            className="pl-9"
            placeholder="Kelishuv, hamkor yoki hujjat raqami..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data?.length ? (
        <EmptyState icon="handshake" title="Kelishuvlar topilmadi" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Kelishuv</th>
                <th className="px-4 py-2.5 font-medium">Reja</th>
                <th className="px-4 py-2.5 font-medium">Summa</th>
                <th className="px-4 py-2.5 font-medium">Muddat</th>
                <th className="w-40 px-4 py-2.5 font-medium">Bajarilishi</th>
                <th className="px-4 py-2.5 font-medium">Holati</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => {
                const left = daysUntil(a.deadline);
                return (
                  <ClickableRow key={a.id} className="border-b last:border-0 hover:bg-muted/30" href={`/agreements/${a.id}`}>
                    <td className="px-4 py-3">
                      <Link href={`/agreements/${a.id}`} className="font-medium hover:text-primary hover:underline">
                        {a.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {documentTypeLabel(a.documentType)} · {a.partner}
                        {a.partnerCountry ? ` (${a.partnerCountry})` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/plans/${a.plan.id}`} className="hover:underline">
                        {a.plan.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {a.planItem ? `${a.planItem.order}-reja` : "Rejadan tashqari"}
                        {a.plan.department ? ` · ${a.plan.department.name}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatMoney(a.amount, a.currency)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(a.deadline)}
                      {a.status === "ACTIVE" && (
                        <div className={cn("text-xs", left < 0 ? "text-destructive" : left <= 14 ? "text-amber-700" : "text-muted-foreground")}>
                          {left < 0 ? `${-left} kun o'tdi` : `${left} kun qoldi`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={a.progress} />
                        <span className="text-xs tabular-nums">{a.progress}%</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{a._count.updates} ta yozuv</div>
                    </td>
                    <td className="px-4 py-3">
                      <AgreementStatusBadge status={a.displayStatus} />
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
