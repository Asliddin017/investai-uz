# syntax=docker/dockerfile:1

# ---------- deps: install node_modules (postinstall runs `prisma generate`) ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- builder: next build (standalone) ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The repo has no public/ folder; the runner copies it, so make sure it exists.
RUN npx prisma generate && npx next build && mkdir -p public

# ---------- tools: self-contained prisma CLI + tsx for migrate/seed at runtime ----------
FROM node:22-alpine AS tools
RUN apk add --no-cache libc6-compat openssl
WORKDIR /tools
COPY prisma ./prisma
# prisma/seed.ts imports ../src/lib/permissions and ../src/lib/ai (Gemini SDK + zod).
COPY src/lib ./src/lib
RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund prisma@6.19.3 @prisma/client@6.19.3 tsx@4 bcryptjs@3 zod@4 @google/genai@2.24.0 \
  && npx prisma generate --schema prisma/schema.prisma

# ---------- runner ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Attachments go to disk when BLOB_READ_WRITE_TOKEN is not set (src/lib/storage.ts).
ENV UPLOAD_DIR=/app/uploads

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Ensure the generated client + linux-musl engine are present even if file tracing missed them.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=tools --chown=nextjs:nodejs /tools /tools
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
# Owned by nextjs so a fresh named volume mounted here is writable.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
