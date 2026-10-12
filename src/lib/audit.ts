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

function clientIp(req?: Request) {
  const forwarded = req?.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : (req?.headers.get("x-real-ip") ?? null);
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
  "plan.create": "Reja yaratdi",
  "plan.update": "Rejani tahrirladi",
  "plan.delete": "Qoralamani o'chirdi",
  "plan.submit": "Tasdiqqa yubordi",
  "plan.approve": "Rejani tasdiqladi",
  "plan.reject": "Rejani rad etdi",
  "plan.item_result": "Band natijasini kiritdi",
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
