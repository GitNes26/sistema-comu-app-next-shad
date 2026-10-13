# =============================================================
# COMU-APP — Imagen Docker (Next.js full-stack + Prisma/MySQL)
# =============================================================

# ---- Etapa 1: dependencias (cache de npm ci) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Prisma necesita OpenSSL para detectar su motor al generar el cliente.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# El postinstall del proyecto (prisma generate + copia del worker de pdf.js y la tipografía
# de los diplomas) necesita estos archivos ANTES de instalar; sin ellos `npm ci` falla.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
# DATABASE_URL de relleno: Prisma 7 la exige para cargar su configuración; no se conecta.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npm ci

# ---- Etapa 2: build (genera Prisma + compila Next) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* se inyectan en build time.
# NEXT_PUBLIC_VAPID_PUBLIC_KEY es necesaria para web push: se embebe en el bundle
# del cliente. Genera el par con: npx web-push generate-vapid-keys
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPPORT_WHATSAPP
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPPORT_WHATSAPP=$NEXT_PUBLIC_SUPPORT_WHATSAPP
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# DATABASE_URL de relleno: Prisma 7 la exige para cargar la configuración; no se conecta.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate
# Archivos estáticos que salen de node_modules (worker de pdf.js, tipografía de diplomas).
RUN node scripts/copy-pdfjs-worker.mjs
# DATABASE_URL de relleno: solo evita que alguna ruta intente leerla al compilar; no se conecta.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npm run build

# ---- Etapa 3: runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOADS_DIR=/app/public/uploads \
    UPLOADS_PROJECT=comu-app \
    SEED_DEMO=false

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/assets ./assets
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# Producción aplica migraciones versionadas (nunca `db push` ni resets) y el seed
# idempotente de producción (permisos, roles, menús, plan).
CMD ["sh", "-c", "\
  mkdir -p \"$UPLOADS_DIR/$UPLOADS_PROJECT\" && \
  npx prisma migrate deploy && \
  npm run db:seed && \
  npm run start"]
