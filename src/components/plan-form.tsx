"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toDateInput } from "@/lib/client";
import type { PlanDetail } from "@/lib/types";
import { useToast } from "./providers";
import { Button, Card, CardHeader, Field, Input, MSIcon, Textarea } from "./ui";

type ItemDraft = { key: number; title: string; expectedResult: string; dueDate: string };

let nextKey = 1;
const blankItem = (): ItemDraft => ({ key: nextKey++, title: "", expectedResult: "", dueDate: "" });

export function PlanForm({ plan }: { plan?: PlanDetail }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: plan?.title ?? "",
    goal: plan?.goal ?? "",
    country: plan?.country ?? "",
    city: plan?.city ?? "",
    startDate: toDateInput(plan?.startDate),
    endDate: toDateInput(plan?.endDate),
  });
  const [items, setItems] = useState<ItemDraft[]>(
    plan?.items.length
      ? plan.items.map((i) => ({
          key: nextKey++,
          title: i.title,
          expectedResult: i.expectedResult,
          dueDate: toDateInput(i.dueDate),
        }))
      : [blankItem()],
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const body = { ...form, items: items.map(({ key: _key, ...rest }) => rest) };
      const { id } = plan
        ? await api<{ id: string }>(`/plans/${plan.id}`, { method: "PUT", json: body })
        : await api<{ id: string }>("/plans", { method: "POST", json: body });
      if (submit) await api(`/plans/${id}/submit`, { method: "POST" });
      return { id, submit };
    },
    onSuccess: async ({ id, submit }) => {
      await qc.invalidateQueries({ queryKey: ["plans"] });
      await qc.invalidateQueries({ queryKey: ["plan", id] });
      toast(submit ? "Reja tasdiqlashga yuborildi" : "Reja saqlandi");
      router.push(`/plans/${id}`);
    },
    onError: (e) => setError(e.message),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setItem = (key: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(index, 1);
      next.splice(index + dir, 0, it);
      return next;
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate(false);
      }}
      className="space-y-6"
    >
      {plan?.status === "REJECTED" && plan.rejectionReason && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <MSIcon name="undo" className="text-destructive" />
          <div>
            <div className="font-medium text-destructive">Reja rad etilgan — tuzatib qayta yuboring</div>
            <div className="mt-0.5">{plan.rejectionReason}</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Asosiy ma'lumotlar" icon="description" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Reja nomi" required className="sm:col-span-2">
            <Input value={form.title} onChange={set("title")} placeholder="Masalan: Koreya Respublikasiga investitsiya safari" />
          </Field>
          <Field label="Maqsadi" required className="sm:col-span-2">
            <Textarea value={form.goal} onChange={set("goal")} rows={3} placeholder="Safar natijasida nimaga erishilishi kerak" />
          </Field>
          <Field label="Davlat" required>
            <Input value={form.country} onChange={set("country")} />
          </Field>
          <Field label="Shahar">
            <Input value={form.city} onChange={set("city")} />
          </Field>
          <Field label="Boshlanish sanasi" required>
            <Input type="date" value={form.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="Tugash sanasi" required>
            <Input type="date" value={form.endDate} onChange={set("endDate")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Yo'l xaritasi"
          description="Safarda erishilishi kerak bo'lgan har bir natija alohida band sifatida"
          icon="route"
          actions={
            <Button type="button" variant="outline" size="sm" icon="add" onClick={() => setItems((l) => [...l, blankItem()])}>
              Band qo&apos;shish
            </Button>
          }
        />
        <div className="divide-y">
          {items.map((item, index) => (
            <div key={item.key} className="flex gap-3 px-5 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {index + 1}
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_160px]">
                <Field label="Band nomi">
                  <Input value={item.title} onChange={(e) => setItem(item.key, { title: e.target.value })} />
                </Field>
                <Field label="Kutilgan natija">
                  <Input
                    value={item.expectedResult}
                    onChange={(e) => setItem(item.key, { expectedResult: e.target.value })}
                    placeholder="Masalan: 20 mln $ lik shartnoma"
                  />
                </Field>
                <Field label="Muddat">
                  <Input type="date" value={item.dueDate} onChange={(e) => setItem(item.key, { dueDate: e.target.value })} />
                </Field>
              </div>
              <div className="flex shrink-0 flex-col gap-1 pt-6">
                <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Yuqoriga">
                  <MSIcon name="arrow_upward" className="text-[18px]" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Pastga"
                >
                  <MSIcon name="arrow_downward" className="text-[18px]" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}
                  aria-label="O'chirish"
                >
                  <MSIcon name="delete" className="text-[18px] text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <MSIcon name="error" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Bekor qilish
        </Button>
        <Button type="submit" variant="outline" icon="save" loading={save.isPending && !save.variables}>
          Qoralama sifatida saqlash
        </Button>
        <Button
          type="button"
          icon="send"
          loading={save.isPending && save.variables === true}
          onClick={() => {
            setError(null);
            save.mutate(true);
          }}
        >
          Saqlash va tasdiqqa yuborish
        </Button>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        Tasdiqlangan rejani o&apos;zgartirib bo&apos;lmaydi. Har bir yuborilgan variant tarixda saqlanadi.
      </p>
    </form>
  );
}
