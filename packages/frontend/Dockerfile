# ── Stage 1: WASM 빌드 (Rust + wasm-pack) ─────────────────────────────────
FROM rust:1.95-alpine AS wasm-builder

RUN apk add --no-cache musl-dev curl binaryen && \
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /app
COPY packages/formula-engine ./packages/formula-engine

RUN cd packages/formula-engine && \
    wasm-pack build --target web --out-dir pkg --dev

# ── Stage 2: Node 개발 서버 ────────────────────────────────────────────────
FROM node:22-alpine AS dev

RUN apk upgrade --no-cache && npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
COPY tsconfig.base.json ./

# Stage 1에서 빌드한 WASM pkg 복사
COPY --from=wasm-builder /app/packages/formula-engine/pkg ./packages/formula-engine/pkg

EXPOSE 5173
CMD ["pnpm", "--filter", "@cellix/frontend", "dev", "--", "--host"]