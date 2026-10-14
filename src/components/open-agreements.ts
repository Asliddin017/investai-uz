import { useQuery } from "@tanstack/react-query";
import { api, daysUntil } from "@/lib/client";
import type { AgreementListItem } from "@/lib/types";

/** Fully done or past its deadline — the approver should decide on it now. */
export function isReadyToClose(a: { progress: number; deadline: string }) {
  return a.progress >= 100 || daysUntil(a.deadline) < 0;
}

/** Agreements still under monitoring; shares its cache with the "Monitoringda" filter of the agreements page. */
export function useOpenAgreements(enabled: boolean) {
  return useQuery({
    queryKey: ["agreements", "ACTIVE", ""],
    queryFn: () => api<AgreementListItem[]>("/agreements?status=ACTIVE"),
    enabled,
  });
}
