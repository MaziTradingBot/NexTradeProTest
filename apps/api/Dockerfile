# NexTradePro API — production image
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies (includes prisma generate via postinstall)
COPY package.json ./
COPY prisma ./prisma
RUN npm install --include=dev

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
# Sync schema + seed (idempotent) on boot, then start the API.
CMD ["sh", "-c", "npx prisma db push && (npm run seed || echo seed-skipped) && node dist/server.js"]
