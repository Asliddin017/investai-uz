#!/usr/bin/env bash
# investai.gennis.uz — bir martalik server sozlash (GHCR + Watchtower auto-deploy).
# Idempotent: qayta ishga tushirsa bo'ladi, .env / baza / sertifikatni o'chirmaydi.
#
#   sudo bash server-setup.sh
#
# Oldindan: Cloudflare'da A yozuv (investai → server IP, Proxied) va
#           root uchun GHCR login: sudo docker login ghcr.io -u Mannopboy  (PAT: read:packages)
set -euo pipefail

NAME=investai
DOMAIN=investai.gennis.uz
IMAGE=ghcr.io/asliddin017/investai-uz:latest
DIR=/opt/$NAME
DEFAULT_PORT=8107

[ "$(id -u)" = 0 ] || { echo "❌ sudo bilan ishga tushiring"; exit 1; }
for c in docker openssl nginx ss; do command -v $c >/dev/null || { echo "❌ $c topilmadi"; exit 1; }; done

mkdir -p "$DIR"
cd "$DIR"

# 1) .env — faqat birinchi marta; sirlar shu yerda generatsiya qilinadi
if [ ! -f .env ]; then
  if ss -ltnH "sport = :$DEFAULT_PORT" | grep -q .; then
    echo "❌ port $DEFAULT_PORT band. Skriptdagi DEFAULT_PORT ni boshqa bo'sh portga almashtiring."; exit 1
  fi
  umask 077
  cat > .env <<EOF
APP_PORT=$DEFAULT_PORT
DB_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -hex 48)
# Bo'sh bazada "admin" login paroli (seed faqat yaratadi, mavjud parolni o'zgartirmaydi)
SEED_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=')
# Gemini (ixtiyoriy — bo'lmasa AI tahlil oddiy evristika bilan ishlaydi)
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-3.8-flash,gemini-3.6-flash
# Kelishuv hujjatlari mazmunini AI'ga yuborish (standart o'chiq — bepul tarifda Google foydalanishi mumkin)
# AI_READ_DOCUMENTS=true
EOF
  echo "✅ $DIR/.env yaratildi (chmod 600). Admin paroli: sudo grep SEED_PASSWORD $DIR/.env"
fi
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)

# 2) compose — har ishga tushirishda yangilanadi (manba: shu skript)
cat > compose.prod.yml <<'EOF'
name: investai

services:
  db:
    image: postgres:18-alpine   # Neon (Vercel) = PostgreSQL 18 — dump shu versiyaga tiklanadi
    restart: unless-stopped
    environment:
      POSTGRES_USER: investai
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD .env da yo'q}
      POSTGRES_DB: investai
    volumes:
      - pgdata:/var/lib/postgresql   # 18+: PGDATA = /var/lib/postgresql/18/docker
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U investai -d investai"]
      interval: 5s
      timeout: 5s
      retries: 10
    # watchtower scope yorlig'i YO'Q — Postgres o'zidan-o'zi yangilanmaydi

  app:
    image: ghcr.io/asliddin017/investai-uz:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file: .env
    environment:
      DATABASE_URL: postgresql://investai:${DB_PASSWORD}@db:5432/investai
      DIRECT_URL: postgresql://investai:${DB_PASSWORD}@db:5432/investai
    volumes:
      - uploads:/app/uploads
    ports:
      - "127.0.0.1:${APP_PORT:-8107}:3000"
    labels:
      com.centurylinklabs.watchtower.scope: investai

  watchtower:
    image: containrrr/watchtower:latest
    restart: unless-stopped
    command: --interval 120 --cleanup --scope investai
    environment:
      DOCKER_API_VERSION: "1.44"   # Docker 29.x: busiz Watchtower jim o'ladi (deploy standarti)
    labels:
      com.centurylinklabs.watchtower.scope: investai
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/.docker/config.json:/config.json:ro

volumes:
  pgdata:
  uploads:
EOF

# 3) image + ishga tushirish (entrypoint: migratsiya + admin seed + server)
if ! docker compose -f compose.prod.yml pull app; then
  echo "❌ $IMAGE tortilmadi. Root uchun GHCR login: sudo docker login ghcr.io -u Mannopboy"
  echo "   (yoki image hali qurilmagan: GitHub → Asliddin017/investai-uz → Actions)"; exit 1
fi
docker compose -f compose.prod.yml up -d

echo "⏳ ilova ko'tarilishini kutyapman (migratsiya + seed)..."
for i in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 3
done
curl -fsS "http://127.0.0.1:$PORT/api/health" || { echo; echo "❌ health yo'q"; docker compose -f compose.prod.yml logs --tail 50 app; exit 1; }
echo

# 4) nginx vhost — faqat yo'q bo'lsa (certbot keyin 443 blokini qo'shadi, ustidan yozmaymiz)
CONF=/etc/nginx/sites-available/$DOMAIN.conf
if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # bitta so'rovda bir nechta 20 MB fayl (Cloudflare bepul tarifi chegarasi — 100 MB)
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 180s;   # AI tahlil uzoq javob berishi mumkin
    }
}
EOF
  ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN.conf"
  nginx -t && systemctl reload nginx
  echo "✅ nginx: $CONF"
fi

# 5) TLS (Let's Encrypt) — DNS Cloudflare'da bo'lishi shart
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  if getent hosts "$DOMAIN" >/dev/null; then
    certbot --nginx -d "$DOMAIN" --redirect
  else
    echo "⚠️  $DOMAIN DNS'da yo'q — Cloudflare'da A yozuv qo'shib, skriptni qayta ishga tushiring."
  fi
fi

# 6) yakuniy tekshiruv
docker compose -f compose.prod.yml ps
echo "--- watchtower (Restarting / 'too old' bo'lmasin):"
docker compose -f compose.prod.yml logs --tail 5 watchtower
echo "✅ tayyor: https://$DOMAIN   (ichki: http://127.0.0.1:$PORT/api/health)"
echo "   Login: admin / parol: sudo grep SEED_PASSWORD $DIR/.env  — kirgach almashtiring"
