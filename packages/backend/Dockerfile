FROM node:24-alpine AS base

RUN apk upgrade --no-cache && corepack enable pnpm && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/auth-service/package.json ./packages/auth-service/
COPY packages/grading-service/package.json ./packages/grading-service/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY packages/auth-service/package.json ./packages/auth-service/
COPY packages/grading-service/package.json ./packages/grading-service/

EXPOSE 3001
CMD ["pnpm", "--filter", "@cellix/backend", "dev"]
