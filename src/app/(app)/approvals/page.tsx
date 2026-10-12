"use client";

import { useSession } from "@/components/providers";
import { InboxList } from "@/components/inbox";
import { ErrorBox, PageHeader } from "@/components/ui";

export default function ApprovalsPage() {
  const { can } = useSession();
  if (!can("plan:approve")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;
  return (
    <div>
      <PageHeader title="Tasdiqlash" description="Tasdiqlash uchun yuborilgan safarlar. Ochib ko'rilmaganlari qizil bilan belgilangan." />
      <InboxList kind="approvals" emptyTitle="Tasdiq kutayotgan safar yo'q" emptyText="Yangi safar yuborilsa, shu yerda paydo bo'ladi." />
    </div>
  );
}
