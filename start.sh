#!/bin/sh
set -e

echo "=== 1/2 db:push ==="
bun run db:push 2>&1 || echo "(db:push warning — OK if DB exists)"

echo "=== 2/2 start server ==="
exec bun custom-server.js
