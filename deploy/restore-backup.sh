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
# Xavfsizlik:
#   1) backup avval vaqtinchalik "investai_incoming" bazasiga yuklanadi — sayt bu paytda ishlab turadi;
#   2) serverda OXIRGI TIKLASHDAN KEYIN yozilgan faollik (AuditLog) bo'lsa — u backup'da yo'q — «y» emas, "investai" deb
#      yozish talab qilinadi. Chegara vaqti backups/last-restore-max-created.txt da saqlanadi; qo'lda:
#      sudo SINCE='2026-10-22 13:42:33' bash restore-backup.sh …  (bo'lmasa — backup'dagi oxirgi faollik vaqti);
#   3) almashtirishdan oldin hozirgi baza /opt/investai/backups/before-restore-<vaqt>.dump ga saqlanadi.
#   Orqaga qaytarish: sudo bash /opt/investai/backups/restore-backup.sh /opt/investai/backups/before-restore-<vaqt>.dump
set -euo pipefail

DUMP=${1:?"dump fayl yo'li: sudo bash restore-backup.sh /tmp/investai.dump /tmp/investai-files"}
FILES=${2:-}
DIR=/opt/investai

[ "$(id -u)" = 0 ] || { echo "❌ sudo bilan ishga tushiring"; exit 1; }
[ -f "$DUMP" ] || { echo "❌ $DUMP topilmadi"; exit 1; }
[ -z "$FILES" ] || [ -d "$FILES/agreements" ] || { echo "❌ $FILES ichida agreements/ papkasi yo'q"; exit 1; }
DUMP=$(realpath "$DUMP")
cd "$DIR"
[ -f compose.prod.yml ] || { echo "❌ avval server-setup.sh"; exit 1; }
DC="docker compose -f compose.prod.yml"
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)
TS=$(date -u +%Y%m%dT%H%M%SZ)
BK="$DIR/backups"
SNAP="$BK/before-restore-$TS.dump"
RB="$BK/restore-backup.sh"   # skript nusxasi — /tmp dagisi o'chirilsa ham orqaga qaytarish ishlasin
MARK="$BK/last-restore-max-created.txt"   # oxirgi tiklangan ma'lumotdagi eng so'nggi createdAt
mkdir -p "$BK" && chmod 700 "$BK"
[ "$(realpath "$0")" = "$RB" ] || install -m 700 "$0" "$RB"

psql_in() { $DC exec -T db psql -U investai -v ON_ERROR_STOP=1 "$@"; }
# Bazadagi asosiy sonlar va oxirgi faollik vaqti (odam o'qishi uchun)
show() {
  psql_in -d "$1" -P footer=off <<'SQL'
SELECT (SELECT count(*) FROM "User") AS users,
       (SELECT count(*) FROM "Plan") AS plans,
       (SELECT count(*) FROM "Agreement") AS agreements,
       (SELECT count(*) FROM "Attachment") AS attachments,
       (SELECT max("createdAt") FROM "AuditLog") AS oxirgi_faollik;
SQL
}
drop_incoming() { psql_in -d postgres -c 'DROP DATABASE IF EXISTS investai_incoming WITH (FORCE)' >/dev/null; }

# 1) backup → vaqtinchalik baza (sayt ishlab turadi)
echo "📥 backup vaqtinchalik bazaga yuklanmoqda (sayt hali o'zgarmaydi)..."
drop_incoming
psql_in -d postgres -c 'CREATE DATABASE investai_incoming' >/dev/null
# --no-owner/--no-acl: Neon rollari serverda yo'q. Ogohlantirishlar bo'lishi mumkin — sanoqni tekshiring.
$DC exec -T db pg_restore -U investai -d investai_incoming --no-owner --no-acl < "$DUMP" \
  || echo "⚠️  pg_restore ogohlantirish bilan tugadi (odatda 'schema public' — zararsiz). Sanoqni tekshiring."

# 2) solishtirish: serverda oxirgi tiklashdan keyingi faollik — u backup'da yo'q va almashtirishda yo'qoladi
T=$(psql_in -d investai_incoming -At <<'SQL'
SELECT coalesce((SELECT max("createdAt") FROM "AuditLog"), 'epoch')::text;
SQL
)
# Chegara: SINCE (qo'lda) → oxirgi tiklash belgisi → backup'dagi oxirgi faollik
SINCE=${SINCE:-$(cat "$MARK" 2>/dev/null || true)}
[ -n "$SINCE" ] || SINCE=$T
NEWER=$(psql_in -d investai -At -v t="$SINCE" <<'SQL' 2>/dev/null
SELECT count(*) FROM "AuditLog" WHERE "createdAt" > :'t';
SQL
) || NEWER=0
case "$NEWER" in ''|*[!0-9]*) NEWER=0 ;; esac

