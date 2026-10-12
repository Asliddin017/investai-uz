import { PrismaClient, type DepartmentType, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";
import { heuristicAnalysis } from "../src/lib/ai";

const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo12345!";

const DEPARTMENTS: { name: string; type: DepartmentType }[] = [
  { name: "Viloyat hokimligi apparati", type: "APPARAT" },
  { name: "Investitsiya bo'limi kotibiyati", type: "INVESTITSIYA_BOLIMI" },
  { name: "Investitsiyalar, sanoat va savdo boshqarmasi", type: "BOSHQARMA" },
  { name: "Qishloq xo'jaligi boshqarmasi", type: "BOSHQARMA" },
  { name: "Namuna tumani hokimligi", type: "TUMAN_HOKIMLIGI" },
  { name: "Namuna shahri hokimligi", type: "SHAHAR_HOKIMLIGI" },
];

const USERS: { username: string; fullName: string; role: Role; position: string; department: string }[] = [
  { username: "admin", fullName: "Tizim administratori", role: "SUPER_ADMIN", position: "Administrator", department: "Viloyat hokimligi apparati" },
  { username: "kotibiyat", fullName: "Karimov Akmal", role: "TASDIQLOVCHI", position: "Investitsiya bo'limi kotibiyat mudiri", department: "Investitsiya bo'limi kotibiyati" },
  { username: "orinbosar", fullName: "Rahimova Dilnoza", role: "ORINBOSAR", position: "Viloyat hokimi o'rinbosari", department: "Viloyat hokimligi apparati" },
  { username: "boshqarma", fullName: "Tursunov Jasur", role: "BOSHQARMA_BOSHLIGI", position: "Boshqarma boshlig'i", department: "Investitsiyalar, sanoat va savdo boshqarmasi" },
  { username: "tuman", fullName: "Yusupov Bekzod", role: "TUMAN_HOKIMI", position: "Tuman hokimi", department: "Namuna tumani hokimligi" },
  { username: "kuzatuvchi", fullName: "Nazarova Malika", role: "KUZATUVCHI", position: "Hokim yordamchisi", department: "Viloyat hokimligi apparati" },
];

const day = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * day);

async function seedReference() {
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const existing = await db.rolePermission.count({ where: { role: role as Role } });
    if (existing === 0) {
      await db.rolePermission.createMany({ data: perms.map((permission) => ({ role: role as Role, permission })) });
    }
  }
  const depts = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const row = await db.department.upsert({ where: { name: d.name }, update: {}, create: d });
    depts.set(d.name, row.id);
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = new Map<string, string>();
  for (const u of USERS) {
    const row = await db.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        position: u.position,
        departmentId: depts.get(u.department),
        passwordHash,
      },
    });
    users.set(u.username, row.id);
  }
  return { depts, users };
}

