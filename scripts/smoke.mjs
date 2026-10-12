// End-to-end smoke test of the whole plan → approval → report → agreement → monitoring flow.
// Usage: BASE_URL=http://localhost:3100 node scripts/smoke.mjs   (needs a seeded database)

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo12345!";

let failures = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "✔" : "✘"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}

async function login(username) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${username}: ${res.status}`);
  let cookie = res.headers.get("set-cookie").split(";")[0];
  return async (path, { method = "GET", json, body } = {}) => {
    const r = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: { cookie, ...(json ? { "Content-Type": "application/json" } : {}) },
      body: json ? JSON.stringify(json) : body,
    });
    const fresh = r.headers.getSetCookie().find((c) => c.startsWith("investai_session="));
    if (fresh) cookie = fresh.split(";")[0];
    const type = r.headers.get("content-type") ?? "";
    return { status: r.status, data: type.includes("json") ? await r.json() : await r.text() };
  };
}

const author = await login("boshqarma");
const approver = await login("kotibiyat");
const tuman = await login("tuman");
const admin = await login("admin");

// 1. Draft + submit
const planBody = {
  title: "Smoke: Germaniyaga safar",
  goal: "Mashinasozlik bo'yicha investitsiya kelishuvlari tuzish",
  country: "Germaniya",
  city: "Myunxen",
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  items: [
    { title: "Avtokomponent zavodi", expectedResult: "30 mln EUR shartnoma" },
    { title: "Texnopark", expectedResult: "Memorandum" },
  ],
};
let r = await author("/plans", { method: "POST", json: planBody });
check("muallif reja yaratadi", r.status === 200, r.status);
const planId = r.data.id;
r = await author(`/plans/${planId}/submit`, { method: "POST" });
check("tasdiqqa yuboradi", r.status === 200);

// 2. Author cannot approve own plan; another org cannot see it
r = await author(`/plans/${planId}/approve`, { method: "POST", json: {} });
check("muallif o'z rejasini tasdiqlay olmaydi", r.status === 403, r.status);
r = await tuman(`/plans/${planId}`);
check("boshqa tashkilot rejani ko'rmaydi", r.status === 403, r.status);

// 3. Reject → returned for editing
r = await approver(`/plans/${planId}/reject`, { method: "POST", json: { comment: "Summalarni aniqlashtiring" } });
check("kotibiyat mudiri rad etadi", r.status === 200);
r = await author(`/plans/${planId}`);
check("holat REJECTED, sabab saqlangan", r.data.status === "REJECTED" && r.data.rejectionReason === "Summalarni aniqlashtiring");
check("rad etilgan reja tahrirlanadi", r.data.can.edit === true);

// 4. Edit and resubmit → version 2, version 1 kept
r = await author(`/plans/${planId}`, {
  method: "PUT",
  json: { ...planBody, items: [...planBody.items, { title: "O'quv markazi", expectedResult: "Bitim" }] },
});
check("tahrirlash", r.status === 200, JSON.stringify(r.data));
await author(`/plans/${planId}/submit`, { method: "POST" });
r = await author(`/plans/${planId}`);
check("2-variant yaratildi", r.data.version === 2 && r.data.versions.length === 2);
check("dastlabki variant o'zgarmagan", r.data.versions[0].snapshot.items.length === 2 && r.data.versions[1].snapshot.items.length === 3);

// 5. Approve → frozen
r = await approver(`/plans/${planId}/approve`, { method: "POST", json: {} });
check("tasdiqlaydi", r.status === 200);
r = await author(`/plans/${planId}`, { method: "PUT", json: planBody });
check("tasdiqlangan reja o'zgarmaydi", r.status === 403, r.status);

// 6. Results
r = await author(`/plans/${planId}`);
const [i1, i2, i3] = r.data.items;
r = await author(`/plans/${planId}/report`, { method: "POST" });
check("natijasiz hisobot yakunlanmaydi", r.status === 400, r.data.error);
r = await author(`/plans/${planId}/items/${i2.id}/result`, { method: "PUT", json: { result: "NOT_ACHIEVED" } });
check("erishilmagan band sababsiz qabul qilinmaydi", r.status === 400);
await author(`/plans/${planId}/items/${i1.id}/result`, { method: "PUT", json: { result: "ACHIEVED", resultNote: "32 mln EUR" } });
await author(`/plans/${planId}/items/${i2.id}/result`, { method: "PUT", json: { result: "NOT_ACHIEVED", failureReason: "Hamkor muddatni surdi" } });
await author(`/plans/${planId}/items/${i3.id}/result`, { method: "PUT", json: { result: "ACHIEVED" } });

// 7. Agreement + documents + monitoring
r = await author(`/plans/${planId}/agreements`, {
  method: "POST",
  json: { planItemId: i1.id, title: "Avtokomponent zavodi shartnomasi", partner: "Bavaria Parts GmbH", documentType: "SHARTNOMA", amount: "32000000", currency: "EUR", deadline: "2027-02-01" },
});
check("kelishuv qo'shiladi", r.status === 200, JSON.stringify(r.data));
const agreementId = r.data.id;
const form = new FormData();
form.append("files", new Blob(["%PDF-1.4 smoke"], { type: "application/pdf" }), "shartnoma.pdf");
r = await author(`/agreements/${agreementId}/attachments`, { method: "POST", body: form });
check("asos hujjat biriktiriladi", r.status === 200, JSON.stringify(r.data));
r = await author(`/agreements/${agreementId}`);
const attachmentId = r.data.attachments[0]?.id;
check("hujjat ro'yxatda, ichki URL ochilmaydi", !!attachmentId && r.data.attachments[0].url === undefined);
r = await author(`/attachments/${attachmentId}`);
check("hujjat yuklab olinadi", r.status === 200 && String(r.data).startsWith("%PDF"));
r = await tuman(`/attachments/${attachmentId}`);
check("boshqa tashkilot hujjatni ololmaydi", r.status === 403, r.status);
r = await author(`/agreements/${agreementId}/updates`, { method: "POST", json: { note: "Yer ajratildi", progress: 30 } });
check("monitoring yozuvi", r.status === 200);

// 8. Report → AI analysis
r = await author(`/plans/${planId}/report`, { method: "POST" });
check("hisobot yakunlandi + AI tahlil", r.status === 200 && typeof r.data.score === "number", `score=${r.data.score}`);
r = await author(`/plans/${planId}`);
check("holat REPORTED, tahlil saqlangan", r.data.status === "REPORTED" && r.data.analyses.length === 1);

// 9. Close agreement → plan completed
r = await approver(`/agreements/${agreementId}/status`, { method: "POST", json: { status: "COMPLETED" } });
check("kotibiyat kelishuvni yakunlaydi", r.status === 200, JSON.stringify(r.data));
r = await author(`/plans/${planId}`);
check("barcha kelishuvlar yopilgach reja yakunlanadi", r.data.status === "COMPLETED", r.data.status);

// 10. Permission overrides take effect immediately
const users = (await admin("/admin/users")).data;
const tumanUser = users.find((u) => u.username === "tuman");
r = await admin(`/admin/permissions/users/${tumanUser.id}`, {
  method: "PUT",
  json: { overrides: [{ permission: "plan:create", state: "DENY", reason: "smoke test" }] },
});
check("admin shaxsiy inkor qo'yadi", r.status === 200);
r = await tuman("/plans", { method: "POST", json: planBody });
check("inkor qilingan foydalanuvchi reja yarata olmaydi", r.status === 403, r.status);
await admin(`/admin/permissions/users/${tumanUser.id}`, { method: "PUT", json: { overrides: [] } });
r = await tuman("/admin/permissions/roles");
check("oddiy foydalanuvchi ruxsatlar API'siga kira olmaydi", r.status === 403);
r = await admin("/admin/permissions/roles", { method: "PUT", json: { roles: { SUPER_ADMIN: [] } } });
r = await admin("/admin/permissions/roles");
check("Super Admin'dan qulflangan ruxsatlar olinmaydi", r.data.roles.SUPER_ADMIN.includes("admin:permissions"));
// restore the full Super Admin row
const catalog = (await admin("/admin/permissions/catalog")).data;
await admin("/admin/permissions/roles", { method: "PUT", json: { roles: { SUPER_ADMIN: catalog.permissions.map((p) => p.key) } } });

// 11. Security regressions
const adminUser = users.find((u) => u.username === "admin");
const approverUser = users.find((u) => u.username === "kotibiyat");
await admin(`/admin/permissions/users/${approverUser.id}`, {
  method: "PUT",
  json: { overrides: [{ permission: "admin:users", state: "GRANT" }] },
});
r = await approver("/admin/users", {
  method: "POST",
  json: { fullName: "Yangi super", username: "smoke-super", password: "Password123", role: "SUPER_ADMIN", isActive: true },
});
check("admin:users egasi Super Admin yarata olmaydi", r.status === 403, r.status);
r = await approver(`/admin/users/${adminUser.id}`, {
  method: "PUT",
  json: { fullName: adminUser.fullName, username: "admin", password: "Hijacked123", role: "SUPER_ADMIN", isActive: true },
});
check("admin:users egasi Super Admin parolini o'zgartira olmaydi", r.status === 403, r.status);
r = await approver("/admin/users", {
  method: "POST",
  json: { fullName: "Kuchli xodim", username: "smoke-strong", password: "Password123", role: "BOSHQARMA_BOSHLIGI", isActive: true },
});
check("o'zidan kuchli huquqli foydalanuvchi yaratilmaydi", r.status === 403, r.status);
await admin(`/admin/permissions/users/${approverUser.id}`, {
  method: "PUT",
  json: { overrides: [{ permission: "admin:permissions", state: "GRANT" }] },
});
r = await approver(`/admin/permissions/departments/${adminUser.departmentId}`, {
  method: "PUT",
  json: { overrides: [{ permission: "plan:approve", state: "DENY" }] },
});
check("Super Admin ishlaydigan tashkilot ruxsatini oddiy admin o'zgartira olmaydi", r.status === 403, r.status);
const tumanDept = users.find((u) => u.username === "tuman").departmentId;
r = await approver(`/admin/permissions/departments/${tumanDept}`, {
  method: "PUT",
  json: { overrides: [{ permission: "admin:departments", state: "GRANT" }] },
});
check("o'zida yo'q ruxsatni tashkilotga bera olmaydi", r.status === 403, r.status);
// A Super Admin denies plan:create to "tuman"; a lesser admin must not lift that deny.
await admin(`/admin/permissions/users/${tumanUser.id}`, {
  method: "PUT",
  json: { overrides: [{ permission: "plan:create", state: "DENY" }] },
});
r = await approver(`/admin/permissions/users/${tumanUser.id}`, { method: "PUT", json: { overrides: [] } });
check("oddiy admin o'zida yo'q ruxsat inkorini olib tashlay olmaydi", r.status === 403, r.status);
await admin(`/admin/permissions/departments/${tumanDept}`, {
  method: "PUT",
  json: { overrides: [{ permission: "plan:report", state: "DENY" }] },
});
r = await approver(`/admin/permissions/departments/${tumanDept}`, { method: "PUT", json: { overrides: [] } });
check("oddiy admin tashkilot inkorini olib tashlab huquq bera olmaydi", r.status === 403, r.status);
await admin(`/admin/permissions/departments/${tumanDept}`, { method: "PUT", json: { overrides: [] } });
await admin(`/admin/permissions/users/${tumanUser.id}`, { method: "PUT", json: { overrides: [] } });
await admin(`/admin/permissions/users/${approverUser.id}`, { method: "PUT", json: { overrides: [] } });

r = await admin(`/admin/permissions/departments/${adminUser.departmentId}`, {
  method: "PUT",
  json: { overrides: [{ permission: "admin:permissions", state: "DENY" }] },
});
check("admin o'z tashkilotiga inkor qo'yib o'zini bloklay olmaydi", r.status === 400, r.status);
r = await admin(`/admin/permissions/users/${adminUser.id}`, {
  method: "PUT",
  json: { overrides: [{ permission: "admin:permissions", state: "DENY" }] },
});
check("admin o'ziga shaxsiy inkor qo'ya olmaydi", r.status === 400, r.status);

// Uploaded HTML must never render on our origin
const reported = (await author("/agreements?status=ACTIVE")).data.find((a) => a.title === "O'quv markazi bitimi");
if (reported) {
  const f = new FormData();
  f.append("files", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "xss.html");
  await author(`/agreements/${reported.id}/attachments`, { method: "POST", body: f });
  const att = (await author(`/agreements/${reported.id}`)).data.attachments.find((x) => x.fileName === "xss.html");
  const raw = await fetch(`${BASE}/api/v1/attachments/${att.id}`, {
    headers: { cookie: (await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "boshqarma", password: PASSWORD }) })).headers.get("set-cookie").split(";")[0] },
  });
  check(
    "HTML fayl yuklab olishga majburlanadi",
    raw.headers.get("content-type") === "application/octet-stream" &&
      raw.headers.get("content-disposition").startsWith("attachment") &&
      raw.headers.get("x-content-type-options") === "nosniff",
    raw.headers.get("content-type"),
  );
  await author(`/attachments/${att.id}`, { method: "DELETE" });
}

// 12. Self-service profile
r = await tuman("/profile", { method: "PUT", json: { fullName: "Yusupov Bekzod Akmalovich", position: "Tuman hokimi", theme: "DARK" } });
check("xodim o'z profilini o'zgartiradi", r.status === 200);
r = await tuman("/profile");
check("profil saqlandi", r.data.fullName === "Yusupov Bekzod Akmalovich" && r.data.theme === "DARK");
r = await tuman("/profile", { method: "PUT", json: { fullName: "Yusupov Bekzod", position: "Tuman hokimi", theme: "LIGHT", role: "SUPER_ADMIN" } });
r = await admin("/admin/users");
check("profil orqali rol o'zgarmaydi", r.data.find((u) => u.username === "tuman").role === "TUMAN_HOKIMI");
const staleTuman = await login("tuman");
r = await tuman("/profile/password", { method: "PUT", json: { currentPassword: "noto'g'ri", newPassword: "YangiParol123" } });
check("noto'g'ri joriy parol bilan parol o'zgarmaydi", r.status === 400, r.status);
r = await tuman("/profile/password", { method: "PUT", json: { currentPassword: PASSWORD, newPassword: "YangiParol123" } });
check("parol o'zgaradi", r.status === 200, JSON.stringify(r.data));
const relog = await fetch(`${BASE}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "tuman", password: "YangiParol123" }),
});
check("yangi parol bilan kiradi", relog.status === 200);
r = await tuman("/profile");
check("parol almashgach joriy sessiya ishlaydi", r.status === 200, r.status);
r = await staleTuman("/profile");
check("parol almashgach boshqa sessiyalar bekor bo'ladi", r.status === 401, r.status);
r = await tuman("/profile", { method: "PUT", json: { fullName: "Karimov Akmal", theme: "LIGHT" } });
check("boshqa xodimning ismini olib bo'lmaydi", r.status === 400, r.status);
await tuman("/profile/password", { method: "PUT", json: { currentPassword: "YangiParol123", newPassword: PASSWORD } });

r = await approver("/dashboard");
check("dashboard ishlaydi", r.status === 200 && typeof r.data.plansByStatus === "object");

console.log(failures === 0 ? "\nHAMMASI O'TDI" : `\n${failures} ta tekshiruv O'TMADI`);
process.exit(failures === 0 ? 0 : 1);
