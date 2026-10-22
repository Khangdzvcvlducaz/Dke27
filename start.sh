#!/bin/sh
echo "=== seed staff ==="
node seed.js 2>&1 || echo "seed warning"

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start (PORT=$PORT) ==="
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
