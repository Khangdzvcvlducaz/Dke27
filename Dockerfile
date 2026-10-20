FROM oven/bun:1.3
WORKDIR /app
COPY . .
RUN bun install
RUN cd mini-services/realtime-sync && bun install
RUN bun run db:generate
ENV DATABASE_URL=file:/app/db/custom.db
ENV PORT=3000
RUN mkdir -p /app/db
EXPOSE 3000
CMD ["sh", "start.sh"]
