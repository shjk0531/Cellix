# Stage 1: Rust/wasm-pack — pkg-node 빌드
FROM rust:1.82-slim AS wasm-builder

WORKDIR /build

RUN apt-get update && apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/* && \
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

COPY packages/formula-engine ./packages/formula-engine

RUN cd packages/formula-engine && \
    wasm-pack build --target nodejs --out-dir pkg-node --dev

# Stage 2: Node.js 백엔드 런타임
FROM node:24-alpine AS base
RUN apk upgrade --no-cache && npm install -g pnpm

WORKDIR /app

# 의존성 레이어 (소스 변경 시 캐시 유지)
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
# pkg-node/package.json은 .dockerignore로 제외됐으므로 wasm-builder 스테이지에서 복사
COPY --from=wasm-builder /build/packages/formula-engine/pkg-node/package.json ./packages/formula-engine/pkg-node/

RUN pnpm install --frozen-lockfile

# 소스 복사 (volumes로 dev 시 덮어씌워짐)
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY --from=wasm-builder /build/packages/formula-engine/pkg-node ./packages/formula-engine/pkg-node

EXPOSE 3001

CMD ["pnpm", "--filter", "@cellix/backend", "dev"]
