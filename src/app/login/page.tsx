"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Field, Input, MSIcon } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("reason") === "expired" ? "Sessiya muddati tugadi, qaytadan kiring" : null,
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", json: { username, password } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xatolik");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Login">
        <Input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label="Parol">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <MSIcon name="error" className="text-[18px]" />
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!username || !password}>
        Kirish
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
            <MSIcon name="travel_explore" />
          </div>
          <span className="text-lg font-semibold text-white">
            Invest<span className="text-accent">AI</span>.uz
          </span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl leading-tight font-semibold text-white">Xorijiy investitsiya safarlari monitoringi</h1>
          <p className="text-sm leading-relaxed text-sidebar-foreground/80">
            Safar rejalari tuziladi va tasdiqlanadi, natijalar hujjatlar bilan biriktiriladi, AI rejalar bilan natija
            mosligini baholaydi, kelishuvlar yakunigacha kuzatib boriladi.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">Viloyat hokimligi · Investitsiya bo&apos;limi</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Tizimga kirish</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Login va parolingizni kiriting</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
