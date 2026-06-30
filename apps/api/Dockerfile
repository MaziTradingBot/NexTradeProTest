# NexTradePro API — production image
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies (includes prisma generate via postinstall)
COPY package.json ./
COPY prisma ./prisma
RUN npm install

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:migrate && node dist/server.js"]
