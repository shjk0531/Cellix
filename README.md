# Cellix

Cellix는 스프레드시트 학습과 채점을 위한 모노레포 프로젝트입니다. 프론트엔드는 React + Canvas, 백엔드는 NestJS, 공통 타입은 TypeScript 패키지, 수식 계산 엔진은 Rust/WASM으로 구성되어 있습니다.

## 기술 스택

- 패키지 매니저: `pnpm` workspaces
- 런타임: Node.js `>= 24.0.0`
- 프론트엔드: React, Vite, Canvas, Zustand
- 백엔드: NestJS, Drizzle ORM, PostgreSQL, Redis
- 수식 엔진: Rust, wasm-pack, WebAssembly
- 기본 포트: frontend `5173`, backend `3001`, PostgreSQL `5432`, Redis `6379`

## 저장소 구조

```text
cellix/
├── packages/
│   ├── shared/           # @cellix/shared: 공유 타입과 순수 유틸
│   ├── frontend/         # @cellix/frontend: React + Canvas UI
│   ├── backend/          # @cellix/backend: NestJS API 서버
│   └── formula-engine/   # Rust/WASM 수식 엔진
├── infra/nginx/          # 프로덕션 Nginx 설정
├── docker-compose.yml    # 개발용 Docker Compose
├── docker-compose.prod.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── .env.prod.example
```

## 처음 clone했을 때 설정

### 1. 필수 도구 설치

다음 도구가 필요합니다.

```bash
node --version   # 24 이상 권장
pnpm --version   # 9 이상
docker --version
docker compose version
rustc --version
cargo --version
wasm-pack --version
```

`pnpm`이 없다면 Corepack으로 활성화합니다.

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

`wasm-pack`이 없다면 설치합니다.

```bash
cargo install wasm-pack
```

### 2. 저장소 clone

```bash
git clone <repository-url> cellix
cd cellix
```

### 3. 환경 변수 파일 생성

개발 환경은 `.env.example`을 복사해서 시작합니다.

```bash
cp .env.example .env
```

Windows PowerShell에서는 다음 명령을 사용할 수 있습니다.

```powershell
Copy-Item .env.example .env
```

개발 기본값은 다음 흐름을 가정합니다.

```env
NODE_ENV=development
BACKEND_PORT=3001
FRONTEND_PORT=5173
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://cellix:cellix_secret@localhost:5432/cellix
REDIS_URL=redis://localhost:6379
VITE_API_BASE_URL=http://localhost:3001
```

JWT를 명시적으로 고정하려면 `.env`에 최소 32자 이상의 값을 추가합니다.

```env
JWT_SECRET=change_me_to_a_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d
```

### 4. 의존성 설치

```bash
pnpm approve-builds
pnpm install
```

### 5. WASM 엔진 빌드

프론트엔드 브라우저용 `pkg`와 백엔드 Node.js용 `pkg-node`가 모두 필요합니다.

```bash
pnpm build:wasm:dev
```

릴리스 빌드는 나중에 배포 단계에서 다음 명령을 사용합니다.

```bash
pnpm build:wasm
```

### 6. 데이터베이스와 Redis 시작

로컬에서 앱 프로세스를 직접 실행할 때도 PostgreSQL과 Redis는 Docker로 띄우는 것이 가장 쉽습니다.

```bash
docker compose up -d postgres redis
```

상태 확인:

```bash
docker compose ps
```

### 7. DB 마이그레이션 적용

```bash
pnpm --filter @cellix/backend db:migrate
```

이제 개발 서버를 실행할 준비가 끝났습니다.

## 개발 환경에서 실행하기

개발 환경은 두 가지 방식 중 하나를 선택하면 됩니다.

## 방식 A: 로컬 Node 프로세스 + Docker DB

가장 일반적인 개발 방식입니다. 소스 변경에 대한 피드백이 빠릅니다.

### 1. 인프라 실행

```bash
docker compose up -d postgres redis
```

### 2. WASM 빌드

Rust 수식 엔진을 처음 받았거나 Rust 코드를 수정했다면 다시 빌드합니다.

```bash
pnpm build:wasm:dev
```

### 3. 전체 개발 서버 실행

```bash
pnpm dev
```

이 명령은 workspace의 `dev` 스크립트를 병렬로 실행합니다.

- `@cellix/shared`: TypeScript watch build
- `@cellix/frontend`: Vite dev server
- `@cellix/backend`: NestJS 서버를 `tsx watch`로 실행

접속 주소:

- 프론트엔드: http://localhost:5173
- 백엔드 헬스 체크: http://localhost:3001/api/health

### 4. 패키지별로 따로 실행하기

