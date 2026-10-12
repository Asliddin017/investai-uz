import { db } from "@/lib/db";
import { forbidden, notFound, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { deleteFile, readFile } from "@/lib/storage";

type Params = { id: string };

const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

async function loadAttachment(id: string) {
  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) throw notFound("Fayl topilmadi");
  return attachment;
}

export const GET = withUser<Params>(async ({ user, params }) => {
  const attachment = await loadAttachment(params.id);
  await loadAgreementForUser(user, attachment.agreementId);
  const stream = await readFile(attachment.url);
  if (!stream) throw notFound("Fayl saqlash joyida topilmadi");
  // Uploaded content is untrusted: only types that cannot run script open in the browser;
  // anything else (HTML, SVG, ...) is forced to download as an opaque binary.
  const inline = INLINE_TYPES.has(attachment.mimeType);
  return new Response(stream, {
    headers: {
      "Content-Type": inline ? attachment.mimeType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; object-src 'self'; style-src 'unsafe-inline'",
      "Cache-Control": "private, no-store",
    },
  });
});

export const DELETE = withUser<Params>(async ({ user, params }) => {
  const attachment = await loadAttachment(params.id);
  const agreement = await loadAgreementForUser(user, attachment.agreementId);
  if (!serializeAgreement(user, agreement).can.attach) throw forbidden("Faylni o'chirishga ruxsat yo'q");
  await db.attachment.delete({ where: { id: attachment.id } });
  await deleteFile(attachment.url);
  return { ok: true };
});
