#!/bin/bash
# Production start script — runs db:push + both services.
# Used by Railway (nixpacks [start].cmd) and Docker (CMD).
#
# Railway: set Start Command to "bash start.sh" in dashboard.
# Docker: CMD ["bash", "start.sh"]

# Step 1: Run Prisma db:push (creates/migrates SQLite database)
echo "=== Running db:push ==="
bun run db:push 2>&1 || echo "db:push failed (might be OK if DB already exists)"

# Step 2: Start realtime-sync service (Socket.io on port 3030) in background
echo "=== Starting realtime-sync (port 3030) ==="
(cd mini-services/realtime-sync && bun run index.ts) &
REALTIME_PID=$!

# Wait for realtime to start
sleep 2

# Step 3: Start Next.js production server (port 3000) in foreground
echo "=== Starting Next.js (port 3000) ==="
exec bun server.js
