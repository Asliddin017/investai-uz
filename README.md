# InvestAI.uz — investitsiya safarlari monitoringi

Viloyat hokimligi uchun xorijiy investitsiya safarlarini rejadan kelishuv yakunigacha kuzatib boradigan tizim.

## Jarayon

1. **Reja tuziladi** — viloyat apparati o'rinbosarlari, boshqarma boshliqlari, tuman/shahar hokimlari kiritadi: nomi, maqsadi, muddati, yo'l xaritasi (bandlar).
2. **Tasdiqlanadi** — viloyat apparati investitsiya bo'limi kotibiyat mudiri tasdiqlaydi yoki sababini yozib rad etadi. Rad etilgan reja muallifga tahrirlash uchun qaytadi. Har yuborilgan variant tarixda o'zgarmas saqlanadi (v1 — dastlabki). Tasdiqlangan reja o'zgartirilmaydi.
3. **Safar natijalari** — har bir band: erishildi / erishilmadi (sababi bilan). Erishilgan kelishuvlar (shartnoma, memorandum, bitim) amalga oshish muddati va asos hujjatlari bilan biriktiriladi. Rejada yo'q kelishuv — qo'shimcha yutuq.
4. **AI tahlil** — hisobot yakunlanganda Claude reja bilan natija mosligini foizda baholaydi (`ANTHROPIC_API_KEY` bo'lmasa oddiy hisob-kitob ishlaydi).
5. **Kelishuv monitoringi** — muddat davomida bajarilgan ishlar yozib boriladi; barcha kelishuvlar yopilganda reja yakunlanadi.

Diagramma: [`docs/diagrams/umumiy.png`](docs/diagrams/umumiy.png).

## Ruxsatlar

`/admin/permissions` — uch daraja: **rol** → **tashkilot** → **foydalanuvchi** (eng aniq daraja ustun). Ruxsatlar katalogi: `src/lib/permissions.ts`.

| Rol | Asosiy huquqlar |
| --- | --- |
| Super Admin | hammasi |
| Kotibiyat mudiri (tasdiqlovchi) | barcha rejalarni ko'rish, tasdiqlash/rad etish, kelishuvni yakunlash |
| O'rinbosar, boshqarma boshlig'i, tuman/shahar hokimi | reja tuzish, natija va kelishuv kiritish, o'z tashkiloti rejalarini ko'rish |
| Kuzatuvchi | barcha rejalarni faqat ko'rish |

## Parolni tiklash

- **Oddiy xodim parolini unutsa:** administrator → Foydalanuvchilar → «Parolni tiklash». Tizim vaqtinchalik parolni bir marta ko'rsatadi; xodim kirgach o'z parolini qo'yadi. Parollar faqat shifrlangan (bcrypt) saqlanadi — hech kim, jumladan admin ham, ularni ko'ra olmaydi.
- **Yagona admin parolini unutsa:** ma'lumotlar bazasiga ulanish bor kompyuterda:

```bash
npm run user:reset-password -- admin                     # lokal baza (.env)
set -a; . ./.env.vercel; set +a; npm run user:reset-password -- admin   # production
```

Buyruq vaqtinchalik parolni chiqaradi va bu amal jurnalga yoziladi.

## Amallar jurnali

`/admin/audit` (`admin:audit` huquqi, standart: Super Admin) — kirishlar, rejalar, tasdiqlar, kelishuvlar, hujjatlar, foydalanuvchilar, parol va ruxsat o'zgarishlari: kim, qachon, qaysi IP'dan.

## Texnologiyalar

Next.js 15 (App Router, API routes) · TypeScript · Tailwind CSS 4 · Prisma + PostgreSQL · TanStack Query · Claude API (`@anthropic-ai/sdk`) · Vercel Blob (yopiq fayllar).

## Lokal ishga tushirish

```bash
docker run -d --name investai-postgres -e POSTGRES_USER=investai -e POSTGRES_PASSWORD=investai \
  -e POSTGRES_DB=investai -p 5434:5432 postgres:17-alpine
cp .env.example .env          # AUTH_SECRET ni 32+ belgili tasodifiy qatorga almashtiring
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Seed faqat rol ruxsatlari va `admin` foydalanuvchisini yaratadi (parol `Demo12345!`, `SEED_PASSWORD` bilan o'zgartiriladi). Demo bo'limlar, foydalanuvchilar (`kotibiyat`, `orinbosar`, `boshqarma`, `tuman`, `kuzatuvchi`) va rejalar kerak bo'lsa: `SEED_DEMO=1 npm run db:seed`.

## Muhit o'zgaruvchilari

| O'zgaruvchi | Vazifasi |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL ulanishi (pooled va to'g'ridan-to'g'ri) |
| `AUTH_SECRET` | sessiya imzosi, kamida 32 belgi |
| `ANTHROPIC_API_KEY` | AI moslik tahlili (ixtiyoriy) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — hujjatlar saqlanadi (Vercel'da majburiy, lokalda `uploads/`) |
| `SEED_PASSWORD`, `SEED_DEMO` | seed paroli; `SEED_DEMO=1` — demo bo'limlar, foydalanuvchilar va rejalar |

## Tekshiruvlar

```bash
npm test                                         # unit testlar
npm run typecheck && npm run lint
BASE_URL=http://localhost:3000 node scripts/smoke.mjs   # butun jarayon bo'yicha e2e
```

## Vercel

`vercel-build` skripti migratsiyalarni qo'llaydi va seed'ni ishga tushiradi (seed takroriy ishga tushirilsa ma'lumotni buzmaydi). Postgres (Neon) va Blob store loyihaga ulanishi kerak.
