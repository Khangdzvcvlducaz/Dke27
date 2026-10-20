#!/bin/sh
bun run db:push 2>&1 || true
cd mini-services/realtime-sync && bun run index.ts &
sleep 2
exec bun run dev
