#!/bin/sh
echo "=== db:push ==="
bun run db:push || true

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start ==="
exec bunx next start -p 3000
