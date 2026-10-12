"use client";

import Link from "next/link";
import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn, daysUntil, formatBytes, formatDate, formatDateTime, formatMoney } from "@/lib/client";
import type { AgreementDetail, PlanDetail } from "@/lib/types";
import { useToast } from "@/components/providers";
import { AgreementFormDialog } from "@/components/agreement-form";
import { AgreementStatusBadge, documentTypeLabel } from "@/components/status";
import {
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  MSIcon,
  ProgressBar,
  Spinner,
  Textarea,
} from "@/components/ui";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{children || "—"}</div>
    </div>
  );
}

export default function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [closeAs, setCloseAs] = useState<"COMPLETED" | "CANCELLED" | null>(null);
  const [closeNote, setCloseNote] = useState("");

  const { data: a, isLoading, error } = useQuery({
    queryKey: ["agreement", id],
    queryFn: () => api<AgreementDetail>(`/agreements/${id}`),
  });
  const plan = useQuery({
    queryKey: ["plan", a?.planId],
    queryFn: () => api<PlanDetail>(`/plans/${a!.planId}`),
    enabled: editOpen && !!a,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["agreement", id] });
    await qc.invalidateQueries({ queryKey: ["agreements"] });
    if (a) await qc.invalidateQueries({ queryKey: ["plan", a.planId] });
  };

  const addUpdate = useMutation({
    mutationFn: () =>
      api(`/agreements/${id}/updates`, { method: "POST", json: { note, progress: progress ?? a?.progress ?? 0 } }),
    onSuccess: async () => {
      setNote("");
      setProgress(null);
      await refresh();
      toast("Monitoring yozuvi qo'shildi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const upload = useMutation({
    mutationFn: (files: FileList) => {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      return api<{ count: number }>(`/agreements/${id}/attachments`, { method: "POST", body: form });
    },
    onSuccess: async (r) => {
      await refresh();
      toast(`${r.count} ta hujjat biriktirildi`);
    },
    onError: (e) => toast(e.message, "error"),
    onSettled: () => {
      if (fileInput.current) fileInput.current.value = "";
    },
  });

  const removeFile = useMutation({
    mutationFn: (fileId: string) => api(`/attachments/${fileId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await refresh();
      toast("Fayl o'chirildi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const close = useMutation({
    mutationFn: () => api(`/agreements/${id}/status`, { method: "POST", json: { status: closeAs, note: closeNote } }),
    onSuccess: async () => {
      setCloseAs(null);
      setCloseNote("");
      await refresh();
      await qc.invalidateQueries({ queryKey: ["plans"] });
      toast("Kelishuv holati yangilandi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  if (isLoading) return <Spinner />;
  if (error || !a) return <ErrorBox error={error} />;

  const left = daysUntil(a.deadline);
  const currentProgress = progress ?? a.progress;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href={`/plans/${a.plan.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <MSIcon name="arrow_back" className="text-[18px]" /> {a.plan.title}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
              <AgreementStatusBadge status={a.displayStatus} />
            </div>
            <div className="text-sm text-muted-foreground">
              {documentTypeLabel(a.documentType)} · {a.partner}
              {a.partnerCountry ? ` (${a.partnerCountry})` : ""} ·{" "}
              {a.planItem ? `${a.planItem.order}-band: ${a.planItem.title}` : "Rejadan tashqari yutuq"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.can.edit && (
              <Button variant="outline" icon="edit" onClick={() => setEditOpen(true)}>
                Tahrirlash
              </Button>
            )}
            {a.can.complete && (
              <>
                <Button variant="ghost" icon="block" onClick={() => setCloseAs("CANCELLED")}>
                  Bekor qilish
                </Button>
                <Button variant="success" icon="task_alt" onClick={() => setCloseAs("COMPLETED")}>
                  Yakunlash
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Hujjat raqami">{a.documentNumber}</Info>
              <Info label="Imzolangan">{formatDate(a.signedDate)}</Info>
              <Info label="Summa">{formatMoney(a.amount, a.currency)}</Info>
              <Info label="Amalga oshish muddati">
                {formatDate(a.deadline)}
                {a.status === "ACTIVE" && (
                  <span className={cn("ml-1.5 text-xs font-normal", left < 0 ? "text-destructive" : "text-muted-foreground")}>
                    ({left < 0 ? `${-left} kun o'tdi` : `${left} kun qoldi`})
                  </span>
                )}
              </Info>
              <Info label="Kiritgan">{a.createdBy.fullName}</Info>
              <Info label="Tashkilot">{a.plan.department?.name}</Info>
            </div>
            {a.description && <p className="mt-4 border-t pt-4 text-sm">{a.description}</p>}
            <div className="mt-4 border-t pt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium">Bajarilishi</span>
                <span className="tabular-nums">{a.progress}%</span>
              </div>
              <ProgressBar value={a.progress} className="h-2" />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Monitoring"
              icon="monitoring"
              description="Kelishuv muddati davomida bajarilayotgan ishlar — yakuniga qadar"
            />
            {a.can.monitor && (
              <div className="space-y-3 border-b bg-muted/20 p-5">
                <Field label="Bajarilgan ish">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Masalan: yer maydoni ajratildi, uskunalar yetkazib berildi"
                  />
                </Field>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={`Bajarilish: ${currentProgress}%`} className="min-w-[200px] flex-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={currentProgress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="w-full accent-[var(--primary)]"
                    />
                  </Field>
                  <Button
                    icon="add"
                    loading={addUpdate.isPending}
                    disabled={note.trim().length < 3}
                    onClick={() => addUpdate.mutate()}
                  >
                    Yozuv qo&apos;shish
                  </Button>
                </div>
              </div>
            )}
            {a.updates.length === 0 ? (
              <div className="p-5">
                <EmptyState icon="monitoring" title="Monitoring yozuvlari yo'q" />
              </div>
            ) : (
              <ol className="space-y-4 p-5">
                {a.updates.map((u) => (
                  <li key={u.id} className="flex gap-3">
                    <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-primary tabular-nums">
                      {u.progress}%
                    </div>
                    <div className="text-sm">
                      <div>{u.note}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {u.createdBy.fullName} · {formatDateTime(u.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader
            title="Asos hujjatlari"
            icon="attach_file"
            description="Shartnoma, memorandum, bayonnoma nusxalari"
          />
          {a.can.attach && (
            <div className="border-b p-4">
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)}
              />
              <Button
                variant="outline"
                className="w-full"
                icon="upload_file"
                loading={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                Hujjat biriktirish
              </Button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">PDF, rasm yoki Word · 20 MB gacha</p>
            </div>
          )}
          {a.attachments.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Hujjat biriktirilmagan</div>
          ) : (
            <ul className="divide-y">
              {a.attachments.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <MSIcon
                    name={f.mimeType.startsWith("image/") ? "image" : f.mimeType === "application/pdf" ? "picture_as_pdf" : "description"}
                    className="text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/v1/attachments/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium hover:underline"
                      title={f.fileName}
                    >
                      {f.fileName}
                    </a>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(f.size)} · {formatDate(f.createdAt)}
                    </div>
                  </div>
                  {a.can.attach && (
                    <button
                      onClick={() => confirm(`"${f.fileName}" o'chirilsinmi?`) && removeFile.mutate(f.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="O'chirish"
                    >
                      <MSIcon name="delete" className="text-[18px]" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={closeAs !== null}
        onClose={() => setCloseAs(null)}
        title={closeAs === "COMPLETED" ? "Kelishuvni yakunlash" : "Kelishuvni bekor qilish"}
        description={
          closeAs === "COMPLETED"
            ? "Kelishuv to'liq bajarildi — monitoring to'xtatiladi"
            : "Kelishuv amalga oshmadi — monitoring to'xtatiladi"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseAs(null)}>
              Orqaga
            </Button>
            <Button
              variant={closeAs === "COMPLETED" ? "success" : "destructive"}
              loading={close.isPending}
              onClick={() => close.mutate()}
            >
              Tasdiqlash
            </Button>
          </>
        }
      >
        <Field label="Izoh">
          <Input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Yakuniy natija yoki sabab" />
        </Field>
      </Dialog>

      {editOpen && plan.data && (
        <AgreementFormDialog
          open
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await refresh();
            toast("Kelishuv yangilandi");
          }}
          planId={a.planId}
          items={plan.data.items}
          agreement={a}
        />
      )}
    </div>
  );
}
