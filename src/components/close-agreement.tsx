import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { useToast } from "./providers";
import { Button, Dialog, Field, Input } from "./ui";

export type CloseAs = "COMPLETED" | "CANCELLED";

/** Ends monitoring of an agreement: done (COMPLETED) or did not happen (CANCELLED). */
export function CloseAgreementDialog({
  agreementId,
  closeAs,
  onClose,
  onDone,
}: {
  agreementId: string;
  closeAs: CloseAs | null;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const close = useMutation({
    mutationFn: () => api(`/agreements/${agreementId}/status`, { method: "POST", json: { status: closeAs, note } }),
    onSuccess: async () => {
      setNote("");
      onClose();
      await onDone();
      await qc.invalidateQueries({ queryKey: ["plans"] });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      toast(closeAs === "COMPLETED" ? "Kelishuv yakunlandi" : "Kelishuv bekor qilindi");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <Dialog
      open={closeAs !== null}
      onClose={onClose}
      title={closeAs === "COMPLETED" ? "Kelishuvni yakunlash" : "Kelishuvni bekor qilish"}
      description={
        closeAs === "COMPLETED"
          ? "Kelishuv to'liq bajarildi — monitoring to'xtatiladi"
          : "Kelishuv amalga oshmadi — monitoring to'xtatiladi"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Orqaga
          </Button>
          <Button variant={closeAs === "COMPLETED" ? "success" : "destructive"} loading={close.isPending} onClick={() => close.mutate()}>
            Tasdiqlash
          </Button>
        </>
      }
    >
      <Field label="Izoh">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yakuniy natija yoki sabab" />
      </Field>
    </Dialog>
  );
}
