FROM node:24-alpine AS dev

RUN apk upgrade --no-cache && corepack enable pnpm && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/auth-service/package.json ./packages/auth-service/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/grading-service/package.json ./packages/grading-service/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/auth-service ./packages/auth-service
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/grading-service/package.json ./packages/grading-service/

EXPOSE 3002
CMD ["pnpm", "--filter", "@cellix/auth-service", "dev"]
