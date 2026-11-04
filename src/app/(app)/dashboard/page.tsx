"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, cn, daysUntil, formatDate, formatDateTime } from "@/lib/client";
import type { PlanStatus } from "@/lib/types";
import { useSession } from "@/components/providers";
import { PLAN_STATUS_OPTIONS } from "@/components/status";
import { MyTasks } from "@/components/my-tasks";
import { MoneyProgress } from "@/components/money-progress";
import { compactMoney } from "@/lib/money";
import { Card, CardHeader, EmptyState, ErrorBox, MSIcon, PageHeader, ProgressBar, Spinner } from "@/components/ui";

type Dashboard = {
  plansByStatus: Partial<Record<PlanStatus, number>>;
  itemsByResult: Partial<Record<"PENDING" | "ACHIEVED" | "NOT_ACHIEVED", number>>;
  agreementsByStatus: Partial<Record<"ACTIVE" | "COMPLETED" | "CANCELLED", number>>;
  overdueAgreements: number;
  averageScore: number | null;
  activeAgreements: {
    id: string;
    title: string;
    partner: string;
    deadline: string;
    progress: number;
    amount: number | null;
    absorbedAmount: number;
    currency: string | null;
  }[];
  recentUpdates: {
    id: string;
    agreementId: string;
    note: string;
    progress: number;
    amount: number | null;
    createdAt: string;
    createdBy: { fullName: string };
    agreement: { title: string; currency: string | null };
    unseen: boolean;
  }[];
  pendingApprovals: {
    id: string;
    title: string;
    country: string;
    submittedAt: string | null;
    version: number;
    creator: { fullName: string };
  }[];
  departments: {
    name: string;
    plans: number;
    items: number;
    achieved: number;
    agreements: number;
    averageScore: number | null;
  }[];
};

