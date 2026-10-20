#!/bin/sh
# Production start script — runs db:push + Next.js + Socket.io on SAME port.
# Uses 'sh' (not 'bash') for maximum compatibility with minimal containers.
# Uses 'node' (not 'bun') for standalone server — designed for Node.js.

# Step 1: Run Prisma db:push (creates/migrates SQLite database)
echo "=== Running db:push ==="
bun run db:push 2>&1 || echo "db:push warning (OK if DB already exists)"

# Step 2: Start Next.js + Socket.io via custom server (port 3000)
# The custom-server.js patches http.createServer to attach Socket.io
# to the same HTTP server that Next.js uses — eliminates the need for
# a separate mini-service and XTransformPort routing.
echo "=== Starting server (port 3000) ==="
exec node custom-server.js
