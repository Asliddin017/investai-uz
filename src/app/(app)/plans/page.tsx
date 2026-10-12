"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatDate } from "@/lib/client";
import type { PlanListItem } from "@/lib/types";
import { useSession } from "@/components/providers";
import { PlanStatusBadge, PLAN_STATUS_OPTIONS } from "@/components/status";
import { Button, Card, EmptyState, ErrorBox, Input, MSIcon, PageHeader, Select, Spinner } from "@/components/ui";

export default function PlansPage() {
  const { user, can } = useSession();
  // The filter only matters to someone who also sees trips created by others (see planVisibilityWhere).
  const seesOthers = can("plan:view_all") || (can("plan:view_department") && !!user.departmentId);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  if (mine) params.set("mine", "1");

  const { data, isLoading, error } = useQuery({
    queryKey: ["plans", status, q.trim(), mine],
    queryFn: () => api<PlanListItem[]>(`/plans?${params}`),
  });

  return (
    <div>
      <PageHeader
        title="Safarlar"
        description="Xorijiy investitsiya safarlari, ulardagi rejalar va holati"
        actions={
          can("plan:create") && (
            <Link href="/plans/new">
              <Button icon="add">Yangi safar</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MSIcon
            name="search"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[18px] text-muted-foreground"
          />
          <Input
            className="pl-9"
            placeholder="Nomi, davlat yoki maqsad bo'yicha qidirish..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Barcha holatlar</option>
          {PLAN_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {can("plan:create") && seesOthers && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4" />
            Faqat men yaratganlar
          </label>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data?.length ? (
        <EmptyState icon="flight_takeoff" title="Safarlar topilmadi">
          {can("plan:create") ? "Yangi safar yaratish uchun yuqoridagi tugmani bosing." : null}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Safar</th>
                <th className="px-4 py-2.5 font-medium">Muddati</th>
                <th className="px-4 py-2.5 font-medium">Tuzuvchi</th>
                <th className="px-4 py-2.5 font-medium">Holati</th>
                <th className="px-4 py-2.5 text-center font-medium">Rejalar</th>
                <th className="px-4 py-2.5 text-center font-medium">Kelishuv</th>
                <th className="px-4 py-2.5 text-center font-medium">AI moslik</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/plans/${p.id}`} className="font-medium hover:text-primary hover:underline">
                      {p.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MSIcon name="location_on" className="text-[14px]" />
                      {p.country}
                      {p.city ? `, ${p.city}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div>{p.creator?.fullName}</div>
                    <div className="text-xs text-muted-foreground">{p.department?.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PlanStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {p.status === "REPORTED" || p.status === "COMPLETED" ? (
                      <span title="Erishildi / jami">
                        <span className="font-medium text-emerald-700">{p.achievedCount}</span>
                        <span className="text-muted-foreground"> / {p.itemCount}</span>
                      </span>
                    ) : (
                      p.itemCount
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{p._count.agreements}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {p.score === null ? <span className="text-muted-foreground">—</span> : <b>{p.score}%</b>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
