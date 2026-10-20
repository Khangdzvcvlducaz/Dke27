#!/bin/sh
echo "=== db init ==="
mkdir -p /app/db

# Try sqlite3 directly — bypasses Prisma CLI entirely
echo "=== sqlite3 schema ==="
sqlite3 /app/db/custom.db < db/schema.sql 2>&1 && echo "sqlite3 OK" || echo "sqlite3 FAILED"

# Also try prisma db push as backup
echo "=== prisma db push ==="
npx prisma db push --accept-data-loss 2>&1 && echo "prisma OK" || echo "prisma FAILED (sqlite3 should have created tables)"

echo "=== db check ==="
sqlite3 /app/db/custom.db ".tables" 2>&1 || echo "can't check tables"

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec npx next start -p 3000
