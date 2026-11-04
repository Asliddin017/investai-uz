import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { canReviewUser } from "@/lib/name-requests";
import { isUnseen } from "@/lib/inbox";
import { planVisibilityWhere } from "@/lib/plans";

const NEW_REPORT_DAYS = 30;

type Task = {
  id: string;
  kind: "approve" | "new_report" | "fix" | "submit" | "results" | "close_report" | "close_agreement" | "attach_document" | "overdue" | "name_request";
  title: string;
  hint: string;
  href: string;
  urgent?: boolean;
};

/** Everything waiting on this user right now, most urgent first. */
export const GET = withUser(async ({ user }) => {
  const p = user.permissions;
  const tasks: Task[] = [];
  const mine: Prisma.PlanWhereInput = {
    OR: [{ creatorId: user.id }, ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])],
  };

  if (p.has("plan:approve")) {
    const pending = await db.plan.findMany({
      where: { status: "PENDING", creatorId: { not: user.id } },
      orderBy: { submittedAt: "asc" },
      select: { id: true, title: true, creator: { select: { fullName: true } } },
    });
    for (const plan of pending) {
      tasks.push({
        id: `approve-${plan.id}`,
        kind: "approve",
        title: plan.title,
        hint: `Tasdiqlang yoki rad eting · ${plan.creator?.fullName ?? ""}`,
        href: `/plans/${plan.id}`,
      });
    }
  }

  if (p.has("plan:approve")) {
    // A finished report is news until the approver opens the trip; older ones are no longer news.
    const since = new Date(Date.now() - NEW_REPORT_DAYS * 24 * 60 * 60 * 1000);
    const reported = await db.plan.findMany({
      where: {
        AND: [
          planVisibilityWhere(user),
          { status: { in: ["REPORTED", "COMPLETED"] }, reportedAt: { gte: since }, creatorId: { not: user.id } },
        ],
      },
      orderBy: { reportedAt: "desc" },
      select: {
        id: true,
        title: true,
        reportedAt: true,
        creator: { select: { fullName: true } },
        seenBy: { where: { userId: user.id }, select: { seenAt: true } },
      },
    });
    for (const plan of reported) {
      if (!isUnseen(plan.reportedAt, plan.seenBy[0]?.seenAt)) continue;
      tasks.push({
        id: `report-${plan.id}`,
        kind: "new_report",
        title: plan.title,
        hint: `Hisobot yakunlandi · ${plan.creator?.fullName ?? ""}`,
        href: `/plans/${plan.id}`,
      });
    }
  }

  if (p.has("plan:create")) {
    const own = await db.plan.findMany({
      where: { creatorId: user.id, status: { in: ["DRAFT", "REJECTED"] } },
      select: { id: true, title: true, status: true, rejectionReason: true },
    });
    for (const plan of own) {
      tasks.push(
        plan.status === "REJECTED"
          ? {
              id: `fix-${plan.id}`,
              kind: "fix",
              title: plan.title,
              hint: `Rad etildi — tuzatib qayta yuboring: ${plan.rejectionReason ?? ""}`,
              href: `/plans/${plan.id}`,
              urgent: true,
            }
          : { id: `submit-${plan.id}`, kind: "submit", title: plan.title, hint: "Qoralama — tayyor bo'lsa tasdiqqa yuboring", href: `/plans/${plan.id}` },
      );
    }
  }

  if (p.has("plan:report")) {
    const approved = await db.plan.findMany({
      where: { AND: [mine, { status: "APPROVED" }] },
      select: {
        id: true,
        title: true,
        endDate: true,
        items: { select: { result: true } },
        reminders: { where: { resolvedAt: null }, select: { id: true }, take: 1 },
      },
    });
    for (const plan of approved) {
      const tripOver = plan.endDate.getTime() < Date.now();
      const asked = plan.reminders.length > 0;
      if (!tripOver && !asked) continue;
      const left = plan.items.filter((i) => i.result === "PENDING").length;
      tasks.push(
        left > 0
          ? {
              id: `results-${plan.id}`,
              kind: "results",
              title: plan.title,
              hint: `${left} ta reja natijasini kiriting${asked ? " · kotibiyat so'radi" : ""}`,
              href: `/plans/${plan.id}`,
              urgent: asked,
            }
          : {
              id: `close-${plan.id}`,
              kind: "close_report",
              title: plan.title,
              hint: `Natijalar to'liq — «Hisobotni yakunlash»ni bosing${asked ? " · kotibiyat so'radi" : ""}`,
              href: `/plans/${plan.id}`,
              urgent: asked,
            },
      );
    }
  }

  // Fully done agreements get one clear next step, so they are not listed as overdue as well.
  const handled = new Set<string>();
  if (p.has("agreement:complete")) {
    const done = await db.agreement.findMany({
      where: { status: "ACTIVE", progress: { gte: 100 }, attachments: { some: {} }, plan: planVisibilityWhere(user) },
      orderBy: { deadline: "asc" },
      take: 20,
      select: { id: true, title: true, partner: true },
    });
    for (const a of done) {
      handled.add(a.id);
      tasks.push({
        id: `closing-${a.id}`,
        kind: "close_agreement",
        title: a.title,
        hint: `100% bajarildi — natijani qabul qilib yoping · ${a.partner}`,
        href: `/agreements/${a.id}`,
      });
    }
  }

  if (p.has("agreement:manage")) {
    // Only the author's side can attach files, and the approver cannot close without one.
    const undocumented = await db.agreement.findMany({
      where: {
        status: "ACTIVE",
        progress: { gte: 100 },
        attachments: { none: {} },
        plan: { AND: [mine, { status: { in: ["APPROVED", "REPORTED"] } }] },
      },
      orderBy: { deadline: "asc" },
      take: 20,
      select: { id: true, title: true },
    });
    for (const a of undocumented) {
      handled.add(a.id);
      tasks.push({
        id: `attach-${a.id}`,
        kind: "attach_document",
        title: a.title,
        hint: "100% bajarildi — yakunlash uchun asos hujjatini biriktiring",
        href: `/agreements/${a.id}`,
      });
    }
  }

  if (p.has("agreement:manage") || p.has("agreement:monitor")) {
    const overdue = await db.agreement.findMany({
      where: { status: "ACTIVE", deadline: { lt: new Date() }, plan: p.has("plan:view_all") ? {} : mine },
      orderBy: { deadline: "asc" },
      take: 20,
      select: { id: true, title: true, deadline: true },
    });
    for (const a of overdue) {
      if (handled.has(a.id)) continue;
      tasks.push({
        id: `overdue-${a.id}`,
        kind: "overdue",
        title: a.title,
        hint: `Muddati o'tgan (${a.deadline.toISOString().slice(0, 10)}) — holatini yangilang yoki yakunlang`,
        href: `/agreements/${a.id}`,
        urgent: true,
      });
    }
  }

  if (p.has("admin:users")) {
    const requests = await db.nameChangeRequest.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, role: true, departmentId: true } } },
    });
    for (const r of requests) {
      if (r.userId === user.id || !(await canReviewUser(user, r.user))) continue;
      tasks.push({
        id: `name-${r.id}`,
        kind: "name_request",
        title: `${r.oldName} → ${r.newName}`,
        hint: "Ismni o'zgartirish so'rovi",
        href: "/admin/users",
      });
    }
  }

  return tasks.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
});