function StatTile({
  label,
  value,
  icon,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  icon: string;
  hint?: string;
  tone?: "default" | "warning" | "critical";
  href?: string;
}) {
  const body = (
    <Card className={cn("h-full p-4 transition-colors", href && "hover:border-primary/50")}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <MSIcon
          name={icon}
          className={cn(
            "text-[20px]",
            tone === "critical" ? "text-destructive" : tone === "warning" ? "text-amber-600" : "text-primary",
          )}
        />
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** One stacked bar: achieved / not achieved / awaiting result — labelled, never color alone. */
function ResultsBar({ achieved, failed, pending }: { achieved: number; failed: number; pending: number }) {
  const total = achieved + failed + pending;
  if (total === 0) return <p className="text-sm text-muted-foreground">Hali natija kiritilmagan.</p>;
  const parts = [
    { label: "Erishildi", value: achieved, color: "bg-emerald-600", icon: "check_circle", text: "text-emerald-700" },
    { label: "Erishilmadi", value: failed, color: "bg-red-600", icon: "cancel", text: "text-red-700" },
    { label: "Natija kutilmoqda", value: pending, color: "bg-slate-300", icon: "schedule", text: "text-muted-foreground" },
  ].filter((p) => p.value > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.label}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", p.color)}
            style={{ width: `${(p.value / total) * 100}%` }}
            title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <MSIcon name={p.icon} className={cn("text-[16px]", p.text)} filled />
            {p.label}: <b className="tabular-nums">{p.value}</b>
            <span className="text-muted-foreground tabular-nums">({Math.round((p.value / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  const plansTotal = Object.values(data.plansByStatus).reduce((s, v) => s + (v ?? 0), 0);
  const maxStatus = Math.max(1, ...Object.values(data.plansByStatus).map((v) => v ?? 0));
  const activeAgreements = data.agreementsByStatus.ACTIVE ?? 0;
  const unseenUpdates = data.recentUpdates.filter((u) => u.unseen).length;
  const agreementsTotal = Object.values(data.agreementsByStatus).reduce((s, v) => s + (v ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`Assalomu alaykum, ${user.fullName}`} description="Investitsiya safarlari bo'yicha umumiy holat" />

      <MyTasks />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Jami safarlar" value={plansTotal} icon="flight_takeoff" href="/plans" />
        <StatTile
          label="Tasdiqlashda"
          value={data.plansByStatus.PENDING ?? 0}
          icon="hourglass_top"
          tone={(data.plansByStatus.PENDING ?? 0) > 0 ? "warning" : "default"}
          href="/plans"
        />
        <StatTile label="Faol kelishuvlar" value={activeAgreements} icon="handshake" hint="monitoringda" href="/agreements" />
        <StatTile
          label="Muddati o'tgan"
          value={data.overdueAgreements}
          icon="warning"
          tone={data.overdueAgreements > 0 ? "critical" : "default"}
          hint="faol kelishuvlar"
          href="/agreements"
        />
        <StatTile
          label="O'zlashtirilgan loyihalar"
          value={`${data.agreementsByStatus.COMPLETED ?? 0}/${agreementsTotal}`}
          icon="task_alt"
          hint="yakunlangan kelishuvlar"
          href="/agreements"
        />
        <StatTile
          label="O'rtacha AI moslik"
          value={data.averageScore === null ? "—" : `${data.averageScore}%`}
          icon="auto_awesome"
          hint="reja va natija mosligi"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Faol kelishuvlar"
            icon="handshake"
            description="Monitoringda — eng shoshilinchi yuqorida"
            actions={
              activeAgreements > data.activeAgreements.length ? (
                <Link href="/agreements" className="text-sm font-medium text-primary hover:underline">
                  Barchasi ({activeAgreements})
                </Link>
              ) : undefined
            }
          />
          {data.activeAgreements.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">Monitoringda kelishuv yo&apos;q.</div>
          ) : (
            <ul className="divide-y">
              {data.activeAgreements.map((a) => {
                const left = daysUntil(a.deadline);
                return (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/agreements/${a.id}`} className="text-sm font-medium hover:underline">
                        {a.title}
                      </Link>
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          left < 0 ? "font-medium text-destructive" : left <= 30 ? "text-amber-700" : "text-muted-foreground",
                        )}
                      >
                        {left < 0 ? `${-left} kun o'tdi` : `${left} kun qoldi`}
                      </span>
                    </div>
                    <MoneyProgress a={a} />
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.partner} · {formatDate(a.deadline)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Oxirgi monitoring yozuvlari"
            icon="monitoring"
            description="Kelishuvlar bo'yicha bajarilgan ishlar"
            actions={
              unseenUpdates > 0 ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                  {unseenUpdates} ta yangi
                </span>
              ) : undefined
            }
          />
          {data.recentUpdates.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">Hali monitoring yozuvi yo&apos;q.</div>
          ) : (
            <ul className="divide-y">
              {data.recentUpdates.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/agreements/${u.agreementId}`}
                    className={cn("flex gap-3 px-5 py-3 transition-colors hover:bg-muted/40", u.unseen && "bg-red-500/5")}
                  >
                    <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-primary tabular-nums">
                      {u.progress}%
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("truncate", u.unseen ? "font-semibold" : "font-medium")}>{u.agreement.title}</span>
                        {u.unseen && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">Yangi</span>
                        )}
                      </div>
                      {u.amount !== null && (
                        <div className="mt-0.5 font-semibold text-emerald-700 tabular-nums">+{compactMoney(u.amount, u.agreement.currency)} tushdi</div>
                      )}
                      <div className="mt-0.5 line-clamp-2">{u.note}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {u.createdBy.fullName} · {formatDateTime(u.createdAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Safarlar holati bo'yicha" icon="stacked_bar_chart" />
          <div className="space-y-2.5 p-5">
            {PLAN_STATUS_OPTIONS.map((s) => {
              const v = data.plansByStatus[s.value] ?? 0;
              return (
                <div key={s.value} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm" title={`${s.label}: ${v}`}>
                  <span className="text-muted-foreground">{s.label}</span>
                  <div className="h-2.5 rounded-full bg-muted">
                    {v > 0 && (
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(v / maxStatus) * 100}%` }} />
                    )}
                  </div>
                  <span className="text-right font-medium tabular-nums">{v}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Rejalar natijasi" icon="rule" description="Tasdiqlangan safarlarning barcha rejalari" />
          <div className="p-5">
            <ResultsBar
              achieved={data.itemsByResult.ACHIEVED ?? 0}
              failed={data.itemsByResult.NOT_ACHIEVED ?? 0}
              pending={data.itemsByResult.PENDING ?? 0}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Tashkilotlar kesimida" icon="apartment" description="Hisoboti kiritilgan safarlar" />
        {data.departments.length === 0 ? (
          <div className="p-5">
            <EmptyState icon="apartment" title="Hali hisobot kiritilgan safar yo'q" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Tashkilot</th>
                  <th className="px-3 py-2 text-center font-medium">Safarlar</th>
                  <th className="px-3 py-2 text-center font-medium">Erishildi</th>
                  <th className="px-3 py-2 text-center font-medium">Kelishuv</th>
                  <th className="w-40 px-5 py-2 font-medium">AI moslik</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.name} className="border-b last:border-0">
                    <td className="px-5 py-2.5">{d.name}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{d.plans}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {d.achieved}/{d.items}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{d.agreements}</td>
                    <td className="px-5 py-2.5">
                      {d.averageScore === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ProgressBar value={d.averageScore} />
                          <span className="w-9 text-right text-xs font-medium tabular-nums">{d.averageScore}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
