"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { useSession, useToast } from "@/components/providers";
import { Button, Card, Dialog, ErrorBox, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";

type Dept = {
  id: string;
  name: string;
  type: string;
  _count: { users: number; plans: number };
};

const TYPES = [
  { value: "APPARAT", label: "Viloyat apparati" },
  { value: "INVESTITSIYA_BOLIMI", label: "Investitsiya bo'limi" },
  { value: "BOSHQARMA", label: "Boshqarma" },
  { value: "TUMAN_HOKIMLIGI", label: "Tuman hokimligi" },
  { value: "SHAHAR_HOKIMLIGI", label: "Shahar hokimligi" },
];
const typeLabel = (v: string) => TYPES.find((t) => t.value === v)?.label ?? v;

function DeptDialog({ dept, onClose }: { dept: Dept | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(dept?.name ?? "");
  const [type, setType] = useState(dept?.type ?? "BOSHQARMA");
  const save = useMutation({
    mutationFn: () =>
      dept
        ? api(`/admin/departments/${dept.id}`, { method: "PUT", json: { name, type } })
        : api("/admin/departments", { method: "POST", json: { name, type } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      await qc.invalidateQueries({ queryKey: ["departments"] });
      toast("Saqlandi");
      onClose();
    },
    onError: (e) => toast(e.message, "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={dept ? "Tashkilotni tahrirlash" : "Yangi tashkilot"}
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
        <Field label="Nomi" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Turi" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

export default function DepartmentsPage() {
  const { can } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Dept | null | undefined>(undefined);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => api<Dept[]>("/admin/departments"),
    enabled: can("admin:departments"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/departments/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast("Tashkilot o'chirildi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  if (!can("admin:departments")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;

  return (
    <div>
      <PageHeader
        title="Tashkilotlar"
        description="Viloyat apparati, boshqarmalar, tuman va shahar hokimliklari"
        actions={
          <Button icon="add" onClick={() => setEditing(null)}>
            Tashkilot qo&apos;shish
          </Button>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nomi</th>
                <th className="px-4 py-2.5 font-medium">Turi</th>
                <th className="px-4 py-2.5 text-center font-medium">Xodimlar</th>
                <th className="px-4 py-2.5 text-center font-medium">Safarlar</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data?.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{typeLabel(d.type)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{d._count.users}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{d._count.plans}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(d)}>
                      Tahrirlash
                    </Button>
                    {d._count.users === 0 && d._count.plans === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="delete"
                        className="text-destructive"
                        onClick={() => confirm(`"${d.name}" o'chirilsinmi?`) && remove.mutate(d.id)}
                      >
                        O&apos;chirish
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {editing !== undefined && <DeptDialog dept={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
