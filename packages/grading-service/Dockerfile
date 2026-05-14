FROM rust:1.95-slim AS wasm-builder

WORKDIR /build

RUN apt-get update && apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/* && \
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

COPY packages/formula-engine ./packages/formula-engine

RUN cd packages/formula-engine && \
    wasm-pack build --target nodejs --out-dir pkg-node --dev

FROM node:24-alpine AS dev

RUN apk upgrade --no-cache && corepack enable pnpm && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/grading-service/package.json ./packages/grading-service/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/auth-service/package.json ./packages/auth-service/
COPY --from=wasm-builder /build/packages/formula-engine/pkg-node/package.json ./packages/formula-engine/pkg-node/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/grading-service ./packages/grading-service
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/auth-service/package.json ./packages/auth-service/
COPY --from=wasm-builder /build/packages/formula-engine/pkg-node ./packages/formula-engine/pkg-node

EXPOSE 3003
CMD ["pnpm", "--filter", "@cellix/grading-service", "dev"]
