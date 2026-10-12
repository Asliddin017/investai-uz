"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatDateTime } from "@/lib/client";
import { useToast } from "./providers";
import { Button, Card, CardHeader, Dialog, Field, MSIcon, Textarea } from "./ui";

type PendingRequest = {
  id: string;
  oldName: string;
  newName: string;
  reason: string | null;
  createdAt: string;
  user: { id: string; username: string; fullName: string; department: { name: string } | null };
};

export function usePendingNameRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "name-requests", "PENDING"],
    queryFn: () => api<PendingRequest[]>("/admin/name-requests?status=PENDING"),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Pending name-change requests for an administrator to approve or reject. */
export function NameRequestsPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = usePendingNameRequests(true);
  const [rejecting, setRejecting] = useState<PendingRequest | null>(null);
  const [comment, setComment] = useState("");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "name-requests"] });
    await qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => api(`/admin/name-requests/${id}/approve`, { method: "POST", json: {} }),
    onSuccess: async () => {
      await refresh();
      toast("Ism o'zgartirildi");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const reject = useMutation({
    mutationFn: () => api(`/admin/name-requests/${rejecting!.id}/reject`, { method: "POST", json: { comment } }),
    onSuccess: async () => {
      setRejecting(null);
      setComment("");
      await refresh();
      toast("So'rov rad etildi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  if (!data?.length) return null;

  return (
    <Card className="mb-5">
      <CardHeader
        title={`Ismni o'zgartirish so'rovlari (${data.length})`}
        icon="edit_note"
        description="Login bo'yicha xodimni tekshirib, ism to'g'ri yozilganiga ishonch hosil qiling"
      />
      <ul className="divide-y">
        {data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="text-sm">
              <div>
                <span className="text-muted-foreground line-through">{r.oldName}</span>
                <MSIcon name="arrow_forward" className="mx-1.5 align-middle text-[16px] text-muted-foreground" />
                <b>{r.newName}</b>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">@{r.user.username}</span>
                {r.user.department && ` · ${r.user.department.name}`} · {formatDateTime(r.createdAt)}
                {r.reason && ` · Sabab: ${r.reason}`}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon="undo" className="text-destructive" onClick={() => setRejecting(r)}>
                Rad etish
              </Button>
              <Button
                size="sm"
                variant="success"
                icon="check"
                loading={approve.isPending && approve.variables === r.id}
                onClick={() => approve.mutate(r.id)}
              >
                Tasdiqlash
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="So'rovni rad etish"
        description={rejecting ? `${rejecting.oldName} → ${rejecting.newName}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              loading={reject.isPending}
              disabled={comment.trim().length < 3}
              onClick={() => reject.mutate()}
            >
              Rad etish
            </Button>
          </>
        }
      >
        <Field label="Sabab" required>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} autoFocus />
        </Field>
      </Dialog>
    </Card>
  );
}
