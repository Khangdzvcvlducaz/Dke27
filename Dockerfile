FROM oven/bun:1.3 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY mini-services/realtime-sync/package.json ./mini-services/realtime-sync/
RUN bun install
RUN cd mini-services/realtime-sync && bun install

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mini-services/realtime-sync/node_modules ./mini-services/realtime-sync/node_modules
COPY . .
# Generate Prisma client (doesn't need DATABASE_URL)
RUN bun run db:generate
# Build Next.js (doesn't need database)
RUN bun run build
# Create db directory for runtime
RUN mkdir -p /app/db

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/db/custom.db

# Copy standalone Next.js build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files for db:push at runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/mini-services ./mini-services

# Copy start script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000
ENV PORT=3000

# At container start: run db:push (creates/migrates SQLite) then start both services
CMD ["sh", "-c", "bun run db:push && cd mini-services/realtime-sync && bun run index.ts & sleep 2 && exec node server.js"]
