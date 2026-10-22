#!/bin/sh
# Tables already created during Docker build (RUN npx prisma db push)
# No need to run db:push at runtime — just start the app

echo "=== realtime ==="
cd mini-services/realtime-sync && bun index.ts &

sleep 2
echo "=== next start (PORT=$PORT) ==="
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
