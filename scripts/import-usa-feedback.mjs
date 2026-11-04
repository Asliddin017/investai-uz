// One-off: replaces test data with the real USA trip projects from feedback/*.xlsx.
//   node scripts/import-usa-feedback.mjs                 show what would change, write nothing
//   node scripts/import-usa-feedback.mjs --apply         back up to feedback/, then change the data
//   add --neon-http when port 5432 is blocked (Neon only: HTTPS, still one transaction)
// Uses DATABASE_URL from the environment. Never touches users, departments or the audit history.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { del } from "@vercel/blob";
import readXlsxFile from "read-excel-file/node";

const APPLY = process.argv.includes("--apply");
const NEON_HTTP = process.argv.includes("--neon-http");
const FEEDBACK_DIR = "feedback";

const PLAN_TITLE = "Toshkent viloyati delegatsiyasining AQShga investitsiya jalb qilish tashrifi";
const PLAN_END_DATE = "2025-11-15T00:00:00.000Z"; // Spreadsheet header: the trip ran 10–15 November 2025.
const TEST_PLAN_TITLES = ["Xitoy Xalq Respublikasiga investitsiya safari", "Parkent turizm - Xitoy tajribasi"];
const TEST_AGREEMENT_TITLES = ["resurs", "kelishuv"];
const DONE_STATUS = "Бажарилган";
const IN_PROGRESS_STATUS = "амалга оширилмоқда";

// The spreadsheet has no partner column; these are the companies named in each project's report.
const PARTNERS = {
  1: "Oppenheimer Holdings Inc",
  2: "CHORVOQ RESORT COMPLEX МЧЖ",
  3: "Oppenheimer Holdings Inc, Трастбанк ХАТБ",
  4: "Нишбаш Кўмир МЧЖ ХК",
  5: "EUROASIAN DEVELOPMENT PLUS МЧЖ",
  6: "CPF Ventures Inc",
  7: "CROSSOVER HEALTHCARE FUND LLC",
  8: "DUNE GROUP Development",
  9: "NEW YORK INVEST GROUP МЧЖ ХК",
  10: "Чорвоқ Ресорт Комплекс МЧЖ",
  11: "CKE Restaurants Holdings",
  12: "Pinkberry",
};

const normalize = (text) => String(text ?? "").replace(/\s+/g, " ").trim().replace(/\.$/, "");

function fail(message) {
  console.error(`TO'XTATILDI: ${message}`);
  process.exit(1);
}

function createBackend() {
  if (!NEON_HTTP) {
    const db = new PrismaClient();
    return {
      query: (sql, params = []) => db.$queryRawUnsafe(sql, ...params),
      transaction: (statements) => db.$transaction(statements.map((s) => db.$executeRawUnsafe(s.query, ...s.params))),
      close: () => db.$disconnect(),
    };
  }
  const url = new URL(process.env.DATABASE_URL);
  const connection = `postgresql://${url.username}:${url.password}@${url.hostname}${url.pathname}?sslmode=require`;
  const endpoint = `https://${url.hostname.replace(/^[^.]+\./, "api.")}/sql`;
  const post = async (body) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Neon-Connection-String": connection },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
  };
  return {
    query: async (sql, params = []) => (await post({ query: sql, params })).rows,
    transaction: (statements) => post({ queries: statements }),
    close: async () => {},
  };
}

async function readProjects() {
  const files = fs.readdirSync(FEEDBACK_DIR).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$"));
  if (files.length !== 1) fail(`${FEEDBACK_DIR}/ da bitta .xlsx bo'lishi kerak, topildi: ${files.length}`);
  const sheets = await readXlsxFile(path.join(FEEDBACK_DIR, files[0]));
  const rows = sheets[0]?.data ?? sheets;
  const projects = rows
    .filter((r) => Number.isInteger(r[0]))
    .map((r) => {
      const report = String(r[4] ?? "").trim();
      const firstLine = report.split("\n")[0];
      const done = firstLine.includes(DONE_STATUS);
      if (!done && !firstLine.includes(IN_PROGRESS_STATUS)) fail(`${r[0]}-loyiha holati noma'lum: ${firstLine.slice(0, 60)}`);
      if (!(r[3] instanceof Date) || typeof r[2] !== "number") fail(`${r[0]}-loyihada summa yoki muddat noto'g'ri`);
      return { order: r[0], title: normalize(r[1]), millions: r[2], deadline: r[3], report, done };
    });
  if (projects.length !== 12) fail(`12 ta loyiha kutilgan, topildi: ${projects.length}`);
  return projects;
}

