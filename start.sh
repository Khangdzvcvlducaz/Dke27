#!/bin/sh
echo "=== ENV CHECK ==="
echo "DATABASE_URL=$DATABASE_URL"
echo "PORT=$PORT"
echo "node=$(which node 2>/dev/null || echo 'not found')"
echo "npx=$(which npx 2>/dev/null || echo 'not found')"
echo "bun=$(which bun 2>/dev/null || echo 'not found')"
echo "prisma=$(ls node_modules/.bin/prisma 2>/dev/null || echo 'not found')"

echo "=== db:push attempt 1 (npx) ==="
mkdir -p /app/db
npx prisma db push --accept-data-loss 2>&1 && echo "npx OK" || echo "npx FAILED"

echo "=== db:push attempt 2 (bunx) ==="
bunx prisma db push --accept-data-loss 2>&1 && echo "bunx OK" || echo "bunx FAILED"

echo "=== db:push attempt 3 (direct node) ==="
node node_modules/prisma/build/index.js db push --accept-data-loss 2>&1 && echo "node OK" || echo "node FAILED"

echo "=== db file check ==="
ls -la /app/db/ 2>&1 || echo "no db dir"

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec npx next start -p 3000
