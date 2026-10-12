"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn, daysUntil, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import type { ItemResult, PlanDetail, PlanItem, PlanStatus } from "@/lib/types";
import { useToast } from "@/components/providers";
import { AgreementFormDialog } from "@/components/agreement-form";
import { NextStep } from "@/components/next-step";
import { AgreementStatusBadge, documentTypeLabel, ItemResultLabel, PlanStatusBadge } from "@/components/status";
import {
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  ErrorBox,
  Field,
  MSIcon,
  ProgressBar,
  ScoreRing,
  Select,
  Spinner,
  Tabs,
  Textarea,
} from "@/components/ui";

const STAGES: { key: PlanStatus[]; label: string; icon: string }[] = [
  { key: ["DRAFT", "REJECTED"], label: "Safar rejalashtirildi", icon: "edit_note" },
  { key: ["PENDING"], label: "Tasdiqlashda", icon: "hourglass_top" },
  { key: ["APPROVED"], label: "Safar va natijalar", icon: "flight" },
  { key: ["REPORTED"], label: "AI tahlil va monitoring", icon: "monitoring" },
  { key: ["COMPLETED"], label: "Yakunlandi", icon: "task_alt" },
];

function Stepper({ status }: { status: PlanStatus }) {
  const current = STAGES.findIndex((s) => s.key.includes(status));
  return (
    <ol className="flex flex-wrap gap-y-2">
      {STAGES.map((s, i) => {
        const done = i < current || status === "COMPLETED";
        const active = i === current && status !== "COMPLETED";
        return (
          <li key={s.label} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                done && "bg-primary-soft text-primary",
                active && (status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-primary text-white"),
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              <MSIcon name={done ? "check" : s.icon} className="text-[16px]" />
              {active && status === "REJECTED" ? "Rad etildi — tuzatish" : s.label}
            </div>
            {i < STAGES.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function ResultDialog({ item, planId, onClose }: { item: PlanItem; planId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState<ItemResult>(item.result === "PENDING" ? "ACHIEVED" : item.result);
  const [note, setNote] = useState(item.resultNote ?? "");
  const [reason, setReason] = useState(item.failureReason ?? "");
  const save = useMutation({
    mutationFn: () =>
      api(`/plans/${planId}/items/${item.id}/result`, {
        method: "PUT",
        json: { result, resultNote: note, failureReason: reason },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plan", planId] });
      toast("Natija saqlandi");
      onClose();
    },
    onError: (e) => toast(e.message, "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${item.order}. ${item.title}`}
      description={`Kutilgan natija: ${item.expectedResult}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button icon="save" loading={save.isPending} onClick={() => save.mutate()}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["ACHIEVED", "NOT_ACHIEVED"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResult(r)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                result === r
                  ? r === "ACHIEVED"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-destructive bg-red-50 text-destructive"
                  : "hover:bg-muted",
              )}
            >
              <MSIcon name={r === "ACHIEVED" ? "check_circle" : "cancel"} />
              {r === "ACHIEVED" ? "Erishildi" : "Erishilmadi"}
            </button>
          ))}
        </div>
        <Field label="Natija tavsifi" hint="Aynan nimaga erishildi: summa, hamkor, hujjat">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Field>
        {result === "NOT_ACHIEVED" && (
          <Field label="Erishilmaganlik sababi" required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

function RoadmapTab({ plan, onAddAgreement }: { plan: PlanDetail; onAddAgreement: (itemId: string) => void }) {
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const showResults = plan.status === "APPROVED" || plan.status === "REPORTED" || plan.status === "COMPLETED";
  const analysis = plan.analyses[0];
  return (
    <Card>
      <CardHeader
        title="Rejalar"
        icon="route"
        description={
          plan.can.report
            ? "Safardan keyin har bir reja uchun natijani kiriting va erishilgan kelishuvlarni qo'shing"
            : `${plan.items.length} ta reja`
        }
      />
      <ol className="divide-y">
        {plan.items.map((item) => {
          const agreements = plan.agreements.filter((a) => a.planItemId === item.id);
          const aiItem = analysis?.details.items.find((i) => i.order === item.order);
          return (
            <li key={item.id} className="flex gap-4 px-5 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {item.order}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{item.title}</div>
                  {showResults && <ItemResultLabel result={item.result} />}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/80">Kutilgan natija:</span> {item.expectedResult}
                  {item.dueDate && <span> · muddat {formatDate(item.dueDate)}</span>}
                </div>
                {item.resultNote && (
                  <div className="text-sm">
                    <span className="font-medium">Natija:</span> {item.resultNote}
                  </div>
                )}
                {item.failureReason && (
                  <div className="text-sm text-destructive">
                    <span className="font-medium">Sabab:</span> {item.failureReason}
                  </div>
                )}
                {agreements.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {agreements.map((a) => (
                      <Link
                        key={a.id}
                        href={`/agreements/${a.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:border-primary"
                      >
                        <MSIcon name="handshake" className="text-[14px] text-primary" />
                        {documentTypeLabel(a.documentType)}: {a.title}
                      </Link>
                    ))}
                  </div>
                )}
                {aiItem && (
                  <div className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
                    <MSIcon name="auto_awesome" className="text-[14px] text-primary" />
                    <span>
                      <b className="text-foreground">{aiItem.score}%</b> — {aiItem.comment}
                    </span>
                  </div>
                )}
              </div>
              {(plan.can.report || (plan.can.manageAgreements && item.result === "ACHIEVED")) && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {plan.can.report && (
                    <Button size="sm" variant="outline" icon="rule" onClick={() => setEditing(item)}>
                      Natija
                    </Button>
                  )}
                  {plan.can.manageAgreements && item.result === "ACHIEVED" && (
                    <Button size="sm" variant="ghost" icon="add" onClick={() => onAddAgreement(item.id)}>
                      Kelishuv
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {editing && <ResultDialog item={editing} planId={plan.id} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function AgreementsTab({ plan, onAdd }: { plan: PlanDetail; onAdd: () => void }) {
  const extra = plan.agreements.filter((a) => !a.planItemId);
  return (
    <Card>
      <CardHeader
        title="Erishilgan kelishuvlar"
        icon="handshake"
        description="Har bir kelishuv amalga oshish muddatigacha monitoring qilinadi"
        actions={
          plan.can.manageAgreements && (
            <Button size="sm" icon="add" onClick={onAdd}>
              Kelishuv qo&apos;shish
            </Button>
          )
        }
      />
      {plan.agreements.length === 0 ? (
        <div className="p-5">
          <EmptyState icon="handshake" title="Kelishuvlar hali kiritilmagan">
            {plan.status === "APPROVED" || plan.status === "REPORTED"
              ? "Safarda imzolangan shartnoma, memorandum yoki bitimlarni qo'shing."
              : "Kelishuvlar safar tasdiqlangandan keyin kiritiladi."}
          </EmptyState>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
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
              {plan.agreements.map((a) => {
                const item = plan.items.find((i) => i.id === a.planItemId);
                const left = daysUntil(a.deadline);
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/agreements/${a.id}`} className="font-medium hover:text-primary hover:underline">
                        {a.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {documentTypeLabel(a.documentType)} · {a.partner}
                        {a._count.attachments > 0 && ` · ${a._count.attachments} ta hujjat`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item ? (
                        `${item.order}. ${item.title}`
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                          Rejadan tashqari
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatMoney(a.amount, a.currency)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(a.deadline)}
                      {a.status === "ACTIVE" && (
                        <div className={cn("text-xs", left < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {left < 0 ? `${-left} kun o'tdi` : `${left} kun qoldi`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={a.progress} />
                        <span className="text-xs tabular-nums">{a.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AgreementStatusBadge status={a.displayStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {extra.length > 0 && (
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          Rejadan tashqari {extra.length} ta kelishuv qo&apos;shimcha yutuq sifatida hisoblanadi va AI moslik foiziga
          kirmaydi.
        </div>
      )}
    </Card>
  );
}

function AnalysisTab({ plan }: { plan: PlanDetail }) {
  const toast = useToast();
  const qc = useQueryClient();
  const rerun = useMutation({
    mutationFn: () => api<{ score: number }>(`/plans/${plan.id}/analyze`, { method: "POST" }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["plan", plan.id] });
      toast(`AI tahlil yangilandi: ${r.score}%`);
    },
    onError: (e) => toast(e.message, "error"),
  });
  const [latest, ...older] = plan.analyses;

  if (!latest) {
    return (
      <Card className="p-5">
        <EmptyState icon="auto_awesome" title="AI tahlil hali o'tkazilmagan">
          Safar natijalari kiritilib, hisobot yakunlangach AI rejalar bilan natijalar mosligini avtomatik baholaydi.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Rejalar va natijalar mosligi"
          icon="auto_awesome"
          description={`${formatDateTime(latest.createdAt)} · ${latest.model === "heuristic" ? "oddiy hisob-kitob (AI kaliti sozlanmagan)" : latest.model}`}
          actions={
            plan.can.analyze && (
              <Button size="sm" variant="outline" icon="refresh" loading={rerun.isPending} onClick={() => rerun.mutate()}>
                Qayta tahlil
              </Button>
            )
          }
        />
        <div className="flex flex-col gap-6 p-5 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center">
            <ScoreRing score={latest.score} size={128} />
            <span className="mt-1 text-xs text-muted-foreground">umumiy moslik</span>
          </div>
          <div className="space-y-4 text-sm">
            <p className="leading-relaxed">{latest.summary}</p>
            {latest.details.extraAchievements && (
              <div className="rounded-md bg-amber-50 px-3 py-2">
                <div className="text-xs font-semibold text-amber-800 uppercase">Qo&apos;shimcha yutuqlar</div>
                <div className="mt-0.5">{latest.details.extraAchievements}</div>
              </div>
            )}
            {latest.details.recommendations.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Tavsiyalar</div>
                <ul className="list-disc space-y-1 pl-5">
                  {latest.details.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">Reja</th>
                <th className="w-48 px-5 py-2 font-medium">Moslik</th>
                <th className="px-5 py-2 font-medium">Izoh</th>
              </tr>
            </thead>
            <tbody>
              {latest.details.items.map((ai) => {
                const item = plan.items.find((i) => i.order === ai.order);
                return (
                  <tr key={ai.order} className="border-t">
                    <td className="px-5 py-2.5">
                      {ai.order}. {item?.title}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={ai.score} />
                        <span className="w-10 text-right text-xs font-medium tabular-nums">{ai.score}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">{ai.comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {older.length > 0 && (
        <Card>
          <CardHeader title="Oldingi tahlillar" icon="history" />
          <ul className="divide-y text-sm">
            {older.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                <b className="tabular-nums">{a.score}%</b>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const ACTION_LABEL = { SUBMIT: "Tasdiqqa yubordi", APPROVE: "Tasdiqladi", REJECT: "Rad etdi" } as const;
const ACTION_ICON = { SUBMIT: "send", APPROVE: "verified", REJECT: "undo" } as const;

function HistoryTab({ plan }: { plan: PlanDetail }) {
  const [version, setVersion] = useState(plan.versions[0]?.version ?? 0);
  const snapshot = plan.versions.find((v) => v.version === version)?.snapshot;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader title="Tasdiqlash tarixi" icon="history" />
        {plan.approvals.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">Safar hali tasdiqqa yuborilmagan.</div>
        ) : (
          <ol className="space-y-4 p-5">
            {plan.approvals.map((a) => (
              <li key={a.id} className="flex gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    a.action === "APPROVE" && "bg-emerald-100 text-emerald-700",
                    a.action === "REJECT" && "bg-red-100 text-red-700",
                    a.action === "SUBMIT" && "bg-muted text-muted-foreground",
                  )}
                >
                  <MSIcon name={ACTION_ICON[a.action]} className="text-[18px]" />
                </div>
                <div className="text-sm">
                  <div>
                    <b>{a.user.fullName}</b>{" "}
                    {a.user.username && <span className="font-mono text-xs text-muted-foreground">@{a.user.username}</span>}{" "}
                    {ACTION_LABEL[a.action].toLowerCase()}{" "}
                    <span className="text-muted-foreground">(v{a.version})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</div>
                  {a.comment && <div className="mt-1 rounded bg-muted/60 px-2 py-1">{a.comment}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card>
        <CardHeader
          title="Safar variantlari"
          icon="difference"
          description="Har gal tasdiqqa yuborilganda variant o'zgarmas holda saqlanadi; v1 — dastlabki variant"
          actions={
            plan.versions.length > 0 && (
              <Select className="w-auto" value={version} onChange={(e) => setVersion(Number(e.target.value))}>
                {plan.versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version}
                    {v.version === 1 ? " (dastlabki)" : ""} — {formatDate(v.createdAt)}
                  </option>
                ))}
              </Select>
            )
          }
        />
        {!snapshot ? (
          <div className="p-5 text-sm text-muted-foreground">Saqlangan variant yo&apos;q.</div>
        ) : (
          <div className="space-y-3 p-5 text-sm">
            <div>
              <div className="font-medium">{snapshot.title}</div>
              <div className="text-muted-foreground">{snapshot.goal}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {snapshot.country}
                {snapshot.city ? `, ${snapshot.city}` : ""} · {formatDate(snapshot.startDate)} –{" "}
                {formatDate(snapshot.endDate)}
              </div>
            </div>
            <ol className="space-y-1.5">
              {snapshot.items.map((i) => (
                <li key={i.order} className="rounded-md border px-3 py-2">
                  <b>
                    {i.order}. {i.title}
                  </b>
                  <div className="text-xs text-muted-foreground">{i.expectedResult}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"roadmap" | "agreements" | "analysis" | "history">("roadmap");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [agreementFor, setAgreementFor] = useState<string | null | undefined>(undefined);
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindMessage, setRemindMessage] = useState("");

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ["plan", id],
    queryFn: () => api<PlanDetail>(`/plans/${id}`),
  });

  const action = useMutation({
    mutationFn: ({ path, body, method = "POST" }: { path: string; body?: unknown; method?: string; done: string }) =>
      api(`/plans/${id}${path}`, { method, json: body }),
    onSuccess: async (_r, vars) => {
      await qc.invalidateQueries({ queryKey: ["plan", id] });
      await qc.invalidateQueries({ queryKey: ["plans"] });
      await qc.invalidateQueries({ queryKey: ["reminders"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(vars.done);
    },
    onError: (e) => toast(e.message, "error"),
  });

  if (isLoading) return <Spinner />;
  if (error || !plan) return <ErrorBox error={error} />;

  const pendingResults = plan.items.filter((i) => i.result === "PENDING").length;
  const run = (path: string, done: string, body?: unknown) => action.mutate({ path, done, body });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link href="/plans" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <MSIcon name="arrow_back" className="text-[18px]" /> Safarlar
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
              <PlanStatusBadge status={plan.status} />
              {plan.version > 0 && <span className="text-xs text-muted-foreground">v{plan.version}</span>}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MSIcon name="location_on" className="text-[16px]" />
                {plan.country}
                {plan.city ? `, ${plan.city}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <MSIcon name="calendar_month" className="text-[16px]" />
                {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <MSIcon name="person" className="text-[16px]" />
                {plan.creator.fullName}
                {plan.department ? ` · ${plan.department.name}` : ""}
              </span>
              {plan.approvedBy && (
                <span className="flex items-center gap-1">
                  <MSIcon name="verified" className="text-[16px]" />
                  Tasdiqladi: {plan.approvedBy.fullName}, {formatDate(plan.approvedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.can.edit && (
              <Link href={`/plans/${plan.id}/edit`}>
                <Button variant="outline" icon="edit">
                  Tahrirlash
                </Button>
              </Link>
            )}
            {plan.can.delete && (
              <Button
                variant="ghost"
                icon="delete"
                className="text-destructive"
                onClick={async () => {
                  if (!confirm("Qoralamani o'chirasizmi?")) return;
                  try {
                    await api(`/plans/${plan.id}`, { method: "DELETE" });
                    await qc.invalidateQueries({ queryKey: ["plans"] });
                    toast("Qoralama o'chirildi");
                    router.push("/plans");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "O'chirilmadi", "error");
                  }
                }}
              >
                O&apos;chirish
              </Button>
            )}
            {plan.can.submit && (
              <Button icon="send" loading={action.isPending} onClick={() => run("/submit", "Safar tasdiqlashga yuborildi")}>
                Tasdiqqa yuborish
              </Button>
            )}
            {plan.can.approve && (
              <>
                <Button variant="outline" icon="undo" className="text-destructive" onClick={() => setRejectOpen(true)}>
                  Rad etish
                </Button>
                <Button variant="success" icon="verified" loading={action.isPending} onClick={() => run("/approve", "Safar tasdiqlandi")}>
                  Tasdiqlash
                </Button>
              </>
            )}
            {plan.can.remind && (
              <Button variant="outline" icon="notifications_active" onClick={() => setRemindOpen(true)}>
                Hisobotni so&apos;rash
              </Button>
            )}
            {plan.can.report && pendingResults === 0 && (
              <Button
                icon="fact_check"
                loading={action.isPending}
                disabled={pendingResults > 0}
                title={pendingResults > 0 ? `${pendingResults} ta reja natijasi kiritilmagan` : undefined}
                onClick={() => {
                  if (confirm("Hisobotni yakunlaysizmi? Shundan keyin natijalarni o'zgartirib bo'lmaydi, AI tahlil boshlanadi.")) {
                    run("/report", "Hisobot yakunlandi, AI tahlil tayyor");
                    setTab("analysis");
                  }
                }}
              >
                Hisobotni yakunlash
              </Button>
            )}
          </div>
        </div>
        <Stepper status={plan.status} />
      </div>

      <NextStep plan={plan} />
      {plan.status === "APPROVED" && plan.reminders[0] && (
        <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm">
          <MSIcon name="notifications_active" className="text-amber-600" />
          <div>
            <div className="font-medium">
              {plan.reminders[0].requestedBy.fullName} hisobotni yakunlashni so&apos;radi ·{" "}
              <span className="font-normal text-muted-foreground">{formatDateTime(plan.reminders[0].createdAt)}</span>
            </div>
            {plan.reminders[0].message && <div className="mt-0.5">{plan.reminders[0].message}</div>}
          </div>
        </div>
      )}

      <Card className="p-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase">Maqsadi</div>
        <p className="mt-1 text-sm leading-relaxed">{plan.goal}</p>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "roadmap", label: "Rejalar", icon: "route", count: plan.items.length },
          { value: "agreements", label: "Kelishuvlar", icon: "handshake", count: plan.agreements.length },
          {
            value: "analysis",
            label: plan.analyses[0] ? `AI tahlil · ${plan.analyses[0].score}%` : "AI tahlil",
            icon: "auto_awesome",
          },
          { value: "history", label: "Tarix", icon: "history" },
        ]}
      />

      {tab === "roadmap" && <RoadmapTab plan={plan} onAddAgreement={(itemId) => setAgreementFor(itemId)} />}
      {tab === "agreements" && <AgreementsTab plan={plan} onAdd={() => setAgreementFor(null)} />}
      {tab === "analysis" && <AnalysisTab plan={plan} />}
      {tab === "history" && <HistoryTab plan={plan} />}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Safarni rad etish"
        description="Safar sababi bilan yaratuvchisiga qayta tahrirlash uchun qaytariladi"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              icon="undo"
              loading={action.isPending}
              disabled={rejectComment.trim().length < 5}
              onClick={() => {
                run("/reject", "Safar rad etildi va tuzuvchiga qaytarildi", { comment: rejectComment });
                setRejectOpen(false);
                setRejectComment("");
              }}
            >
              Rad etish
            </Button>
          </>
        }
      >
        <Field label="Rad etish sababi" required hint="Tuzuvchi nimani tuzatishi kerakligini aniq yozing">
          <Textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={4} autoFocus />
        </Field>
      </Dialog>

      <Dialog
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        title="Hisobotni yakunlashni so'rash"
        description="Safar muallifi va uning tashkilotidagi hamkasblari eslatmani safar sahifasida, menyuda va dashboardda ko'radi"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemindOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              icon="send"
              loading={action.isPending}
              onClick={() => {
                run("/remind", "Eslatma yuborildi", { message: remindMessage });
                setRemindOpen(false);
                setRemindMessage("");
              }}
            >
              Yuborish
            </Button>
          </>
        }
      >
        <Field label="Izoh" hint="Ixtiyoriy, masalan: 15-oktabrgacha yakunlang">
          <Textarea value={remindMessage} onChange={(e) => setRemindMessage(e.target.value)} rows={3} autoFocus />
        </Field>
      </Dialog>

      {agreementFor !== undefined && (
        <AgreementFormDialog
          open
          onClose={() => setAgreementFor(undefined)}
          onSaved={async (agreementId) => {
            setAgreementFor(undefined);
            await qc.invalidateQueries({ queryKey: ["plan", id] });
            toast("Kelishuv qo'shildi — endi asos hujjatlarini biriktiring");
            router.push(`/agreements/${agreementId}`);
          }}
          planId={plan.id}
          items={plan.items}
          defaultItemId={agreementFor}
        />
      )}
    </div>
  );
}
