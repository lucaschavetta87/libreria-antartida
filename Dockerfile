# syntax=docker/dockerfile:1

# --- dependencias -------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# El build de Next necesita TypeScript y el resto de devDependencies.
RUN npm ci --no-audit --no-fund

# --- build --------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js inlinea NEXT_PUBLIC_* en el bundle en el momento del build.
ARG NEXT_PUBLIC_SUPABASE_URL=https://antartida.sistemasmendoza.com.ar
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_EUH9ifNYpstq4vmYEya9-g_Erp_geVx
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- runtime ------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Con output: 'standalone', Next genera server.js (no sirve con NGINX).
CMD ["node", "server.js"]
