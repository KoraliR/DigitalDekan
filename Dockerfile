# syntax=docker/dockerfile:1
# Производственный образ «Цифрового деканата» (Next.js 16 App Router + Prisma 6).
# Сборка: docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml build app
# Секреты в образ НЕ запекаются: переменные окружения приходят контейнеру из compose (env_file).
# На этапе build нужны только заглушки AUTH_SECRET и DATABASE_URL — реальная БД не требуется.

# ---------- 1. Зависимости ----------
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat — совместимость нативных модулей Next.js с musl,
# openssl — движки Prisma (query engine / schema engine).
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
# npm ci ставит и devDependencies (typescript, prisma, tailwind): они нужны для сборки,
# а prisma CLI остаётся в рантайме для `prisma migrate deploy`.
RUN npm ci

# ---------- 2. Сборка ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl tzdata
# Фиктивные значения только для сборки: код при `next build` в БД не ходит.
ENV NEXT_TELEMETRY_DISABLED=1 \
    AUTH_SECRET=build-only-secret \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/dekanat?schema=public \
    DEMO_2FA_ENABLED=false \
    TZ=Europe/Moscow
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- 3. Рантайм ----------
FROM node:22-alpine AS runner
WORKDIR /app
# tzdata нужен, чтобы TZ=Europe/Moscow понимали и libc, и Node.js.
RUN apk add --no-cache libc6-compat openssl tzdata
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Europe/Moscow \
    PORT=3000
# Непривилегированный пользователь (uid/gid 1001), контейнер работает не от root.
# Домашний каталог создаём и отдаём nextjs: npm/npx могут писать туда кеш.
RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs \
 && mkdir -p /home/nextjs \
 && chown nextjs:nodejs /home/nextjs
# Копируем только то, что нужно `next start`, `prisma migrate deploy` и CLI-скриптам.
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# lib/ обязателен: scripts/create-user.mjs импортирует ../lib/password.mjs.
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
# auth.ts и proxy.ts (proxy = middleware Next 16) уже скомпилированы в .next,
# но копируем исходники: next start читает их при загрузке конфигурации.
COPY --from=builder --chown=nextjs:nodejs /app/auth.ts ./auth.ts
COPY --from=builder --chown=nextjs:nodejs /app/proxy.ts ./proxy.ts
# Кеш ISR/изображений пишется в рантайме — каталог должен принадлежать nextjs.
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache
# Каталог для экспорта учётных записей: scripts/export-accounts.mjs пишет docs/ACCOUNTS.md
# и docs/accounts.csv, поэтому пустой /app/docs должен быть доступен пользователю nextjs
# (seed.sh затем копирует файлы на хост через `docker compose cp`).
RUN mkdir -p /app/docs && chown nextjs:nodejs /app/docs
USER nextjs
EXPOSE 3000
# Endpoint /api/health отвечает 200 только при живом приложении и доступной БД.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
# Миграции применяет compose-команда перед стартом приложения.
CMD ["npx", "next", "start", "-p", "3000"]
