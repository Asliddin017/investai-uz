"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { useToast } from "./providers";
import { Button, Field, Input } from "./ui";

/** New password + confirmation; used on the profile page and on the forced-change screen. */
export function PasswordForm({ onDone, submitLabel = "Parolni o'zgartirish" }: { onDone?: () => void; submitLabel?: string }) {
  const toast = useToast();
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const mismatch = repeat.length > 0 && next !== repeat;

  const save = useMutation({
    mutationFn: () => api("/profile/password", { method: "PUT", json: { newPassword: next } }),
    onSuccess: () => {
      setNext("");
      setRepeat("");
      toast("Parol o'zgartirildi");
      onDone?.();
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Yangi parol" required hint="Kamida 8 belgi">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} autoFocus />
        </Field>
        <Field label="Yangi parolni takrorlang" required error={mismatch ? "Parollar mos emas" : null}>
          <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" icon="lock_reset" loading={save.isPending} disabled={next.length < 8 || next !== repeat}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
