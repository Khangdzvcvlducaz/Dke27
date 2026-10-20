#!/bin/bash
# Start both Next.js + realtime-sync service
echo "Starting realtime-sync service (port 3030)..."
cd mini-services/realtime-sync && bun run index.ts &
REALTIME_PID=$!
sleep 2

echo "Starting Next.js app (port 3000)..."
cd /app
bun run start &
APP_PID=$!

# Wait for either to exit
wait $REALTIME_PID $APP_PID
