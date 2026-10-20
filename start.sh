#!/bin/bash
# Start script for production — runs db:push + both services
# Railway/Render/Fly.io all use this via CMD or [start].cmd

# Step 1: Run Prisma db:push (creates/migrates SQLite database)
echo "Running db:push..."
bun run db:push

# Step 2: Start realtime-sync service (Socket.io on port 3030) in background
echo "Starting realtime-sync (port 3030)..."
cd mini-services/realtime-sync
bun run index.ts &
REALTIME_PID=$!
cd ../..

# Wait for realtime to start
sleep 2

# Step 3: Start Next.js production server (port 3000) in foreground
echo "Starting Next.js (port 3000)..."
exec node server.js
