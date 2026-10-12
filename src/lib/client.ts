import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fetch wrapper for /api/v1: JSON in/out, error message from the server, redirect on expired session. */
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
    window.location.href = "/login?reason=expired";
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "So'rov bajarilmadi");
  return data as T;
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(v: string | Date | null | undefined) {
  return v ? dateFmt.format(new Date(v)) : "—";
}

export function formatDateTime(v: string | Date | null | undefined) {
  return v ? dateTimeFmt.format(new Date(v)) : "—";
}

export function formatMoney(amount: number | null | undefined, currency?: string | null) {
  if (amount === null || amount === undefined) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(amount)}${currency ? ` ${currency}` : ""}`;
}

export function toDateInput(v: string | Date | null | undefined) {
  return v ? new Date(v).toISOString().slice(0, 10) : "";
}

export function daysUntil(v: string | Date) {
  return Math.ceil((new Date(v).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
