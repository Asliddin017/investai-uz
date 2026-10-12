"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn, formatDateTime } from "@/lib/client";
import { useToast } from "@/components/providers";
import { PasswordForm } from "@/components/password-form";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, MSIcon, PageHeader, Spinner } from "@/components/ui";

type Theme = "LIGHT" | "DARK" | "SYSTEM";
type NameRequest = {
  id: string;
  oldName: string;
  newName: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: { fullName: string; username: string } | null;
};
type Profile = {
  nameRequests: NameRequest[];
  fullName: string;
  username: string;
  position: string | null;
  roleLabel: string;
  departmentName: string | null;
  theme: Theme;
  canRenameSelf: boolean;
  mustChangePassword: boolean;
};

const THEMES: { value: Theme; label: string; icon: string; hint: string }[] = [
  { value: "LIGHT", label: "Yorug'", icon: "light_mode", hint: "Oq fon" },
  { value: "DARK", label: "Qorong'i", icon: "dark_mode", hint: "Ko'zni charchatmaydi" },
  { value: "SYSTEM", label: "Tizimga mos", icon: "contrast", hint: "Kompyuter sozlamasiga qarab" },
];

function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile.fullName);
  const [position, setPosition] = useState(profile.position ?? "");
  const [theme, setTheme] = useState<Theme>(profile.theme);

  // Preview the theme immediately; leaving without saving restores the saved one.
  useEffect(() => {
    document.documentElement.dataset.theme = theme.toLowerCase();
  }, [theme]);
  useEffect(() => {
    const saved = profile.theme.toLowerCase();
    return () => {
      document.documentElement.dataset.theme = saved;
    };
  }, [profile.theme]);

  const save = useMutation({
    mutationFn: () => api("/profile", { method: "PUT", json: { position, theme, ...(profile.canRenameSelf ? { fullName } : {}) } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast("Profil saqlandi");
      router.refresh();
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <Card>
      <CardHeader title="Shaxsiy ma'lumotlar" icon="badge" />
      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {profile.canRenameSelf ? (
            <Field label="F.I.Sh." required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
          ) : (
            <Field label="F.I.Sh." hint="O'zgartirish uchun quyida so'rov yuboring">
              <Input value={profile.fullName} disabled />
            </Field>
          )}
          <Field label="Lavozimi">
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </Field>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Dastur rejimi</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={theme === t.value}
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors",
                  theme === t.value ? "border-primary bg-primary-soft" : "hover:bg-muted",
                )}
              >
                <MSIcon name={t.icon} className={theme === t.value ? "text-primary" : "text-muted-foreground"} />
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button icon="save" loading={save.isPending} onClick={() => save.mutate()}>
            Saqlash
          </Button>
        </div>
      </div>
    </Card>
  );
}

const REQUEST_STATUS: Record<NameRequest["status"], [string, string]> = {
  PENDING: ["Ko'rib chiqilmoqda", "bg-amber-100 text-amber-800"],
  APPROVED: ["Tasdiqlandi", "bg-emerald-100 text-emerald-800"],
  REJECTED: ["Rad etildi", "bg-red-100 text-red-700"],
  CANCELLED: ["Bekor qilindi", "bg-slate-100 text-slate-600"],
};

function NameRequestCard({ profile }: { profile: Profile }) {
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");
  const pending = profile.nameRequests.find((r) => r.status === "PENDING");
  const history = profile.nameRequests.filter((r) => r.status !== "PENDING");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["profile"] });
    router.refresh();
  };
  const submit = useMutation({
    mutationFn: () => api("/profile/name-requests", { method: "POST", json: { newName, reason } }),
    onSuccess: async () => {
      setNewName("");
      setReason("");
      await refresh();
      toast("So'rov administratorga yuborildi");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/profile/name-requests/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await refresh();
      toast("So'rov bekor qilindi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <Card>
      <CardHeader
        title="Ismni o'zgartirish"
        icon="edit_note"
        description="Ism tasdiqlash tarixida ko'rinadi, shuning uchun u administrator tasdig'idan keyin o'zgaradi"
      />
      <div className="space-y-4 p-5">
        {pending ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
            <div>
              <div className="font-medium">
                {pending.oldName} → {pending.newName}
              </div>
              <div className="text-xs text-muted-foreground">
                Yuborildi {formatDateTime(pending.createdAt)} · administrator ko&apos;rib chiqmoqda
              </div>
            </div>
            <Button size="sm" variant="ghost" icon="close" loading={cancel.isPending} onClick={() => cancel.mutate(pending.id)}>
              Bekor qilish
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Yangi F.I.Sh." required hint="Faqat lotin yoki faqat kirill harflari">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </Field>
              <Field label="Sabab" hint="Masalan: pasportdagi yozuvga moslash">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" icon="send" loading={submit.isPending} disabled={newName.trim().length < 3}>
                So&apos;rov yuborish
              </Button>
            </div>
          </form>
        )}
        {history.length > 0 && (
          <ul className="divide-y rounded-md border text-sm">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5">
                <div>
                  <div>
                    {r.oldName} → {r.newName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(r.reviewedAt ?? r.createdAt)}
                    {r.reviewer && ` · ${r.reviewer.fullName} @${r.reviewer.username}`}
                    {r.reviewComment && ` · ${r.reviewComment}`}
                  </div>
                </div>
                <Badge className={REQUEST_STATUS[r.status][1]}>{REQUEST_STATUS[r.status][0]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function PasswordCard() {
  return (
    <Card>
      <CardHeader title="Parolni o'zgartirish" icon="password" description="Boshqa qurilmalardagi kirishlar avtomatik yopiladi" />
      <div className="p-5">
        <PasswordCard />
      </div>
    </Card>
  );
}

export default function ProfilePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/profile") });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Profil" description="Shaxsiy ma'lumotlar, dastur rejimi va parol" />
      <Card className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-4 text-sm">
        <span>
          <span className="text-muted-foreground">Login:</span> <b className="font-mono">{data.username}</b>
        </span>
        <span>
          <span className="text-muted-foreground">Rol:</span> <b>{data.roleLabel}</b>
        </span>
        <span>
          <span className="text-muted-foreground">Tashkilot:</span> <b>{data.departmentName ?? "—"}</b>
        </span>
        <span className="w-full text-xs text-muted-foreground">
          Login, rol va tashkilotni administrator o&apos;zgartiradi; ism — so&apos;rov orqali.
        </span>
      </Card>
      <ProfileForm profile={data} />
      {!data.canRenameSelf && <NameRequestCard profile={data} />}
      <PasswordForm />
    </div>
  );
}
