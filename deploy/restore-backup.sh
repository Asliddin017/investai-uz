#!/usr/bin/env bash
# Vercel backup'ini (Neon dump + Blob fayllar) serverdagi investai'ga tiklash.
# server-setup.sh dan KEYIN ishlatiladi.
#
#   sudo bash restore-backup.sh /tmp/investai.dump /tmp/investai-files
#
#   1-argument: Neon dump (pg_dump -Fc, PostgreSQL 18)
#   2-argument: Blob fayllar papkasi — ichida "agreements/<id>/<fayl>" (ixtiyoriy)
#               Bazadagi "blob:agreements/…" havolalari "local:agreements/…" ga o'tkaziladi (src/lib/storage.ts).
#
# ⚠️ Bazani TO'LIQ almashtiradi (DROP DATABASE). Serverdagi hozirgi investai ma'lumoti o'chadi.
set -euo pipefail

DUMP=${1:?"dump fayl yo'li: sudo bash restore-backup.sh /tmp/investai.dump /tmp/investai-files"}
FILES=${2:-}
DIR=/opt/investai

[ "$(id -u)" = 0 ] || { echo "❌ sudo bilan ishga tushiring"; exit 1; }
[ -f "$DUMP" ] || { echo "❌ $DUMP topilmadi"; exit 1; }
[ -z "$FILES" ] || [ -d "$FILES/agreements" ] || { echo "❌ $FILES ichida agreements/ papkasi yo'q"; exit 1; }
cd "$DIR"
[ -f compose.prod.yml ] || { echo "❌ avval server-setup.sh"; exit 1; }
DC="docker compose -f compose.prod.yml"
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)

read -rp "Serverdagi investai bazasi o'chirilib, backup tiklanadi. Davom etamizmi? [y/N] " go
[ "$go" = y ] || [ "$go" = Y ] || { echo "to'xtatildi"; exit 1; }

echo "⏸  app to'xtatilmoqda..."
$DC stop app

echo "🗄  baza qayta yaratilmoqda va tiklanmoqda..."
$DC exec -T db psql -U investai -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS investai WITH (FORCE)' -c 'CREATE DATABASE investai'
# --no-owner/--no-acl: Neon rollari serverda yo'q. Ogohlantirishlar bo'lishi mumkin — pastdagi sanoqni tekshiring.
$DC exec -T db pg_restore -U investai -d investai --no-owner --no-acl < "$DUMP" \
  || echo "⚠️  pg_restore ogohlantirish bilan tugadi (odatda 'schema public' — zararsiz). Sanoqni tekshiring:"

if [ -n "$FILES" ]; then
  echo "📎 fayllar uploads volume'ga ko'chirilmoqda..."
  docker run --rm -v investai_uploads:/dst -v "$(realpath "$FILES")":/src:ro alpine:3.20 \
    sh -c 'cp -a /src/. /dst/ && chown -R 1001:1001 /dst && echo "   diskda fayllar: $(find /dst -type f | wc -l)"'
  echo "🔗 bazadagi blob: havolalar local: ga o'tkazilmoqda..."
  $DC exec -T db psql -U investai -d investai -v ON_ERROR_STOP=1 -c \
    "UPDATE \"Attachment\" SET url = 'local:' || substr(url, 6) WHERE url LIKE 'blob:%'"
fi
$DC exec -T db psql -U investai -d investai -c \
  'SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Attachment") AS attachments, (SELECT count(*) FROM "Attachment" WHERE url LIKE '"'"'blob:%'"'"') AS still_blob, (SELECT count(*) FROM _prisma_migrations) AS migrations'

echo "▶️  ilova ishga tushmoqda (migrate deploy — yangi migratsiyalar bo'lsa qo'llanadi)..."
$DC up -d
for i in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 3
done
curl -fsS "http://127.0.0.1:$PORT/api/health" || { echo; echo "❌ health yo'q"; $DC logs --tail 50 app; exit 1; }
echo
echo "✅ tiklandi. Hamma qayta login qiladi (yangi domen + yangi AUTH_SECRET)."
