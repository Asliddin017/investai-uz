import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { agreementFolder, blobInfo, MAX_UPLOAD_BYTES, saveFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

const directUploads = z.object({
  blobs: z
    .array(z.object({ pathname: z.string().min(1).max(500), fileName: z.string().trim().min(1).max(255) }))
    .min(1)
    .max(20),
});

type NewFile = { fileName: string; url: string; size: number; mimeType: string };

/**
 * Attaches the documents that prove the agreement (contract scan, memorandum, protocol).
 * In production the browser has already put the files into Blob storage and sends their
 * paths as JSON; in local development the files come as multipart form data.
 */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.attach) throw forbidden("Hujjat biriktirishga ruxsat yo'q");

  const files: NewFile[] = [];
  if (req.headers.get("content-type")?.includes("application/json")) {
    const { blobs } = directUploads.parse(await req.json());
    for (const b of blobs) {
      if (!b.pathname.startsWith(agreementFolder(agreement.id)) || b.pathname.includes("..")) {
        throw badRequest("Noto'g'ri fayl manzili");
      }
      const info = await blobInfo(b.pathname);
      if (!info) throw badRequest(`"${b.fileName}" yuklanmagan`);
      files.push({ fileName: b.fileName, url: `blob:${b.pathname}`, size: info.size, mimeType: info.contentType || "application/octet-stream" });
    }
  } else {
    const form = await req.formData();
    const uploads = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (uploads.length === 0) throw badRequest("Fayl tanlanmagan");
    const tooBig = uploads.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) throw badRequest(`"${tooBig.name}" hajmi 20 MB dan oshmasin`);
    for (const file of uploads) {
      const url = await saveFile(file, agreementFolder(agreement.id).slice(0, -1));
      files.push({ fileName: file.name, url, size: file.size, mimeType: file.type || "application/octet-stream" });
    }
  }

  await db.attachment.createMany({
    data: files.map((f) => ({ agreementId: agreement.id, uploadedById: user.id, ...f })),
  });
  await audit(user, { action: "attachment.upload", entityType: "agreement", entityId: agreement.id, summary: `«${agreement.title}»ga hujjat: ${files.map((f) => f.fileName).join(", ")}` }, req);
  return { ok: true, count: files.length };
});
