#!/bin/sh
echo "=== db:push ==="
mkdir -p /app/db
npx prisma db push --accept-data-loss 2>&1 || echo "db:push warning"

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec npx next start -p 3000
