#!/bin/sh
echo "=== db:push ==="
mkdir -p /app/db
bun run db:push 2>&1 || {
  echo "db:push failed, retrying in 3s..."
  sleep 3
  bun run db:push 2>&1 || echo "WARNING: db:push failed — DB might not be initialized"
}

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec bunx next start -p 3000
