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
RUN bun run db:generate
RUN bun run db:push
RUN bun run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
ENV PORT=3000

# Run both Next.js + realtime service
CMD ["sh", "-c", "cd mini-services/realtime-sync && bun run index.ts & sleep 2 && exec node server.js"]
