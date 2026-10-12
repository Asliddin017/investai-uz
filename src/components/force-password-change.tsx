"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useSession } from "./providers";
import { PasswordForm } from "./password-form";
import { Card, MSIcon } from "./ui";

/** Shown instead of the app after an administrator reset the password. */
export function ForcePasswordChange() {
  const router = useRouter();
  const { user } = useSession();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-4 flex items-start gap-3">
          <MSIcon name="lock_reset" className="text-[28px] text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Yangi parol qo&apos;ying</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.fullName}, siz administrator bergan vaqtinchalik parol bilan kirdingiz. Davom etish uchun o&apos;zingizga
              yangi parol o&apos;ylab toping.
            </p>
          </div>
        </div>
        <PasswordForm submitLabel="Saqlash va davom etish" onDone={() => router.refresh()} />
        <button
          className="mt-4 text-xs text-muted-foreground hover:text-foreground"
          onClick={async () => {
            await api("/auth/logout", { method: "POST" }).catch(() => undefined);
            router.replace("/login");
          }}
        >
          Chiqish
        </button>
      </Card>
    </div>
  );
}
