FROM oven/bun:1.3
WORKDIR /app
COPY . .
RUN bun install
RUN cd mini-services/realtime-sync && bun install
ENV DATABASE_URL=file:/tmp/build.db
RUN bun run db:generate
RUN bun run build
ENV DATABASE_URL=file:/app/db/custom.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN mkdir -p /app/db
EXPOSE 3000
CMD ["sh", "start.sh"]
