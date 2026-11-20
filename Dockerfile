FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build de la aplicación Next.js con output standalone
COPY . .
RUN npx next build

# Etapa final: servir con NGINX (muy liviano)
FROM nginx:alpine AS runner
COPY --from=builder /app/.next/standalone /usr/share/nginx/html
COPY --from=builder /app/.next/static /usr/share/nginx/html/static
COPY --from=builder /app/public /usr/share/nginx/html/public

# Exponer el puerto 80
EXPOSE 80

# Iniciar NGINX
CMD ["nginx", "-g", "daemon off;"]