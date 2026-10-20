#!/bin/sh
echo "=== START ==="
echo "DATABASE_URL=$DATABASE_URL"
echo "PORT=$PORT"

echo "=== db:push ==="
mkdir -p /app/db
bunx prisma db push --accept-data-loss 2>&1
echo "db:push exit code: $?"

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec bunx next start -p 3000
