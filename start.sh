#!/bin/sh
echo "=== START ==="
echo "DATABASE_URL=$DATABASE_URL"
echo "PWD=$(pwd)"

echo "=== check prisma ==="
ls -la node_modules/.bin/prisma 2>&1 || echo "prisma binary not found"

echo "=== db:push ==="
mkdir -p /app/db
node ./node_modules/prisma/build/index.js db push --accept-data-loss 2>&1
echo "db:push exit: $?"

echo "=== check db ==="
ls -la /app/db/ 2>&1

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec npx next start -p 3000
