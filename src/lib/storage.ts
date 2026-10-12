import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put, get, del, head } from "@vercel/blob";

/**
 * Attachments are private: stored either in a private Vercel Blob store
 * (when BLOB_READ_WRITE_TOKEN is set) or on local disk, and always served
 * through the authenticated download route.
 */
const LOCAL_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Where an agreement's documents live; uploads outside this prefix are refused. */
export const agreementFolder = (agreementId: string) => `agreements/${agreementId}/`;

/** Size and type of a blob the browser uploaded directly, or null if it is not there. */
export async function blobInfo(pathname: string) {
  const info = await head(pathname).catch(() => null);
  return info ? { size: info.size, contentType: info.contentType } : null;
}

function safeName(name: string) {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "fayl";
}

export async function saveFile(file: File, folder: string): Promise<string> {
  const key = `${folder}/${randomUUID()}-${safeName(file.name)}`;
  if (blobConfigured()) {
    const result = await put(key, file, { access: "private", contentType: file.type || undefined });
    return `blob:${result.pathname}`;
  }
  const target = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
  return `local:${key}`;
}

export async function readFile(ref: string): Promise<ReadableStream<Uint8Array> | null> {
  if (ref.startsWith("blob:")) {
    const result = await get(ref.slice(5), { access: "private" });
    return result?.statusCode === 200 ? result.stream : null;
  }
  if (ref.startsWith("local:")) {
    const target = path.join(LOCAL_DIR, ref.slice(6));
    if (!path.resolve(target).startsWith(path.resolve(LOCAL_DIR))) return null;
    try {
      const data = await fs.readFile(target);
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(data));
          controller.close();
        },
      });
    } catch {
      return null;
    }
  }
  return null;
}

export async function deleteFile(ref: string) {
  if (ref.startsWith("blob:")) await del(ref.slice(5)).catch(() => undefined);
  else if (ref.startsWith("local:")) await fs.rm(path.join(LOCAL_DIR, ref.slice(6)), { force: true });
}
