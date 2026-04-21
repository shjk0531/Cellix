FROM node:20-alpine AS base
RUN apk upgrade --no-cache && npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
COPY tsconfig.base.json ./

EXPOSE 5173
CMD ["pnpm", "--filter", "@cellix/frontend", "dev", "--", "--host"]
