import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { badRequest, forbidden, withUser } from "@/lib/api";
import { loadAgreementForUser, serializeAgreement } from "@/lib/agreements";
import { agreementFolder, blobConfigured, MAX_UPLOAD_BYTES } from "@/lib/storage";

/**
 * Files go from the browser straight to Vercel Blob: a serverless function refuses
 * request bodies over 4.5 MB, which most scanned contracts and Word files exceed.
 * GET says whether direct upload is available (it is not in local development).
 */
export const GET = withUser<{ id: string }>(async () => ({ direct: blobConfigured() }));

/** Issues a short-lived upload token for one file of this agreement. */
export const POST = withUser<{ id: string }>(async ({ req, user, params }) => {
  const agreement = await loadAgreementForUser(user, params.id);
  if (!serializeAgreement(user, agreement).can.attach) throw forbidden("Hujjat biriktirishga ruxsat yo'q");
  if (!blobConfigured()) throw badRequest("Fayl ombori sozlanmagan");

  const body = (await req.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") throw badRequest("Noto'g'ri so'rov");
  return handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(agreementFolder(agreement.id)) || pathname.includes("..")) {
        throw badRequest("Noto'g'ri fayl manzili");
      }
      return { maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
    },
  });
});
