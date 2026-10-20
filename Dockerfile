FROM oven/bun:1.3 AS base

# ─── Install ALL dependencies (including dev deps like prisma) ───
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY mini-services/realtime-sync/package.json ./mini-services/realtime-sync/
RUN bun install
RUN cd mini-services/realtime-sync && bun install

# ─── Build Next.js ───
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mini-services/realtime-sync/node_modules ./mini-services/realtime-sync/node_modules
COPY . .
ENV DATABASE_URL=file:/tmp/build.db
RUN bun run db:generate
RUN bun run build

# ─── Production image ───
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/db/custom.db
ENV PORT=3000

# Copy EVERYTHING needed — full node_modules (includes socket.io, prisma, etc.)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/mini-services ./mini-services

# Copy start script + custom server
COPY start.sh ./start.sh
COPY custom-server.js ./custom-server.js
RUN chmod +x ./start.sh

# Create db directory (Railway volume mounts here)
RUN mkdir -p /app/db

EXPOSE 3000

# Start: db:push creates SQLite, then custom-server runs Next.js + Socket.io on port 3000
CMD ["sh", "start.sh"]
