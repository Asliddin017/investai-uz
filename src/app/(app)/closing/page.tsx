"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, daysUntil, formatDate } from "@/lib/client";
import { useSession } from "@/components/providers";
import { CloseAgreementDialog, type CloseAs } from "@/components/close-agreement";
import { isReadyToClose, useOpenAgreements } from "@/components/open-agreements";
import { AgreementStatusBadge, documentTypeLabel } from "@/components/status";
import { Button, Card, ClickableRow, EmptyState, ErrorBox, PageHeader, ProgressBar, Spinner } from "@/components/ui";

export default function ClosingPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const allowed = can("agreement:complete");
  const { data, isLoading, error } = useOpenAgreements(allowed);
  const [closing, setClosing] = useState<{ id: string; as: CloseAs } | null>(null);

  if (!allowed) return <ErrorBox error={new Error("Bu sahifa uchun ruxsat yo'q")} />;

  // Ready ones first, then by nearest deadline (the API already sorts by deadline).
  const rows = [...(data ?? [])].sort((a, b) => Number(isReadyToClose(b)) - Number(isReadyToClose(a)));

  return (
    <div>
      <PageHeader
        title="Yopiladigan kelishuvlar"
        description="Monitoringdagi kelishuvlar. To'liq bajarilgan yoki muddati o'tganlari yuqorida — natijasini qabul qilib yoping."
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !rows.length ? (
        <EmptyState icon="task_alt" title="Yakunlanadigan kelishuv yo'q" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Kelishuv</th>
                <th className="px-4 py-2.5 font-medium">Safar</th>
                <th className="px-4 py-2.5 font-medium">Muddat</th>
                <th className="w-40 px-4 py-2.5 font-medium">Bajarilishi</th>
                <th className="px-4 py-2.5 font-medium">Holati</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const left = daysUntil(a.deadline);
                return (
                  <ClickableRow
                    key={a.id}
                    href={`/agreements/${a.id}`}
                    className={cn("border-b last:border-0 hover:bg-muted/30", isReadyToClose(a) && "bg-amber-50/60")}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/agreements/${a.id}`} className="font-medium hover:text-primary hover:underline">
                        {a.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {documentTypeLabel(a.documentType)} · {a.partner}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/plans/${a.plan.id}`} className="hover:underline">
                        {a.plan.title}
                      </Link>
                      {a.plan.department && <div className="text-xs text-muted-foreground">{a.plan.department.name}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(a.deadline)}
                      <div className={cn("text-xs", left < 0 ? "text-destructive" : "text-muted-foreground")}>
                        {left < 0 ? `${-left} kun o'tdi` : `${left} kun qoldi`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={a.progress} />
                        <span className="text-xs tabular-nums">{a.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AgreementStatusBadge status={a.displayStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="success" icon="task_alt" onClick={() => setClosing({ id: a.id, as: "COMPLETED" })}>
                          Yakunlash
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="block"
                          title="Bekor qilish"
                          aria-label="Bekor qilish"
                          onClick={() => setClosing({ id: a.id, as: "CANCELLED" })}
                        />
                      </div>
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {closing && (
        <CloseAgreementDialog
          agreementId={closing.id}
          closeAs={closing.as}
          onClose={() => setClosing(null)}
          onDone={() => qc.invalidateQueries({ queryKey: ["agreements"] })}
        />
      )}
    </div>
  );
}
