import { upload } from "@vercel/blob/client";
import { api } from "./client";

const MAX_BYTES = 20 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "fayl";
}

/**
 * Attaches files to an agreement. With Blob storage the browser uploads each file
 * directly (no 4.5 MB function body limit) and then registers it; without it (local
 * development) the files go to the API as form data.
 */
export async function uploadAgreementFiles(agreementId: string, files: File[]) {
  const tooBig = files.find((f) => f.size > MAX_BYTES);
  if (tooBig) throw new Error(`"${tooBig.name}" hajmi 20 MB dan oshmasin`);

  const base = `/agreements/${agreementId}/attachments`;
  const { direct } = await api<{ direct: boolean }>(`${base}/upload-token`);
  if (!direct) {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return api<{ count: number }>(base, { method: "POST", body: form });
  }

  const blobs = [];
  for (const file of files) {
    const result = await upload(`agreements/${agreementId}/${safeName(file.name)}`, file, {
      access: "private",
      handleUploadUrl: `/api/v1${base}/upload-token`,
      multipart: file.size > 5 * 1024 * 1024,
    }).catch((e: Error) => {
      throw new Error(`"${file.name}" yuklanmadi: ${e.message}`);
    });
    blobs.push({ pathname: result.pathname, fileName: file.name });
  }
  return api<{ count: number }>(base, { method: "POST", json: { blobs } });
}
