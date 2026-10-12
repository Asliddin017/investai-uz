"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import type { PlanDetail } from "@/lib/types";
import { PlanForm } from "@/components/plan-form";
import { ErrorBox, MSIcon, PageHeader, Spinner } from "@/components/ui";

export default function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["plan", id],
    queryFn: () => api<PlanDetail>(`/plans/${id}`),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  if (!data.can.edit) {
    return <ErrorBox error={new Error("Bu safarni tahrirlab bo'lmaydi: u tasdiqlashda yoki allaqachon tasdiqlangan")} />;
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={
          <Link href={`/plans/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <MSIcon name="arrow_back" className="text-[18px]" /> Safarga qaytish
          </Link>
        }
        title="Safarni tahrirlash"
        description={data.title}
      />
      <PlanForm plan={data} />
    </div>
  );
}
