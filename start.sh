#!/bin/sh
echo "=== db:push ==="
bun run db:push || true

echo "=== realtime ==="
cd mini-services/realtime-sync && bun run index.ts &

sleep 2
echo "=== next dev ==="
exec bun run dev:prod
