.PHONY: dev prod prod-down wasm wasm-dev migrate seed logs typecheck clean

# ── 개발 ──────────────────────────────────────────────────────────────────────
dev:
	@echo "▶ DB 시작..."
	docker compose up -d postgres redis
	@echo "▶ WASM 개발 빌드..."
	pnpm build:wasm:dev
	@echo "▶ 개발 서버 시작..."
	pnpm --parallel -r dev

# ── 프로덕션 ──────────────────────────────────────────────────────────────────
prod:
	@test -f .env.prod || (echo "❌ .env.prod 없음 — .env.prod.example 참고해서 생성하세요" && exit 1)
	@echo "▶ 프로덕션 빌드 + 실행..."
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.prod down

# ── WASM ──────────────────────────────────────────────────────────────────────
wasm:
	@echo "▶ WASM 릴리즈 빌드 (브라우저 + Node.js)..."
	cd packages/formula-engine && \
		wasm-pack build --target web --out-dir pkg --release && \
		wasm-pack build --target nodejs --out-dir pkg-node --release
	@echo "✅ WASM 빌드 완료"
	@echo "  - packages/formula-engine/pkg/      (브라우저용)"
	@echo "  - packages/formula-engine/pkg-node/ (Node.js용)"

wasm-dev:
	@echo "▶ WASM 개발 빌드 (브라우저 + Node.js)..."
	cd packages/formula-engine && \
		wasm-pack build --target web --out-dir pkg --dev && \
		wasm-pack build --target nodejs --out-dir pkg-node --dev
	@echo "✅ WASM 개발 빌드 완료"

# ── DB ────────────────────────────────────────────────────────────────────────
migrate:
	@echo "▶ DB 마이그레이션..."
	docker compose up -d postgres
	@sleep 3
	pnpm --filter @cellix/backend db:migrate
	@echo "✅ 마이그레이션 완료"

seed:
	pnpm --filter @cellix/backend run seed

# ── 유틸 ──────────────────────────────────────────────────────────────────────
typecheck:
	pnpm -r typecheck

clean:
	pnpm -r clean
	rm -rf packages/formula-engine/pkg packages/formula-engine/pkg-node

logs:
	docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
