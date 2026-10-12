import { db } from "@/lib/db";
import { requirePermission, withUser } from "@/lib/api";
import { planVisibilityWhere } from "@/lib/plans";

export const GET = withUser(async ({ user }) => {
  requirePermission(user, "nav:dashboard");
  const planWhere = planVisibilityWhere(user);
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [statusGroups, items, agreementGroups, overdue, upcoming, pending, latestAnalyses, plansByDept] =
    await Promise.all([
      db.plan.groupBy({ by: ["status"], where: planWhere, _count: true }),
      db.planItem.groupBy({
        by: ["result"],
        where: { plan: { AND: [planWhere, { status: { in: ["APPROVED", "REPORTED", "COMPLETED"] } }] } },
        _count: true,
      }),
      db.agreement.groupBy({ by: ["status"], where: { plan: planWhere }, _count: true }),
      db.agreement.count({ where: { plan: planWhere, status: "ACTIVE", deadline: { lt: now } } }),
      db.agreement.findMany({
        where: { plan: planWhere, status: "ACTIVE", deadline: { gte: now, lte: in30days } },
        orderBy: { deadline: "asc" },
        take: 6,
        select: { id: true, title: true, partner: true, deadline: true, progress: true },
      }),
      user.permissions.has("plan:approve")
        ? db.plan.findMany({
            where: { status: "PENDING", creatorId: { not: user.id } },
            orderBy: { submittedAt: "asc" },
            take: 6,
            select: {
              id: true,
              title: true,
              country: true,
              submittedAt: true,
              version: true,
              creator: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
      db.aiAnalysis.findMany({
        where: { plan: planWhere },
        orderBy: { createdAt: "desc" },
        distinct: ["planId"],
        select: { planId: true, score: true },
      }),
      db.plan.findMany({
        where: { AND: [planWhere, { status: { in: ["REPORTED", "COMPLETED"] } }] },
        select: {
          id: true,
          department: { select: { name: true } },
          items: { select: { result: true } },
          _count: { select: { agreements: true } },
        },
      }),
    ]);

  const scoreByPlan = new Map(latestAnalyses.map((a) => [a.planId, a.score]));
  const deptStats = new Map<
    string,
    { name: string; plans: number; items: number; achieved: number; agreements: number; scores: number[] }
  >();
  for (const p of plansByDept) {
    const name = p.department?.name ?? "Tashkilot ko'rsatilmagan";
    const row = deptStats.get(name) ?? { name, plans: 0, items: 0, achieved: 0, agreements: 0, scores: [] };
    row.plans += 1;
    row.items += p.items.length;
    row.achieved += p.items.filter((i) => i.result === "ACHIEVED").length;
    row.agreements += p._count.agreements;
    const score = scoreByPlan.get(p.id);
    if (score !== undefined) row.scores.push(score);
    deptStats.set(name, row);
  }

  const scores = latestAnalyses.map((a) => a.score);
  return {
    plansByStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count])),
    itemsByResult: Object.fromEntries(items.map((g) => [g.result, g._count])),
    agreementsByStatus: Object.fromEntries(agreementGroups.map((g) => [g.status, g._count])),
    overdueAgreements: overdue,
    averageScore: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
    upcomingDeadlines: upcoming,
    pendingApprovals: pending,
    departments: [...deptStats.values()]
      .map(({ scores: s, ...row }) => ({
        ...row,
        averageScore: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null,
      }))
      .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1)),
  };
});
