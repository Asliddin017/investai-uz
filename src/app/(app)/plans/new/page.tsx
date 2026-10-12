"use client";

import Link from "next/link";
import { PlanForm } from "@/components/plan-form";
import { useSession } from "@/components/providers";
import { ErrorBox, MSIcon, PageHeader } from "@/components/ui";

export default function NewPlanPage() {
  const { can } = useSession();
  if (!can("plan:create")) return <ErrorBox error={new Error("Safar yaratishga ruxsat yo'q")} />;
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={
          <Link href="/plans" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <MSIcon name="arrow_back" className="text-[18px]" /> Safarlar
          </Link>
        }
        title="Yangi safar"
        description="Nomi, maqsadi, muddati va safardagi rejalarni kiriting"
      />
      <PlanForm />
    </div>
  );
}
