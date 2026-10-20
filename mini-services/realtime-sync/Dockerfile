FROM oven/bun:1.3
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
EXPOSE 3030
CMD ["bun", "run", "index.ts"]