터미널을 나눠서 실행하고 싶다면 다음처럼 실행합니다.

```bash
pnpm --filter @cellix/shared dev
pnpm --filter @cellix/backend dev
pnpm --filter @cellix/frontend dev
```

### 5. API 확인

```bash
curl http://localhost:3001/api/health
```

회원가입 예시:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpassword1","name":"테스터"}'
```

로그인 예시:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpassword1"}'
```

## 방식 B: Docker Compose로 개발 서버 전체 실행

로컬에 Node/Rust 도구를 덜 설치하고 컨테이너 중심으로 돌리고 싶을 때 사용합니다.

```bash
cp .env.example .env
docker compose up --build
```

백그라운드 실행:

```bash
docker compose up -d --build
```

로그 확인:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

종료:

```bash
docker compose down
```

DB 볼륨까지 삭제하고 완전히 초기화:

```bash
docker compose down -v
```

## 자주 쓰는 개발 명령어

```bash
# 전체 타입 체크
pnpm typecheck

# 패키지별 타입 체크
pnpm --filter @cellix/shared typecheck
pnpm --filter @cellix/frontend typecheck
pnpm --filter @cellix/backend typecheck

# 전체 빌드
pnpm build

# WASM 개발 빌드
pnpm build:wasm:dev

# WASM 릴리스 빌드
pnpm build:wasm

# 백엔드 DB 마이그레이션 생성
pnpm --filter @cellix/backend db:generate

# 백엔드 DB 마이그레이션 적용
pnpm --filter @cellix/backend db:migrate

# Drizzle Studio
pnpm --filter @cellix/backend db:studio
```

Rust 수식 엔진을 수정했다면 다음 순서로 확인합니다.

```bash
cd packages/formula-engine
cargo test
wasm-pack build --target web --out-dir pkg --dev
wasm-pack build --target nodejs --out-dir pkg-node --dev
```

## 백엔드 구조

백엔드는 NestJS 프로젝트입니다. Fastify/Express/FastAPI 호환 레이어 없이 NestJS 모듈, 컨트롤러, 서비스, 레포지토리 중심으로 구성합니다.

```text
packages/backend/src/
├── app.module.ts
├── server.ts
├── domain/
│   ├── auth/
│   │   ├── controller/
│   │   ├── dto/
│   │   ├── repository/
│   │   ├── service/
│   │   └── auth.module.ts
│   ├── problem/
│   ├── submission/
│   └── user/
└── global/
    ├── common/      # 응답 인터셉터, Zod 검증 파이프 등
    ├── config/      # env 검증과 전역 config
    ├── db/          # Drizzle DB 연결, schema, migrations
    ├── entity/
    ├── exception/   # 전역 exception filter
    ├── redis/
    ├── security/    # JWT guard, Admin guard, auth decorator
    └── websocket/
```

백엔드에서 환경 변수는 `packages/backend/src/global/config/env.ts`를 통해 검증됩니다. 런타임 코드에서 `process.env`를 직접 읽지 말고, 검증된 `env` 객체나 전역 config provider를 사용합니다.

## 배포 준비

### 1. 프로덕션 환경 변수 생성

```bash
cp .env.prod.example .env.prod
```

PowerShell:

```powershell
Copy-Item .env.prod.example .env.prod
```

반드시 수정해야 하는 값:

```env
NODE_ENV=production
HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.com
JWT_SECRET=change_me_to_a_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d
POSTGRES_DB=cellix
POSTGRES_USER=cellix
POSTGRES_PASSWORD=strong_password_here
REDIS_PASSWORD=strong_redis_password_here
```

주의할 점:

- `JWT_SECRET`은 최소 32자 이상으로 설정합니다.
- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`는 개발 기본값을 사용하지 않습니다.
- 실제 도메인을 쓴다면 `CORS_ORIGIN`을 프론트엔드 도메인으로 바꿉니다.
- HTTPS 종료를 Nginx 앞단의 로드밸런서나 별도 reverse proxy에서 처리할 경우, 해당 구성에 맞게 Nginx 설정을 조정합니다.

### 2. 프로덕션 이미지 빌드 및 실행

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

서비스 상태 확인:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

로그 확인:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f nginx
```

기본 프로덕션 구성:

- `postgres`: 내부 네트워크 전용 PostgreSQL
- `redis`: password가 설정된 내부 Redis
- `backend`: NestJS API 서버, 내부 네트워크에서 `backend:3001`로 접근
- `frontend`: Vite 빌드 결과를 담은 Nginx 정적 파일 컨테이너
- `nginx`: 외부 `80` 포트 공개, `/api/*`는 백엔드로 프록시, 나머지는 SPA 정적 파일 제공

