"use client";

import { useSession } from "@/components/providers";
import { InboxList } from "@/components/inbox";
import { ErrorBox, PageHeader } from "@/components/ui";

export default function SubmittedPage() {
  const { can } = useSession();
  if (!can("plan:create")) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;
  return (
    <div>
      <PageHeader
        title="Yuborilganlar"
        description="Tasdiqlashga yuborgan safarlaringiz va ularning holati. Yangi javob kelganlari qizil bilan belgilangan."
      />
      <InboxList kind="submitted" emptyTitle="Hali tasdiqqa yuborilgan safar yo'q" emptyText="Safarni tasdiqqa yuborsangiz, shu yerda holatini kuzatasiz." />
    </div>
  );
}
