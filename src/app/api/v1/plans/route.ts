import type { PlanStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, withUser } from "@/lib/api";
import { planVisibilityWhere } from "@/lib/plans";
import { planInput } from "@/lib/schemas";
import { PLAN_STATUS_LABELS } from "@/lib/labels";

export const GET = withUser(async ({ req, user }) => {
  requirePermission(user, "nav:plans");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const mine = url.searchParams.get("mine") === "1";

  const filters: Prisma.PlanWhereInput[] = [planVisibilityWhere(user)];
  if (status && status in PLAN_STATUS_LABELS) filters.push({ status: status as PlanStatus });
  if (mine) filters.push({ creatorId: user.id });
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
        { goal: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const plans = await db.plan.findMany({
    where: { AND: filters },
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { id: true, fullName: true } },
      department: { select: { id: true, name: true } },
      items: { select: { result: true } },
      _count: { select: { agreements: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1, select: { score: true } },
    },
  });

  return plans.map(({ items, analyses, ...p }) => ({
    ...p,
    itemCount: items.length,
    achievedCount: items.filter((i) => i.result === "ACHIEVED").length,
    notAchievedCount: items.filter((i) => i.result === "NOT_ACHIEVED").length,
    score: analyses[0]?.score ?? null,
  }));
});

export const POST = withUser(async ({ req, user }) => {
  requirePermission(user, "plan:create");
  const data = planInput.parse(await req.json());
  const plan = await db.plan.create({
    data: {
      title: data.title,
      goal: data.goal,
      country: data.country,
      city: data.city,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      creatorId: user.id,
      departmentId: user.departmentId,
      items: {
        create: data.items.map((item, i) => ({
          order: i + 1,
          title: item.title,
          expectedResult: item.expectedResult,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
        })),
      },
    },
  });
  return { id: plan.id };
});