### 3. 마이그레이션 적용

현재 프로덕션 Compose에는 별도 migrate 서비스가 없습니다. 또한 프로덕션 런타임 이미지는 `--prod` 의존성만 설치하므로, `drizzle-kit`이 들어 있는 개발 의존성을 컨테이너 안에서 바로 사용할 수 없습니다.

따라서 운영 DB 마이그레이션은 다음 중 한 가지 방식으로 처리합니다.

권장 방식은 배포 호스트나 CI에서 의존성을 설치한 뒤 운영 DB에 접근 가능한 네트워크에서 실행하는 것입니다.

```bash
pnpm install --frozen-lockfile
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db> \
  pnpm --filter @cellix/backend db:migrate
```

Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>"
pnpm --filter @cellix/backend db:migrate
```

운영 DB가 Docker 내부 네트워크에서만 접근 가능하다면, `docker-compose.prod.yml`에 별도 `migrate` 서비스를 추가해서 같은 네트워크에서 실행하도록 구성하는 방식을 권장합니다. 첫 배포라면 서비스 시작 전 또는 직후 한 번 실행하고, DB 스키마 변경이 포함된 배포에서도 새 이미지 배포 시 함께 실행합니다.

### 4. 배포 확인

```bash
curl http://localhost/api/health
```

서버 도메인을 연결했다면 다음처럼 확인합니다.

```bash
curl https://your-domain.com/api/health
```

브라우저에서는 다음을 확인합니다.

- 첫 화면이 로드되는지
- 스프레드시트 Canvas가 표시되는지
- 셀 클릭과 입력이 되는지
- 로그인/회원가입 API가 동작하는지
- 브라우저 콘솔에 WASM MIME 또는 CORS 에러가 없는지

## 수동 프로덕션 빌드

Docker 없이 빌드 결과를 직접 만들고 싶다면 다음 순서로 진행합니다.

```bash
pnpm install --frozen-lockfile
pnpm build:wasm
pnpm --filter @cellix/shared build
pnpm --filter @cellix/backend build
pnpm --filter @cellix/frontend build
```

빌드 산출물:

- 백엔드: `packages/backend/dist`
- 프론트엔드: `packages/frontend/dist`
- 브라우저 WASM: `packages/formula-engine/pkg`
- Node.js WASM: `packages/formula-engine/pkg-node`

백엔드 직접 실행:

```bash
NODE_ENV=production pnpm --filter @cellix/backend start
```

Windows PowerShell:

```powershell
$env:NODE_ENV="production"
pnpm --filter @cellix/backend start
```

프론트엔드 `dist`는 Nginx, Caddy, S3+CDN 등 정적 호스팅에 배포할 수 있습니다. 단, API 프록시와 WASM MIME 타입 `application/wasm` 설정이 필요합니다.

## 문제 해결

### `pnpm`을 찾을 수 없는 경우

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

그래도 안 되면 Node.js 24 설치 상태와 PATH를 확인합니다.

### WASM 파일을 찾을 수 없는 경우

프론트엔드 또는 백엔드가 `packages/formula-engine/pkg` 또는 `pkg-node`를 찾지 못한다면 WASM을 다시 빌드합니다.

```bash
pnpm build:wasm:dev
```

### DB 연결 실패

개발 환경에서는 PostgreSQL 컨테이너가 떠 있는지 확인합니다.

```bash
docker compose ps postgres
docker compose logs postgres
```

`.env`의 `DATABASE_URL`이 로컬 실행 방식과 맞는지도 확인합니다.

- 로컬 Node 실행: `postgresql://cellix:cellix_secret@localhost:5432/cellix`
- Docker 내부 실행: `postgresql://cellix:cellix_secret@postgres:5432/cellix`

### Redis 연결 실패

```bash
docker compose ps redis
docker compose logs redis
```

로컬 Node 실행 시 `REDIS_URL=redis://localhost:6379`, Docker 내부 실행 시 `REDIS_URL=redis://redis:6379`를 사용합니다.

### 개발 DB를 초기화하고 싶은 경우

주의: 아래 명령은 개발 DB 데이터를 모두 삭제합니다.

```bash
docker compose down -v
docker compose up -d postgres redis
pnpm --filter @cellix/backend db:migrate
```

## 커밋 전 체크리스트

```bash
pnpm typecheck
pnpm build:wasm:dev
pnpm --filter @cellix/backend typecheck
pnpm --filter @cellix/frontend typecheck
```

Rust 코드를 수정했다면 추가로:

```bash
cd packages/formula-engine
cargo test
wasm-pack build --target web --out-dir pkg --dev
wasm-pack build --target nodejs --out-dir pkg-node --dev
```