async function dumpRows(query, table, column, ids) {
  if (ids.length === 0) return [];
  return query(`SELECT to_jsonb(t) AS row FROM "${table}" t WHERE t."${column}" = ANY($1::text::text[])`, [`{${ids.map((i) => `"${i}"`).join(",")}}`]);
}

async function main() {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL berilmagan");
  const backend = createBackend();
  const { query, transaction } = backend;
  try {
    const projects = await readProjects();

    const plans = await query(`SELECT id, "creatorId", "endDate"::text AS "endDate" FROM "Plan" WHERE title = $1::text`, [PLAN_TITLE]);
    if (plans.length !== 1) fail(`AQSh safari bitta bo'lishi kerak, topildi: ${plans.length}`);
    const plan = plans[0];

    const items = await query(`SELECT id, "order", title FROM "PlanItem" WHERE "planId" = $1::text ORDER BY "order"`, [plan.id]);
    for (const project of projects) {
      const item = items.find((i) => i.order === project.order);
      if (!item) fail(`${project.order}-band safarda yo'q`);
      if (normalize(item.title) !== project.title) fail(`${project.order}-band nomi Excel bilan farq qiladi: «${item.title}»`);
      project.itemId = item.id;
      project.title = item.title;
    }

    const existing = await query(`SELECT title FROM "Agreement" WHERE "planId" = $1::text`, [plan.id]);
    const repeated = existing.filter((a) => projects.some((p) => p.title === a.title));
    if (repeated.length > 0) fail(`Kelishuvlar allaqachon yuklangan (${repeated.length} ta) — qayta ishga tushirilmaydi`);
    const unknown = existing.filter((a) => !TEST_AGREEMENT_TITLES.includes(a.title));
    if (unknown.length > 0) fail(`Safarda ro'yxatda yo'q kelishuv bor: ${unknown.map((a) => a.title).join(", ")}`);

    const testPlans = await query(
      `SELECT p.id, p.title, (SELECT count(*)::int FROM "Agreement" a WHERE a."planId" = p.id) AS agreements
       FROM "Plan" p WHERE p.title = $1::text OR p.title = $2::text`,
      TEST_PLAN_TITLES,
    );
    const testAgreements = await query(`SELECT id, title FROM "Agreement" WHERE "planId" = $1::text`, [plan.id]);
    const planIds = testPlans.map((p) => p.id);
    const nested = planIds.length
      ? await query(`SELECT id FROM "Agreement" WHERE "planId" = ANY($1::text::text[])`, [`{${planIds.map((i) => `"${i}"`).join(",")}}`])
      : [];
    const agreementIds = [...testAgreements.map((a) => a.id), ...nested.map((a) => a.id)];
    const files = agreementIds.length
      ? await query(`SELECT id, "fileName", url FROM "Attachment" WHERE "agreementId" = ANY($1::text::text[])`, [`{${agreementIds.map((i) => `"${i}"`).join(",")}}`])
      : [];
    const [{ users: usersBefore }] = await query(`SELECT count(*)::int AS users FROM "User"`);

    const done = projects.filter((p) => p.done);
    console.log(`Baza: ${new URL(process.env.DATABASE_URL).hostname}`);
    console.log(`O'chiriladigan safarlar (${testPlans.length}): ${testPlans.map((p) => `«${p.title}»`).join(", ")}`);
    console.log(`AQSh safaridan o'chiriladigan kelishuvlar (${testAgreements.length}): ${testAgreements.map((a) => a.title).join(", ")}`);
    console.log(`O'chiriladigan fayllar (${files.length}): ${files.map((f) => f.fileName).join(", ")}`);
    console.log(`Safar tugash sanasi: ${plan.endDate} → ${PLAN_END_DATE.slice(0, 10)}`);
    console.log(`Qo'shiladigan kelishuvlar: 12 (${done.length} tasi 100%, ${12 - done.length} tasi 0%), jami ${projects.reduce((s, p) => s + p.millions, 0)} mln USD`);
    for (const p of projects) {
      console.log(`  ${String(p.order).padStart(2)}. ${p.done ? "100%" : "  0%"} ${String(p.millions).padStart(4)} mln  ${p.deadline.toISOString().slice(0, 10)}  ${PARTNERS[p.order]}`);
    }
    console.log(`Foydalanuvchilar: ${usersBefore} (tegilmaydi)`);

    if (!APPLY) {
      console.log("\nDRY-RUN: hech narsa o'zgarmadi. O'zgartirish uchun --apply qo'shing.");
      return;
    }

    const backup = { plan: await dumpRows(query, "Plan", "id", planIds) };
    for (const table of ["PlanItem", "PlanVersion", "PlanApproval", "AiAnalysis", "ReportReminder", "PlanSeen"]) {
      backup[table] = await dumpRows(query, table, "planId", planIds);
    }
    backup.Agreement = await dumpRows(query, "Agreement", "id", agreementIds);
    for (const table of ["Attachment", "AgreementUpdate", "AgreementSeen"]) {
      backup[table] = await dumpRows(query, table, "agreementId", agreementIds);
    }
    backup.usaPlanEndDate = plan.endDate;
    const backupPath = path.join(FEEDBACK_DIR, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\nZaxira: ${backupPath}`);

    const now = new Date().toISOString();
    const statements = [];
    for (const id of planIds) statements.push({ query: `DELETE FROM "Plan" WHERE id = $1::text`, params: [id] });
    for (const a of testAgreements) statements.push({ query: `DELETE FROM "Agreement" WHERE id = $1::text`, params: [a.id] });
    statements.push({
      query: `UPDATE "Plan" SET "endDate" = $1::text::timestamp, "updatedAt" = $2::text::timestamp WHERE id = $3::text`,
      params: [PLAN_END_DATE, now, plan.id],
    });
    for (const p of projects) {
      const agreementId = `imp${randomUUID().replace(/-/g, "")}`;
      const progress = String(p.done ? 100 : 0);
      statements.push({
        query: `INSERT INTO "Agreement" (id, "planId", "planItemId", title, partner, "documentType", amount, currency, deadline, status, progress, "createdById", "createdAt", "updatedAt")
                VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, 'BOSHQA'::"DocumentType", $6::text::numeric, 'USD', $7::text::timestamp, 'ACTIVE'::"AgreementStatus", $8::text::int, $9::text, $10::text::timestamp, $10::text::timestamp)`,
        params: [agreementId, plan.id, p.itemId, p.title, PARTNERS[p.order], String(p.millions * 1_000_000), p.deadline.toISOString(), progress, plan.creatorId, now],
      });
      statements.push({
        query: `INSERT INTO "AgreementUpdate" (id, "agreementId", note, progress, "createdById", "createdAt")
                VALUES ($1::text, $2::text, $3::text, $4::text::int, $5::text, $6::text::timestamp)`,
        params: [`imp${randomUUID().replace(/-/g, "")}`, agreementId, p.report, progress, plan.creatorId, now],
      });
    }
    statements.push({
      query: `INSERT INTO "AuditLog" (id, "actorLabel", action, "entityType", "entityId", summary, "createdAt")
              VALUES ($1::text, 'server buyrug''i (CLI)', 'data.import', 'plan', $2::text, $3::text, $4::text::timestamp)`,
      params: [
        `imp${randomUUID().replace(/-/g, "")}`,
        plan.id,
        `Excel'dan 12 ta kelishuv yuklandi; ${testPlans.length} ta sinov safari va ${testAgreements.length} ta sinov kelishuvi o'chirildi`,
        now,
      ],
    });
    await transaction(statements);

    for (const f of files) {
      if (!f.url.startsWith("blob:")) {
        console.log(`Fayl saqlash joyidan o'chirilmadi (blob emas): ${f.fileName}`);
        continue;
      }
      await del(f.url.slice(5)).then(
        () => console.log(`Fayl o'chirildi: ${f.fileName}`),
        (e) => console.log(`Fayl o'chirilmadi: ${f.fileName} — ${e.message}`),
      );
    }

    const [after] = await query(
      `SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Plan") AS plans,
              (SELECT count(*)::int FROM "Agreement" WHERE "planId" = $1::text) AS agreements,
              (SELECT count(*)::int FROM "AgreementUpdate" u JOIN "Agreement" a ON a.id = u."agreementId" WHERE a."planId" = $1::text) AS updates`,
      [plan.id],
    );
    console.log(`Natija: ${JSON.stringify(after)}`);
    if (after.users !== usersBefore) fail(`Foydalanuvchilar soni o'zgardi: ${usersBefore} → ${after.users}`);
  } finally {
    await backend.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
