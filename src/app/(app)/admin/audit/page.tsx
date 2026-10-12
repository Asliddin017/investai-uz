"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, cn, formatDateTime } from "@/lib/client";
import { useSession } from "@/components/providers";
import { Button, Card, EmptyState, ErrorBox, Input, MSIcon, PageHeader, Select, Spinner } from "@/components/ui";

type AuditItem = {
  id: string;
  actorLabel: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  ip: string | null;
  createdAt: string;
};
type AuditPage = {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  actions: Record<string, string>;
};

const TONE: Record<string, string> = {
  auth: "text-slate-500",
  plan: "text-primary",
  agreement: "text-sky-700",
  attachment: "text-sky-700",
  user: "text-amber-700",
  profile: "text-amber-700",
  name_request: "text-amber-700",
  department: "text-violet-700",
  permissions: "text-red-700",
};
const ICON: Record<string, string> = {
  auth: "login",
  plan: "flight_takeoff",
  agreement: "handshake",
  attachment: "attach_file",
  user: "person",
  profile: "person",
  name_request: "edit_note",
  department: "apartment",
  permissions: "admin_panel_settings",
};

function entityHref(item: AuditItem) {
  if (!item.entityId) return null;
  if (item.entityType === "plan") return `/plans/${item.entityId}`;
  if (item.entityType === "agreement") return `/agreements/${item.entityId}`;
  return null;
}

export default function AuditPage() {
  const { can } = useSession();
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (action) params.set("action", action);
  if (q.trim()) params.set("q", q.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["admin", "audit", action, q.trim(), from, to, page],
    queryFn: () => api<AuditPage>(`/admin/audit?${params}`),
    placeholderData: keepPreviousData,
    enabled: can("admin:audit"),
  });

  if (!can("admin:audit")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Amallar jurnali" description="Kim, qachon va nima qilgani — barcha muhim amallar" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MSIcon
            name="search"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[18px] text-muted-foreground"
          />
          <Input
            className="pl-9"
            placeholder="Xodim, login yoki matn bo'yicha qidirish..."
            value={q}
            onChange={(e) => reset(() => setQ(e.target.value))}
          />
        </div>
        <Select className="w-auto" value={action} onChange={(e) => reset(() => setAction(e.target.value))}>
          <option value="">Barcha amallar</option>
          {data &&
            Object.entries(data.actions).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </Select>
        <Input type="date" className="w-auto" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} title="Dan" />
        <Input type="date" className="w-auto" value={to} onChange={(e) => reset(() => setTo(e.target.value))} title="Gacha" />
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data?.items.length ? (
        <EmptyState icon="history" title="Yozuvlar topilmadi" />
      ) : (
        <Card className={cn("overflow-x-auto", isFetching && "opacity-70")}>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="w-40 px-4 py-2.5 font-medium">Vaqt</th>
                <th className="w-56 px-4 py-2.5 font-medium">Kim</th>
                <th className="w-52 px-4 py-2.5 font-medium">Amal</th>
                <th className="px-4 py-2.5 font-medium">Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const group = item.action.split(".")[0];
                const href = entityHref(item);
                return (
                  <tr key={item.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.actorLabel}
                      {item.ip && <div className="font-mono text-[11px] text-muted-foreground">{item.ip}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1.5 font-medium", TONE[group])}>
                        <MSIcon name={ICON[group] ?? "history"} className="text-[16px]" />
                        {data.actions[item.action] ?? item.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {href ? (
                        <Link href={href} className="hover:text-primary hover:underline">
                          {item.summary}
                        </Link>
                      ) : (
                        item.summary
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground">
            <span>
              Jami {data.total} ta yozuv · {page}/{pages}-sahifa
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
