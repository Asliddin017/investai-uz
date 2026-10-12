"use client";

import { useState } from "react";
import { api, toDateInput } from "@/lib/client";
import type { AgreementDetail, PlanItem } from "@/lib/types";
import { DOCUMENT_TYPES } from "./status";
import { Button, Dialog, Field, Input, MSIcon, Select, Textarea } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  planId: string;
  items: Pick<PlanItem, "id" | "order" | "title" | "result">[];
  agreement?: AgreementDetail;
  defaultItemId?: string | null;
};

export function AgreementFormDialog({ open, onClose, onSaved, planId, items, agreement, defaultItemId }: Props) {
  const [form, setForm] = useState(() => ({
    planItemId: agreement?.planItemId ?? defaultItemId ?? "",
    title: agreement?.title ?? "",
    partner: agreement?.partner ?? "",
    partnerCountry: agreement?.partnerCountry ?? "",
    documentType: agreement?.documentType ?? "SHARTNOMA",
    documentNumber: agreement?.documentNumber ?? "",
    signedDate: toDateInput(agreement?.signedDate),
    amount: agreement?.amount?.toString() ?? "",
    currency: agreement?.currency ?? "USD",
    deadline: toDateInput(agreement?.deadline),
    description: agreement?.description ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, planItemId: form.planItemId || null };
      if (agreement) {
        await api(`/agreements/${agreement.id}`, { method: "PUT", json: body });
        onSaved(agreement.id);
      } else {
        const { id } = await api<{ id: string }>(`/plans/${planId}/agreements`, { method: "POST", json: body });
        onSaved(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={agreement ? "Kelishuvni tahrirlash" : "Erishilgan kelishuv qo'shish"}
      description="Shartnoma, memorandum yoki bitim. Asos hujjatlarni saqlangandan keyin biriktirasiz."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button icon="save" loading={saving} onClick={submit}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Reja"
          hint="Rejada yo'q, safarda qo'shimcha erishilgan kelishuv bo'lsa — «Rejadan tashqari»"
          className="sm:col-span-2"
        >
          <Select value={form.planItemId} onChange={set("planItemId")}>
            <option value="">Rejadan tashqari (qo&apos;shimcha yutuq)</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.order}. {i.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kelishuv nomi" required className="sm:col-span-2">
          <Input value={form.title} onChange={set("title")} />
        </Field>
        <Field label="Hamkor (kompaniya)" required>
          <Input value={form.partner} onChange={set("partner")} />
        </Field>
        <Field label="Hamkor davlati">
          <Input value={form.partnerCountry} onChange={set("partnerCountry")} />
        </Field>
        <Field label="Hujjat turi" required>
          <Select value={form.documentType} onChange={set("documentType")}>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hujjat raqami">
          <Input value={form.documentNumber} onChange={set("documentNumber")} />
        </Field>
        <Field label="Imzolangan sana">
          <Input type="date" value={form.signedDate} onChange={set("signedDate")} />
        </Field>
        <Field label="Amalga oshish muddati" required hint="Kelishuv shu sanagacha bajarilishi kerak">
          <Input type="date" value={form.deadline} onChange={set("deadline")} />
        </Field>
        <Field label="Summa">
          <Input type="number" min="0" step="any" value={form.amount} onChange={set("amount")} />
        </Field>
        <Field label="Valyuta">
          <Select value={form.currency} onChange={set("currency")}>
            {["USD", "EUR", "UZS", "CNY", "RUB", "KRW", "TRY", "AED"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Izoh" className="sm:col-span-2">
          <Textarea value={form.description} onChange={set("description")} rows={2} />
        </Field>
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
          <MSIcon name="error" className="text-[18px]" />
          {error}
        </div>
      )}
    </Dialog>
  );
}
