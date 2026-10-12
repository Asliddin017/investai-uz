import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Actor = { id: string; fullName: string; username: string } | { label: string } | null;

export type AuditEntry = {
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
};

/**
 * Client IP from the headers the hosting proxy sets (Vercel overwrites these, so a client
 * cannot forge them there). Elsewhere it is best-effort and must not be treated as proof.
 */
function clientIp(req?: Request) {
  const h = req?.headers;
  const ip = h?.get("x-vercel-forwarded-for") ?? h?.get("x-real-ip") ?? h?.get("x-forwarded-for")?.split(",").at(-1);
  return ip ? ip.trim().slice(0, 64) : null;
}

/**
 * Appends one line to the audit log. Never throws: a logging failure must not undo the
 * action it describes, so it is reported to the server log instead.
 */
export async function audit(actor: Actor, entry: AuditEntry, req?: Request) {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor && "id" in actor ? actor.id : null,
        actorLabel: !actor ? "tizim" : "id" in actor ? `${actor.fullName} (@${actor.username})` : actor.label,
        action: entry.action,
        summary: entry.summary,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        meta: entry.meta,
        ip: clientIp(req),
      },
    });
  } catch (err) {
    console.error("Audit yozuvi saqlanmadi:", entry.action, err);
  }
}

/** Uzbek labels for the audit page filter. */
export const AUDIT_ACTIONS: Record<string, string> = {
  "auth.login": "Tizimga kirdi",
  "auth.login_failed": "Kirish muvaffaqiyatsiz",
  "auth.logout": "Tizimdan chiqdi",
  "plan.create": "Safar yaratdi",
  "plan.update": "Safarni tahrirladi",
  "plan.delete": "Qoralamani o'chirdi",
  "plan.submit": "Tasdiqqa yubordi",
  "plan.approve": "Safarni tasdiqladi",
  "plan.reject": "Safarni rad etdi",
  "plan.item_result": "Reja natijasini kiritdi",
  "plan.report": "Hisobotni yakunladi",
  "plan.analyze": "AI tahlilni qayta ishga tushirdi",
  "plan.remind": "Hisobotni so'radi",
  "agreement.create": "Kelishuv qo'shdi",
  "agreement.update": "Kelishuvni tahrirladi",
  "agreement.progress": "Monitoring yozuvi qo'shdi",
  "agreement.close": "Kelishuvni yopdi",
  "attachment.upload": "Hujjat biriktirdi",
  "attachment.delete": "Hujjatni o'chirdi",
  "user.create": "Foydalanuvchi yaratdi",
  "user.update": "Foydalanuvchini tahrirladi",
  "user.password_reset": "Parolni tikladi",
  "profile.update": "Profilini o'zgartirdi",
  "profile.password_change": "Parolini o'zgartirdi",
  "name_request.create": "Ism so'rovini yubordi",
  "name_request.cancel": "Ism so'rovini bekor qildi",
  "name_request.approve": "Ism so'rovini tasdiqladi",
  "name_request.reject": "Ism so'rovini rad etdi",
  "department.create": "Tashkilot qo'shdi",
  "department.update": "Tashkilotni tahrirladi",
  "department.delete": "Tashkilotni o'chirdi",
  "permissions.roles": "Rol ruxsatlarini o'zgartirdi",
  "permissions.department": "Tashkilot ruxsatlarini o'zgartirdi",
  "permissions.user": "Foydalanuvchi ruxsatlarini o'zgartirdi",
};