echo
echo "📊 HOZIRGI server bazasi (almashtiriladi):"
show investai 2>/dev/null || echo "   (o'qib bo'lmadi — bo'sh baza)"
echo "📦 BACKUP (o'rniga keladi):"
show investai_incoming
echo

if [ "$NEWER" -gt 0 ]; then
  echo "🔴 DIQQAT: serverda $SINCE UTC dan KEYIN $NEWER ta audit yozuvi bor — bu ishlar serverning o'zida qilingan."
  echo "   Ular backup'da yo'q. Davom etsangiz saytdan yo'qoladi — faqat zaxira faylda qoladi."
  echo "   Odatda bu TO'XTASH kerak degani: kim serverda ishlaganini aniqlang."
  read -rp "   Baribir almashtirish uchun 'investai' deb yozing (boshqa javob — to'xtatish): " go
  [ "$go" = investai ] || { drop_incoming; echo "to'xtatildi — sayt va baza o'zgarmadi"; exit 1; }
else
  read -rp "Serverdagi baza backup bilan almashtiriladi. Davom etamizmi? [y/N] " go
  [ "$go" = y ] || [ "$go" = Y ] || { drop_incoming; echo "to'xtatildi — sayt va baza o'zgarmadi"; exit 1; }
fi

# fayllar diskka o'tadigan bo'lsa — havolalar vaqtinchalik bazada (sayt to'xtamasdan) o'zgartiriladi
if [ -n "$FILES" ]; then
  echo "🔗 blob: havolalar local: ga o'tkazilmoqda..."
  psql_in -d investai_incoming -c \
    "UPDATE \"Attachment\" SET url = 'local:' || substr(url, 6) WHERE url LIKE 'blob:%'"
fi

# 3) hozirgi bazani zaxiralash (app to'xtatilgach — yozuvlar yo'qolmasin)
echo "⏸  app to'xtatilmoqda..."
$DC stop app
echo "💾 hozirgi baza saqlanmoqda: $SNAP"
if ! $DC exec -T db pg_dump -U investai -d investai -Fc > "$SNAP" || [ ! -s "$SNAP" ]; then
  echo "❌ zaxira olinmadi — hech narsa almashtirilmadi, sayt eski bazada qayta yoqilmoqda"
  rm -f "$SNAP"; drop_incoming; $DC start app; exit 1
fi
chmod 600 "$SNAP"

# 4) almashtirish: eski baza o'chiriladi (zaxirasi bor), vaqtinchalik baza "investai" bo'ladi
echo "🔁 bazalar almashtirilmoqda..."
if ! psql_in -d postgres -c 'DROP DATABASE IF EXISTS investai WITH (FORCE)' \
                         -c 'ALTER DATABASE investai_incoming RENAME TO investai'; then
  echo "❌ almashtirishda xato. Qaytarish: sudo bash $RB $SNAP"; exit 1
fi
printf '%s
' "$T" > "$MARK"   # keyingi tiklash shu vaqtdan keyingi server yozuvlarini sanaydi
psql_in -d investai -c \
  'SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Attachment") AS attachments, (SELECT count(*) FROM "Attachment" WHERE url LIKE '"'"'blob:%'"'"') AS still_blob, (SELECT count(*) FROM _prisma_migrations) AS migrations'

if [ -n "$FILES" ]; then
  echo "📎 fayllar uploads volume'ga ko'chirilmoqda (mavjudlari o'chirilmaydi)..."
  docker run --rm -v investai_uploads:/dst -v "$(realpath "$FILES")":/src:ro alpine:3.20 \
    sh -c 'cp -a /src/. /dst/ && chown -R 1001:1001 /dst && echo "   diskda fayllar: $(find /dst -type f | wc -l)"'
fi

echo "▶️  ilova ishga tushmoqda (migrate deploy — yangi migratsiyalar bo'lsa qo'llanadi)..."
$DC up -d
for i in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 3
done
curl -fsS "http://127.0.0.1:$PORT/api/health" || { echo; echo "❌ health yo'q"; $DC logs --tail 50 app; echo "Qaytarish: sudo bash $RB $SNAP"; exit 1; }
echo
echo "✅ tiklandi. Hamma qayta login qiladi."
echo "↩️  Orqaga qaytarish kerak bo'lsa: sudo bash $RB $SNAP"
