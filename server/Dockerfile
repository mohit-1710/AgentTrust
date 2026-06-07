# AgentTrust x402 gate — production image
FROM node:20-slim

WORKDIR /app

# Enable pnpm via corepack (pinned by packageManager if present, else latest).
RUN corepack enable

# Install dependencies first (better layer caching).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build (tsc -> dist).
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Fly injects PORT; the app reads process.env.PORT and binds 0.0.0.0.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
