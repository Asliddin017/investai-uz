import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { SessionProvider } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <SessionProvider
      user={{
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role],
        position: user.position,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        permissions: [...user.permissions],
      }}
    >
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
