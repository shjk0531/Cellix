FROM node:20-alpine AS base
# Patch Alpine packages to eliminate known high/critical CVEs
RUN apk upgrade --no-cache && npm install -g pnpm

WORKDIR /app

# 의존성 레이어 (소스 변경 시 캐시 유지)
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN pnpm install --frozen-lockfile

# 소스 복사 (volumes로 dev 시 덮어씌워짐)
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

EXPOSE 3001

# tsx watch로 hot reload
CMD ["pnpm", "--filter", "@cellix/backend", "dev"]