async function seedDemoPlans(users: Map<string, string>, depts: Map<string, string>) {
  if ((await db.plan.count()) > 0) return;
  const approver = users.get("kotibiyat")!;

  // 1. Finished trip with agreements under monitoring and an AI score.
  const boshqarma = users.get("boshqarma")!;
  const reported = await db.plan.create({
    data: {
      title: "Koreya Respublikasiga investitsiya safari",
      goal: "Tekstil va elektrotexnika sohasida qo'shma korxonalar tashkil etish uchun hamkorlar bilan kelishuvlar imzolash",
      country: "Koreya Respublikasi",
      city: "Seul",
      startDate: daysFromNow(-40),
      endDate: daysFromNow(-33),
      status: "REPORTED",
      version: 1,
      creatorId: boshqarma,
      departmentId: depts.get("Investitsiyalar, sanoat va savdo boshqarmasi"),
      approvedById: approver,
      submittedAt: daysFromNow(-55),
      approvedAt: daysFromNow(-50),
      reportedAt: daysFromNow(-30),
      items: {
        create: [
          { order: 1, title: "Tekstil klasteri bo'yicha muzokara", expectedResult: "Kamida 20 mln $ lik qo'shma korxona bo'yicha shartnoma", result: "ACHIEVED", resultNote: "25 mln $ lik shartnoma imzolandi" },
          { order: 2, title: "Elektrotexnika zavodi loyihasi", expectedResult: "Investitsiya memorandumi", result: "ACHIEVED", resultNote: "Memorandum imzolandi" },
          { order: 3, title: "Logistika markazi", expectedResult: "Texnik-iqtisodiy asoslash bo'yicha kelishuv", result: "NOT_ACHIEVED", failureReason: "Hamkor kompaniya qarorni keyingi chorakka qoldirdi" },
          { order: 4, title: "Kadrlar tayyorlash dasturi", expectedResult: "O'quv markazi bo'yicha bitim", result: "ACHIEVED", resultNote: "Bitim imzolandi" },
        ],
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });
  await db.planVersion.create({
    data: {
      planId: reported.id,
      version: 1,
      createdById: boshqarma,
      snapshot: {
        title: reported.title,
        goal: reported.goal,
        country: reported.country,
        city: reported.city,
        startDate: reported.startDate.toISOString(),
        endDate: reported.endDate.toISOString(),
        items: reported.items.map((i) => ({ order: i.order, title: i.title, expectedResult: i.expectedResult, dueDate: null })),
      },
    },
  });
  await db.planApproval.createMany({
    data: [
      { planId: reported.id, version: 1, action: "SUBMIT", userId: boshqarma, createdAt: daysFromNow(-55) },
      { planId: reported.id, version: 1, action: "APPROVE", userId: approver, createdAt: daysFromNow(-50) },
    ],
  });
  const [i1, i2, , i4] = reported.items;
  const a1 = await db.agreement.create({
    data: {
      planId: reported.id, planItemId: i1.id, title: "Tekstil qo'shma korxonasi", partner: "Hanseong Textile Co.",
      partnerCountry: "Koreya", documentType: "SHARTNOMA", documentNumber: "KR-2026-014", signedDate: daysFromNow(-36),
      amount: 25000000, currency: "USD", deadline: daysFromNow(20), progress: 45, createdById: boshqarma,
    },
  });
  await db.agreement.create({
    data: {
      planId: reported.id, planItemId: i2.id, title: "Elektrotexnika zavodi memorandumi", partner: "Daesung Electric",
      partnerCountry: "Koreya", documentType: "MEMORANDUM", signedDate: daysFromNow(-35), amount: 12000000,
      currency: "USD", deadline: daysFromNow(-5), progress: 30, createdById: boshqarma,
    },
  });
  await db.agreement.create({
    data: {
      planId: reported.id, planItemId: i4.id, title: "O'quv markazi bitimi", partner: "Korea Skills Institute",
      partnerCountry: "Koreya", documentType: "BITIM", signedDate: daysFromNow(-34), deadline: daysFromNow(60),
      progress: 10, createdById: boshqarma,
    },
  });
  await db.agreement.create({
    data: {
      planId: reported.id, title: "Mevali bog'lar uchun ko'chat yetkazib berish", partner: "Green Agro Korea",
      partnerCountry: "Koreya", documentType: "SHARTNOMA", signedDate: daysFromNow(-34), amount: 1500000,
      currency: "USD", deadline: daysFromNow(90), createdById: boshqarma,
      description: "Rejada yo'q edi — safar davomida qo'shimcha kelishildi",
    },
  });
  await db.agreementUpdate.createMany({
    data: [
      { agreementId: a1.id, note: "Yer maydoni ajratildi, loyiha hujjatlari tayyorlanmoqda", progress: 25, createdById: boshqarma, createdAt: daysFromNow(-20) },
      { agreementId: a1.id, note: "Uskunalar uchun birinchi to'lov amalga oshirildi", progress: 45, createdById: boshqarma, createdAt: daysFromNow(-6) },
    ],
  });
  const analysis = heuristicAnalysis({
    title: reported.title,
    goal: reported.goal,
    country: reported.country,
    items: reported.items.map((i) => ({
      order: i.order, title: i.title, expectedResult: i.expectedResult, result: i.result,
      resultNote: i.resultNote, failureReason: i.failureReason,
      agreements: i.result === "ACHIEVED" ? [{ title: "", partner: "", documentType: "", deadline: "" }] : [],
    })),
    extraAgreements: [{ title: "Mevali bog'lar uchun ko'chat yetkazib berish", partner: "Green Agro Korea", documentType: "Shartnoma" }],
  });
  await db.aiAnalysis.create({
    data: {
      planId: reported.id, score: analysis.score, summary: analysis.summary, model: analysis.model, createdById: boshqarma,
      details: { items: analysis.items, extraAchievements: analysis.extraAchievements, recommendations: analysis.recommendations },
    },
  });

  // 2. Waiting for approval.
  const tuman = users.get("tuman")!;
  const pending = await db.plan.create({
    data: {
      title: "Turkiyaga agrosanoat safari",
      goal: "Issiqxona majmuasi va meva qayta ishlash korxonasi uchun investor jalb qilish",
      country: "Turkiya", city: "Antaliya", startDate: daysFromNow(15), endDate: daysFromNow(20),
      status: "PENDING", version: 1, submittedAt: daysFromNow(-1), creatorId: tuman,
      departmentId: depts.get("Namuna tumani hokimligi"),
      items: {
        create: [
          { order: 1, title: "Issiqxona majmuasi", expectedResult: "10 ga issiqxona bo'yicha investitsiya shartnomasi" },
          { order: 2, title: "Meva qayta ishlash", expectedResult: "Qo'shma korxona bo'yicha memorandum" },
        ],
      },
    },
    include: { items: true },
  });
  await db.planVersion.create({
    data: {
      planId: pending.id, version: 1, createdById: tuman,
      snapshot: {
        title: pending.title, goal: pending.goal, country: pending.country, city: pending.city,
        startDate: pending.startDate.toISOString(), endDate: pending.endDate.toISOString(),
        items: pending.items.map((i) => ({ order: i.order, title: i.title, expectedResult: i.expectedResult, dueDate: null })),
      },
    },
  });
  await db.planApproval.create({ data: { planId: pending.id, version: 1, action: "SUBMIT", userId: tuman } });

  // 3. A draft.
  await db.plan.create({
    data: {
      title: "BAAga energetika safari",
      goal: "Quyosh elektr stansiyasi qurilishi uchun investitsiya kelishuvi",
      country: "Birlashgan Arab Amirliklari", city: "Abu-Dabi", startDate: daysFromNow(45), endDate: daysFromNow(49),
      creatorId: users.get("orinbosar")!, departmentId: depts.get("Viloyat hokimligi apparati"),
      items: { create: [{ order: 1, title: "Quyosh elektr stansiyasi", expectedResult: "100 MVt quvvatli QES bo'yicha shartnoma" }] },
    },
  });
}

async function main() {
  const { depts, users } = await seedReference();
  if (process.env.SEED_DEMO !== "0") await seedDemoPlans(users, depts);
  console.log(`Seed tayyor. Demo loginlar: ${USERS.map((u) => u.username).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
