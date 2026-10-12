"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn, formatDateTime } from "@/lib/client";
import { useSession, useToast } from "@/components/providers";
import { NameRequestsPanel } from "@/components/name-requests-panel";
import { Badge, Button, Card, Dialog, ErrorBox, Field, Input, MSIcon, PageHeader, Select, Spinner } from "@/components/ui";

type UserRow = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  position: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  departmentId: string | null;
  department: { name: string } | null;
  _count: { permissions: number; plans: number };
};

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "TASDIQLOVCHI", label: "Kotibiyat mudiri (tasdiqlovchi)" },
  { value: "ORINBOSAR", label: "Viloyat apparati o'rinbosari" },
  { value: "BOSHQARMA_BOSHLIGI", label: "Boshqarma boshlig'i" },
  { value: "TUMAN_HOKIMI", label: "Tuman/shahar hokimi" },
  { value: "KUZATUVCHI", label: "Kuzatuvchi" },
];
const roleLabel = (v: string) => ROLES.find((r) => r.value === v)?.label ?? v;

type FormState = {
  fullName: string;
  username: string;
  password: string;
  role: string;
  position: string;
  departmentId: string;
  isActive: boolean;
};

function UserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ id: string; name: string }[]>("/departments"),
  });
  const [form, setForm] = useState<FormState>({
    fullName: user?.fullName ?? "",
    username: user?.username ?? "",
    password: "",
    role: user?.role ?? "BOSHQARMA_BOSHLIGI",
    position: user?.position ?? "",
    departmentId: user?.departmentId ?? "",
    isActive: user?.isActive ?? true,
  });
  const save = useMutation({
    mutationFn: () =>
      user
        ? api(`/admin/users/${user.id}`, { method: "PUT", json: form })
        : api("/admin/users", { method: "POST", json: form }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast(user ? "Foydalanuvchi yangilandi" : "Foydalanuvchi qo'shildi");
      onClose();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={user ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="F.I.Sh." required className="sm:col-span-2">
          <Input value={form.fullName} onChange={set("fullName")} />
        </Field>
        <Field label="Login" required>
          <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} />
        </Field>
        <Field label={user ? "Yangi parol" : "Parol"} required={!user} hint={user ? "O'zgartirmaslik uchun bo'sh qoldiring" : "Kamida 8 belgi"}>
          <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        <Field label="Rol" required>
          <Select value={form.role} onChange={set("role")}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tashkilot">
          <Select value={form.departmentId} onChange={set("departmentId")}>
            <option value="">—</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lavozimi" className="sm:col-span-2">
          <Input value={form.position} onChange={set("position")} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Faol (tizimga kira oladi)
        </label>
      </div>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: () => api<{ password: string }>(`/admin/users/${user.id}/reset-password`, { method: "POST" }),
    onSuccess: (r) => setPassword(r.password),
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Parolni tiklash"
      description={`${user.fullName} (@${user.username})`}
      footer={
        password ? (
          <Button onClick={onClose}>Tayyor</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button icon="lock_reset" loading={reset.isPending} onClick={() => reset.mutate()}>
              Vaqtinchalik parol berish
            </Button>
          </>
        )
      }
    >
      {password ? (
        <div className="space-y-3 text-sm">
          <p>Vaqtinchalik parol — uni xodimga bering:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-center font-mono text-lg tracking-wider select-all">
              {password}
            </code>
            <Button
              variant="outline"
              icon="content_copy"
              onClick={() => navigator.clipboard.writeText(password).then(() => toast("Nusxa olindi"))}
            >
              Nusxa
            </Button>
          </div>
          <p className="text-muted-foreground">
            Bu parol faqat hozir ko&apos;rinadi. Xodim u bilan kirgach, tizim darhol o&apos;z parolini qo&apos;yishni
            so&apos;raydi. Uning boshqa qurilmalardagi kirishlari yopildi.
          </p>
        </div>
      ) : (
        <p className="text-sm">
          Xodim parolini unutgan bo&apos;lsa, unga vaqtinchalik parol beriladi. Eski parol ishlamay qoladi, birinchi kirishda
          xodim o&apos;z yangi parolini qo&apos;yadi. Amal jurnalga yoziladi.
        </p>
      )}
    </Dialog>
  );
}

export default function UsersPage() {
  const { can } = useSession();
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);
  const [q, setQ] = useState("");
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const { user: me } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<UserRow[]>("/admin/users"),
    enabled: can("admin:users"),
  });

  if (!can("admin:users")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;
  const rows = (data ?? []).filter((u) =>
    `${u.fullName} ${u.username} ${u.department?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Foydalanuvchilar"
        description="Tizim foydalanuvchilari, rollari va tashkilotlari"
        actions={
          <Button icon="person_add" onClick={() => setEditing(null)}>
            Foydalanuvchi qo&apos;shish
          </Button>
        }
      />
      <NameRequestsPanel />
      <div className="relative mb-4 max-w-sm">
        <MSIcon name="search" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[18px] text-muted-foreground" />
        <Input className="pl-9" placeholder="Qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">F.I.Sh.</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Tashkilot</th>
                <th className="px-4 py-2.5 font-medium">Oxirgi kirish</th>
                <th className="px-4 py-2.5 font-medium">Holati</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={cn("border-b last:border-0 hover:bg-muted/30", !u.isActive && "opacity-60")}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.fullName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{u.username}</div>
                  </td>
                  <td className="px-4 py-3">
                    {roleLabel(u.role)}
                    {u._count.permissions > 0 && (
                      <div className="text-xs text-amber-700">{u._count.permissions} ta shaxsiy ruxsat sozlamasi</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.department?.name ?? "—"}
                    {u.position && <div className="text-xs text-muted-foreground">{u.position}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <Badge className={u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
                      {u.isActive ? "Faol" : "O'chirilgan"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {u.id !== me.id && (
                      <Button size="sm" variant="ghost" icon="lock_reset" onClick={() => setResetting(u)}>
                        Parolni tiklash
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(u)}>
                      Tahrirlash
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {editing !== undefined && <UserDialog user={editing} onClose={() => setEditing(undefined)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}
