"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, cn } from "@/lib/client";
import { useToast } from "@/components/providers";
import { Button, Card, CardHeader, ErrorBox, Field, Input, MSIcon, PageHeader, Spinner } from "@/components/ui";

type Theme = "LIGHT" | "DARK" | "SYSTEM";
type Profile = {
  fullName: string;
  username: string;
  position: string | null;
  roleLabel: string;
  departmentName: string | null;
  theme: Theme;
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
    mutationFn: () => api("/profile", { method: "PUT", json: { position, theme } }),
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
          <Field label="F.I.Sh." hint="Ismni administrator o'zgartiradi">
            <Input value={profile.fullName} disabled />
          </Field>
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

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const mismatch = repeat.length > 0 && next !== repeat;

  const save = useMutation({
    mutationFn: () =>
      api("/profile/password", { method: "PUT", json: { currentPassword: current, newPassword: next } }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setRepeat("");
      toast("Parol o'zgartirildi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <Card>
      <CardHeader title="Parolni o'zgartirish" icon="password" />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Joriy parol" required>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Yangi parol" required hint="Kamida 8 belgi">
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Yangi parolni takrorlang" required error={mismatch ? "Parollar mos emas" : null}>
            <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            icon="lock_reset"
            loading={save.isPending}
            disabled={!current || next.length < 8 || next !== repeat}
          >
            Parolni o&apos;zgartirish
          </Button>
        </div>
      </form>
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
          F.I.Sh., login, rol va tashkilotni faqat administrator o&apos;zgartiradi.
        </span>
      </Card>
      <ProfileForm profile={data} />
      <PasswordForm />
    </div>
  );
}
