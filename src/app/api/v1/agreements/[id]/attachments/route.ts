import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { MAX_UPLOAD_BYTES, saveFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

/** Attaches the documents that prove the agreement (contract scan, memorandum, protocol). */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.attach) throw forbidden("Hujjat biriktirishga ruxsat yo'q");

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw badRequest("Fayl tanlanmagan");
  const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
  if (tooBig) throw badRequest(`"${tooBig.name}" hajmi 20 MB dan oshmasin`);

  for (const file of files) {
    const url = await saveFile(file, `agreements/${agreement.id}`);
    await db.attachment.create({
      data: {
        agreementId: agreement.id,
        fileName: file.name,
        url,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedById: user.id,
      },
    });
  }
  await audit(user, { action: "attachment.upload", entityType: "agreement", entityId: agreement.id, summary: `«${agreement.title}»ga hujjat: ${files.map((f) => f.name).join(", ")}` }, req);
  return { ok: true, count: files.length };
});
