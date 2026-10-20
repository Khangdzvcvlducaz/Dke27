FROM node:18-slim
RUN npm install -g bun
WORKDIR /app
COPY . .
RUN bun install
RUN cd mini-services/realtime-sync && bun install
ENV DATABASE_URL=file:/app/db/custom.db
RUN npx prisma generate
RUN npx prisma db push --accept-data-loss
RUN bun run build
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["sh", "start.sh"]
