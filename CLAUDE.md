# CLAUDE.md — Cellix 개발 가이드

Claude Code가 이 프로젝트를 작업할 때 반드시 읽고 따라야 하는 기준 문서입니다.
모든 세션 시작 시 이 파일을 먼저 읽고, 아래 규칙을 엄격히 준수하세요.

---

## 목차

1. [프로젝트 핵심 정보](#1-프로젝트-핵심-정보)
2. [모노레포 구조](#2-모노레포-구조)
3. [절대 규칙 (MUST)](#3-절대-규칙-must)
4. [패키지별 개발 규칙](#4-패키지별-개발-규칙)
5. [타입 시스템](#5-타입-시스템)
6. [Canvas 그리드 엔진 규칙](#6-canvas-그리드-엔진-규칙)
7. [Rust/WASM 엔진 규칙](#7-rustwasm-엔진-규칙)
8. [상태 관리 규칙](#8-상태-관리-규칙)
9. [백엔드 규칙](#9-백엔드-규칙)
10. [명명 규칙](#10-명명-규칙)
11. [에러 처리 규칙](#11-에러-처리-규칙)
12. [파일 참조 가이드](#12-파일-참조-가이드)
13. [검증 체크리스트](#13-검증-체크리스트)
14. [현재 개발 상태](#14-현재-개발-상태)

---

## 1. 프로젝트 핵심 정보

```
프로젝트명:   cellix
패키지 매니저: pnpm (workspaces)
Node.js:      >= 24.0.0
TypeScript:   5.x (strict mode)
언어:         TypeScript (프론트/백), Rust (수식 엔진)
```

**패키지 이름 (package.json name 필드):**

```
@cellix/shared        # packages/shared
@cellix/frontend      # packages/frontend
@cellix/backend       # packages/backend
formula-engine        # packages/formula-engine (Rust crate)
```

**포트 기본값:**

```
프론트엔드:  5173
백엔드:     3001
PostgreSQL: 5432
Redis:      6379
```

WASM 빌드 타겟:
pkg/ → --target web (브라우저, Web Worker에서 사용)
pkg-node/ → --target nodejs (Node.js 백엔드 채점 서비스에서 사용)

두 타겟 모두 동일한 Rust 소스에서 빌드되므로 수식 계산 결과가 완벽히 동일.

---

## 2. 모노레포 구조

```
cellix/
├── packages/
│   ├── shared/           # @cellix/shared — 공유 타입, 유틸
│   ├── frontend/         # @cellix/frontend — React + Canvas
│   ├── backend/          # @cellix/backend — Fastify API
│   └── formula-engine/   # Rust/WASM 수식 계산 엔진
├── infra/
│   └── nginx/            # Nginx 설정 (프로덕션 전용)
├── docker-compose.yml        # 개발용
├── docker-compose.prod.yml   # 프로덕션용
├── Makefile
├── package.json              # 루트 (workspaces 설정)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── README.md
└── CLAUDE.md                 # 이 파일
```

**패키지 의존 관계:**

```
frontend  ──depends──▶  shared
backend   ──depends──▶  shared
frontend  ──런타임────▶  formula-engine/pkg (WASM)
```

---

## 3. 절대 규칙 (MUST)

### 3-1. 작업 시작 전 파일 읽기

모든 세션에서 작업 대상 파일을 **반드시** 먼저 읽은 후 수정하세요.
지시문에 `[현재 프로젝트 파악 — 작업 시작 전 반드시 읽을 파일들]` 섹션이 있으면
그 파일들을 전부 읽고 나서 코드를 작성하세요.

```bash
# 세션 시작 시 항상 확인할 것
cat packages/shared/src/types/cell.ts
cat packages/shared/src/types/sheet.ts
```

### 3-2. 타입 공유 — shared 패키지 최우선

- 두 패키지 이상에서 사용하는 타입은 **반드시** `packages/shared/src/types/` 에 정의
- 절대로 각 패키지 내부에 중복 타입을 만들지 마세요
- `@cellix/shared` import 경로를 사용하세요

```typescript
// ✅ 올바름
import type { CellData, CellStyle } from "@cellix/shared";

// ❌ 금지
import type { CellData } from "../../shared/src/types/cell";
```

### 3-3. DOM으로 스프레드시트 셀 렌더링 금지

스프레드시트 그리드 셀은 **Canvas에서만** 렌더링합니다.
React 컴포넌트(`<div>`, `<table>`, `<span>` 등)로 셀을 직접 렌더링하는 코드를 작성하지 마세요.

```typescript
// ✅ 올바름 — Canvas에 그리기
ctx.fillText(cellValue, x + 4, y + h / 2)

// ❌ 금지 — DOM으로 셀 렌더링
return <div className="cell">{cellValue}</div>
```

### 3-4. pnpm만 사용

패키지 설치는 반드시 `pnpm`을 사용합니다. `npm install` 또는 `yarn` 사용 금지.

```bash
# ✅ 올바름
pnpm add zustand
pnpm --filter @cellix/frontend add echarts

# ❌ 금지
npm install zustand
```

### 3-5. 환경 변수는 env.ts를 통해서만

백엔드에서 `process.env.xxx` 직접 접근 금지.
반드시 `packages/backend/src/config/env.ts`의 `env` 객체를 통해 접근하세요.

```typescript
// ✅ 올바름
import { env } from "../config/env";
const port = env.PORT;

// ❌ 금지
const port = process.env.PORT;
```

### 3-6. Map 타입 JSON 직렬화

`WorkbookData`, `SheetData`의 `Map` 필드는 `JSON.stringify`로 직렬화되지 않습니다.
API 전송 시 반드시 `packages/shared/src/utils/workbook-serializer.ts`의 변환 함수를 사용하세요.

```typescript
// ✅ 올바름
import { serializeWorkbook, deserializeWorkbook } from "@cellix/shared";
const json = serializeWorkbook(workbookData);

// ❌ 금지 (Map이 {}로 직렬화됨)
const json = JSON.stringify(workbookData);
```

### 3-7. WASM 빌드 후 테스트

`packages/formula-engine/src/` 의 Rust 코드를 수정한 경우,
반드시 다음 순서로 검증하세요:

```bash
cd packages/formula-engine
cargo test            # 1. 단위 테스트
wasm-pack build --target web --out-dir pkg --dev  # 2. WASM 빌드
```

빌드 에러가 있으면 해결 후 다음 단계로 넘어가세요.

---

## 4. 패키지별 개발 규칙

### 4-1. packages/shared

- **순수 타입과 순수 유틸만** — 외부 의존성(React, Fastify 등) 절대 import 금지
- 새 타입 추가 시 `src/types/index.ts`에서 반드시 export
- `Map` 관련 직렬화 유틸은 `src/utils/workbook-serializer.ts`에

**파일별 역할:**

```
types/cell.ts       — CellData, CellStyle, CellAddress, CellRange, MergeInfo
types/sheet.ts      — SheetData, WorkbookData, ColumnMeta, RowMeta
types/table.ts      — TableDefinition, TableColumn, TableStyleName
types/formula.ts    — FormulaToken, ParsedFormula
types/exam.ts       — ExamProblem, SubmissionResult, GradingRule
types/api.ts        — ApiResponse<T>
utils/index.ts      — assert 등 기본 유틸
utils/workbook-serializer.ts — Map ↔ JSON 변환
```

### 4-2. packages/formula-engine (Rust)

- `src/lib.rs` — WASM 바인딩만. 비즈니스 로직 없음
- `src/parser/` — 순수 파싱. IO, 상태 없음
- `src/evaluator/` — 순수 계산. `EvalContext` trait을 통해서만 셀 데이터 접근
- `src/engine/` — 상태 보유. `Workbook`, `DependencyGraph`, `Engine`
- JS와의 모든 데이터 교환은 **JSON 문자열**로 직렬화 (`wasm_bindgen`이 복잡한 타입 미지원)
- `#[wasm_bindgen]` 함수는 `pub fn`, 파라미터는 `&str` 또는 원시 타입만
- 에러는 패닉 대신 `Result<_, String>` 로 처리 (WASM에서 패닉 = 크래시)

```rust
// ✅ 올바름
#[wasm_bindgen]
pub fn set_cell(&mut self, sheet_id: &str, row: u32, col: u32, data_json: &str) -> String {
    let data: JsCellData = serde_json::from_str(data_json)
        .unwrap_or_default();
    let changed = self.inner.set_cell(sheet_id, row, col, data);
    serde_json::to_string(&changed).unwrap_or_default()
}

// ❌ 금지 — 복잡한 타입을 직접 WASM 경계에 노출
#[wasm_bindgen]
pub fn set_cell(&mut self, data: JsCellData) -> Vec<ChangedCell> { ... }
```

### 4-3. packages/frontend

**디렉토리 역할:**

```
core/renderer/    — Canvas 렌더링 로직만. React 없음
core/viewport/    — 스크롤, 좌표 변환. React 없음
core/selection/   — 선택 상태 관리. React 없음
core/input/       — 키보드/마우스 처리. React 없음
core/history/     — Undo/Redo, 클립보드. React 없음
core/style/       — 셀 스타일 관리. React 없음
core/table/       — 표(Ctrl+T) 관리. React 없음
core/chart/       — 차트 정의/관리. React 없음
core/pivot/       — 피벗 테이블 계산. React 없음
core/analysis/    — 가상 분석 도구. React 없음
core/data/        — 정렬/필터/유효성. React 없음
core/formula/     — DirtyCellTracker. React 없음
core/io/          — XLSX 가져오기/내보내기. React 없음
workers/          — Web Worker 파일들
components/       — React 컴포넌트 (Canvas 바깥 UI만)
pages/            — React 페이지 컴포넌트
store/            — Zustand 스토어
api/              — API 클라이언트
```

**React 컴포넌트와 Canvas 엔진의 책임 분리:**

```
React 컴포넌트 담당:
  - Toolbar, FormulaBar, SheetTabs (Canvas 바깥 UI)
  - 다이얼로그, 모달, 드롭다운
  - 페이지 라우팅
  - 사용자 인증 UI

Canvas 엔진 담당:
  - 셀 렌더링 (격자선, 텍스트, 배경, 테두리)
  - 선택 영역 하이라이트
  - 필터 아이콘, 채우기 핸들
  - 차트 오버레이 (ChartOverlay: Canvas 위 absolute div)
```

### 4-4. packages/backend

**디렉토리 역할:**

```
config/env.ts      — Zod 환경변수 검증 (유일한 env 접근 포인트)
db/schema.ts       — Drizzle 테이블 정의 (스키마 변경 시 migration 생성 필수)
db/index.ts        — DB 연결 싱글톤
plugins/           — Fastify 플러그인 (fastify-plugin으로 래핑)
routes/            — 라우트 핸들러 (비즈니스 로직 최소화)
services/          — 비즈니스 로직 (grading, auth 등)
middleware/        — preHandler 함수들
```

---

## 5. 타입 시스템

### 핵심 타입 정의 위치

| 타입               | 파일                                |
| ------------------ | ----------------------------------- |
| `CellData`         | `@cellix/shared` → `types/cell.ts`  |
| `CellStyle`        | `@cellix/shared` → `types/cell.ts`  |
| `CellAddress`      | `@cellix/shared` → `types/cell.ts`  |
| `CellRange`        | `@cellix/shared` → `types/cell.ts`  |
| `CellValue`        | `@cellix/shared` → `types/cell.ts`  |
| `SheetData`        | `@cellix/shared` → `types/sheet.ts` |
| `WorkbookData`     | `@cellix/shared` → `types/sheet.ts` |
| `TableDefinition`  | `@cellix/shared` → `types/table.ts` |
| `ExamProblem`      | `@cellix/shared` → `types/exam.ts`  |
| `SubmissionResult` | `@cellix/shared` → `types/exam.ts`  |
| `ApiResponse<T>`   | `@cellix/shared` → `types/api.ts`   |

### CellKey 형식

셀을 Map의 키로 사용할 때 형식:

```typescript
// SheetData.cells의 키: "{row}:{col}" (0-based)
const key: CellKey = `${row}:${col}`;

// WorkbookStore의 cells Record 키: "{sheetId}:{row}:{col}"
const key = `${sheetId}:${row}:${col}`;

// WASM 엔진 ChangedCell의 키: (sheet_id, row, col) — 별도 필드
```

### CellValue 타입

```typescript
type CellValue = string | number | boolean | null;
// null = 빈 셀
// string으로 시작하는 수식은 formula 필드에, value는 계산 결과
```

---

## 6. Canvas 그리드 엔진 규칙

### 렌더 루프 구조

```typescript
// GridCanvas.tsx의 renderLoop 구조
const renderLoop = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    gridRenderer.draw(ctx); // 1. 배경 + 셀 + 격자선
    selectionRenderer.markDirty();
    selectionRenderer.drawSelections(ctx, selections, activeCell); // 2. 선택 영역
    // 잘라내기 테두리 등 오버레이  // 3. 기타 오버레이

    rafId = requestAnimationFrame(renderLoop);
};
```

### ViewportManager 사용법

```typescript
// 셀 → 픽셀 (Canvas 좌표)
const { x, y } = viewport.cellToPixel(row, col)

// 픽셀 → 셀 (마우스 클릭 처리)
const { row, col } = viewport.pixelToCell(mouseX, mouseY)

// 보이는 범위 순회 (렌더링 루프에서)
viewport.iterateRows((row, y, height) => { ... })
viewport.iterateCols((col, x, width) => { ... })

// 셀 크기
const h = viewport.getRowHeight(row)
const w = viewport.getColWidth(col)
```

### 성능 규칙

- `iterateRows` / `iterateCols` 로 보이는 셀만 처리 — `getOffset`을 매 셀마다 호출하지 말 것
- `requestAnimationFrame`에서만 Canvas draw 호출
- `mousemove` 이벤트는 직접 처리 금지 — RAF로 쓰로틀링
- dirty 플래그 패턴: 변경이 없으면 re-draw 건너뜀

```typescript
// ✅ 올바름 — RAF 쓰로틀링
let pendingX = 0,
    pendingY = 0,
    rafId: number | null = null;
canvas.addEventListener("mousemove", (e) => {
    pendingX = e.offsetX;
    pendingY = e.offsetY;
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        processMouseMove(pendingX, pendingY);
    });
});

// ❌ 금지 — mousemove마다 즉시 처리
canvas.addEventListener("mousemove", (e) => {
    processMouseMove(e.offsetX, e.offsetY);
    draw();
});
```

### SizeStore 사용

행/열 크기는 `Uint16Array` 기반 `SizeStore`에 저장됩니다.

```typescript
// ✅ 올바름
viewport.setRowHeight(row, 40); // 행 높이 설정
viewport.setColWidth(col, 120); // 열 너비 설정

// ❌ 금지 — SizeStore.data에 직접 접근
viewport.rows.data[row] = 40;
```

---

## 7. Rust/WASM 엔진 규칙

### 아키텍처

```
FormulaEngineClient (TypeScript, 메인 스레드)
    ↓ postMessage (JSON)
formula.worker.ts (Web Worker)
    ↓ import
formula_engine.js (wasm-bindgen 생성)
    ↓ 호출
formula_engine_bg.wasm (Rust 컴파일)
```

### FormulaEngineClient 사용

```typescript
import { formulaEngine } from "../workers";

// 초기화 (앱 시작 시 1회)
await formulaEngine.initialize();

// 셀 설정 — 반환값: 재계산된 셀 목록
const changed = await formulaEngine.setCell(sheetId, row, col, value, formula);

// 배치 업데이트 (성능상 여러 셀을 한번에)
const changed = await formulaEngine.batchSet([
    { sheetId, row: 0, col: 0, value: 100 },
    { sheetId, row: 1, col: 0, value: 200 },
]);

// 수식 참조 파싱 (색깔 하이라이트용)
const refs = await formulaEngine.parseRefs("=SUM(A1:A10)+B5");
// → ['A1:A10', 'B5']
```

### WASM CellVal 타입

```typescript
// Worker에서 반환되는 셀 값 타입
interface CellValResult {
    t: "n" | "s" | "b" | "e" | "nil";
    // n=number, s=string, b=boolean, e=error("#DIV/0!" 등), nil=null
    v?: number | string | boolean;
}
```

### 구조적 참조

표 생성 시 WASM 엔진에 반드시 등록해야 구조적 참조가 동작합니다:

```typescript
await formulaEngine.registerTable(
    JSON.stringify({
        id: table.id,
        name: table.name,
        sheet_id: table.sheetId,
        start_row: table.range.start.row,
        start_col: table.range.start.col,
        end_row: table.range.end.row,
        end_col: table.range.end.col,
        has_header: table.showHeaderRow,
        has_total: table.showTotalRow,
        columns: table.columns.map((c) => c.name),
    }),
);
```

### Node.js에서 WASM 사용 (백엔드)

Node.js 타겟은 init() 없이 바로 사용 가능:

// ✅ 올바름 — Node.js에서는 동기 로드
import { FormulaEngine } from 'formula-engine-node'
const engine = new FormulaEngine() // init() 불필요
engine.add_sheet('s1', 'Sheet1')

// ❌ 금지 — 백엔드에서 HyperFormula 사용
import HyperFormula from 'hyperformula' // 사용 금지, 결과 불일치 위험

### 채점 시 주의사항

grading.service.ts 에서:

- FormulaEngine 인스턴스는 요청마다 새로 생성 (싱글톤 X — 상태 격리 필요)
- batch_set()으로 한번에 로드 (셀마다 set_cell() 반복 X — 성능)

---

## 8. 상태 관리 규칙

### Zustand 스토어 구조

```
useWorkbookStore — 워크북 데이터 (셀, 시트 목록, 계산값 캐시)
useUIStore       — UI 상태 (선택, 편집 모드, 히스토리, 활성 셀 데이터)
useAuthStore     — 인증 상태 (유저 정보, 토큰)
```

### 셀 데이터 흐름

```
사용자 입력
    ↓
InputManager._commitEdit()
    ↓
useWorkbookStore.setCell()  ← Zustand 즉시 업데이트 (동기)
    ↓ (비동기, 백그라운드)
formulaEngine.setCell()     ← WASM 엔진 업데이트
    ↓ (onChanged 이벤트)
useWorkbookStore.setCalculatedValues()  ← 계산값 캐시 업데이트
    ↓
GridRenderer.draw()         ← calculatedValues 우선 표시
```

### 스토어 셀렉터 사용

```typescript
// ✅ 올바름 — 필요한 상태만 구독
const activeCell = useUIStore((state) => state.activeCell);
const canUndo = useUIStore((state) => state.canUndo);

// ❌ 성능 저하 — 전체 스토어 구독
const store = useUIStore();
```

### Canvas 엔진과 스토어 연결 방법

Canvas 엔진 클래스들은 React를 import하지 않습니다.
`GridCanvas.tsx`에서 엔진 인스턴스의 이벤트를 구독하여 Zustand에 push합니다.

```typescript
// GridCanvas.tsx에서
const unsubSelection = selection.subscribe((state: SelectionState) => {
    useUIStore.getState().setSelectionState(state); // Zustand에 push
});
```

---

## 9. 백엔드 규칙

### 라우트 핸들러 구조

```typescript
// routes/*.routes.ts 패턴
export const problemRoutes: FastifyPluginAsync = async (app) => {
    app.get(
        "/",
        {
            preHandler: [app.authenticate], // 인증 필요 시
            schema: {
                querystring: GetProblemsQuerySchema,
                response: { 200: GetProblemsResponseSchema },
            },
        },
        async (request, reply) => {
            // 비즈니스 로직은 services/로 위임
            const result = await problemService.getAll(request.query);
            return { success: true, data: result };
        },
    );
};
```

### API 응답 형식

**성공:**

```typescript
{ success: true, data: T }
// 또는 페이지네이션
{ success: true, data: T[], total: number, page: number }
```

**실패:**

```typescript
{ success: false, error: string, code: string }
// code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' |
//       'VALIDATION_ERROR' | 'INTERNAL_ERROR'
```

### 채점 서비스 규칙

```typescript
// grading.service.ts
// - HyperFormula는 백엔드에서만 사용 (프론트는 WASM)
// - answerWorkbook은 절대로 API 응답에 포함시키지 말 것
// - gradingConfig도 학생에게 노출 금지
```

### DB 스키마 변경 절차

```bash
# 1. schema.ts 수정
# 2. 마이그레이션 파일 생성
pnpm --filter @cellix/backend db:generate

# 3. 마이그레이션 적용
pnpm --filter @cellix/backend db:migrate

# ❌ 금지 — 마이그레이션 없이 스키마만 바꾸는 것
```

---

## 10. 명명 규칙

### TypeScript

```typescript
// 클래스: PascalCase
class ViewportManager {}
class SelectionManager {}

// 인터페이스: PascalCase (I 접두사 없음)
interface CellData {}
interface SelectionRange {}

// 타입 별칭: PascalCase
type CellValue = string | number | boolean | null
type CellKey = string

// 함수/변수: camelCase
const viewportManager = new ViewportManager()
function cellToPixel(row: number, col: number): PixelPoint {}

// 상수: UPPER_SNAKE_CASE
const MAX_ROWS = 1_048_576
const DEFAULT_ROW_HEIGHT = 20
const RANGE_COLORS = ['#4B87FF', '#00CC66', ...]

// 파일명: PascalCase (클래스), camelCase (유틸/훅)
// ViewportManager.ts, useWorkbookStore.ts, cellUtils.ts

// Zustand 스토어 훅: use + PascalCase + Store
const useWorkbookStore = create<WorkbookState>(...)
```

### Rust

```rust
// 구조체/열거형: PascalCase
pub struct FormulaEngine {}
pub enum CellVal {}

// 함수/메서드: snake_case
pub fn set_cell(&mut self, ...) {}
fn parse_col_name(&self, s: &str) -> Option<u32> {}

// 상수: UPPER_SNAKE_CASE
const MAX_ITERATIONS: u32 = 1000;

// WASM 노출 함수: snake_case (JS 측에서 camelCase로 접근)
#[wasm_bindgen]
pub fn set_cell(...) {}  // JS: engine.set_cell()
```

### CSS / 스타일

인라인 스타일 객체를 사용합니다 (CSS 파일 최소화).

```typescript
// ✅ 올바름
const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid #dadce0",
};

// ❌ 지양 (별도 CSS 파일)
// .toolbar { display: flex; }
```

---

## 11. 에러 처리 규칙

### TypeScript (프론트)

```typescript
// 비동기 작업은 try-catch
try {
  const changed = await formulaEngine.setCell(...)
} catch (err) {
  console.error('[FormulaEngine] setCell failed:', err)
  // UI에 에러 표시 (토스트 등)
}

// Worker 타임아웃 처리됨 (FormulaEngineClient 내부)
// — 10초 초과 시 자동으로 reject
```

### TypeScript (백엔드)

```typescript
// Fastify 에러 핸들러 (app.ts에서 설정)
app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
        return reply.status(422).send({
            success: false,
            error: error.errors[0].message,
            code: "VALIDATION_ERROR",
        });
    }
    app.log.error(error);
    return reply.status(500).send({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
    });
});
```

### Rust

```rust
// ✅ 올바름 — Result로 에러 전파
fn parse_number(s: &str) -> Result<f64, String> {
    s.parse::<f64>().map_err(|e| format!("숫자 파싱 실패: {}", e))
}

// WASM 경계에서 에러 문자열 반환
#[wasm_bindgen]
pub fn set_cell(...) -> String {
    match self.inner.set_cell(...) {
        Ok(changed) => serde_json::to_string(&changed).unwrap_or_default(),
        Err(e) => format!("{{\"error\":\"{}\"}}", e),
    }
}

// ❌ 금지 — WASM에서 패닉 사용
fn parse_number(s: &str) -> f64 {
    s.parse().expect("파싱 실패")  // WASM에서 패닉 = 크래시
}
```

---

## 12. 파일 참조 가이드

새 기능 작업 시 참조해야 할 핵심 파일들입니다.

### Canvas 렌더링 관련

```
packages/frontend/src/core/renderer/GridRenderer.ts    — 셀 그리기 로직
packages/frontend/src/core/viewport/ViewportManager.ts — 좌표 변환, 가상 스크롤
packages/frontend/src/core/viewport/SizeStore.ts       — 행/열 크기 저장
packages/frontend/src/components/GridCanvas.tsx        — 엔진 통합 포인트
```

### 선택/입력 관련

```
packages/frontend/src/core/selection/SelectionManager.ts   — 선택 상태
packages/frontend/src/core/selection/SelectionRenderer.ts  — 선택 그리기
packages/frontend/src/core/input/InputManager.ts           — 키/마우스 처리
packages/frontend/src/core/history/HistoryManager.ts       — Undo/Redo
packages/frontend/src/core/history/ClipboardManager.ts     — 복사/붙여넣기
```

### 수식 엔진 관련

```
packages/formula-engine/src/lib.rs                — WASM 바인딩
packages/formula-engine/src/parser/mod.rs         — 파서
packages/formula-engine/src/parser/tokenizer.rs   — 토크나이저
packages/formula-engine/src/parser/ast.rs         — AST 정의
packages/formula-engine/src/evaluator/mod.rs      — 평가기
packages/formula-engine/src/engine/mod.rs         — 메인 엔진
packages/frontend/src/workers/formula.worker.ts   — Web Worker
packages/frontend/src/workers/FormulaEngineClient.ts — TS 클라이언트
```

### 스타일/서식 관련

```
packages/shared/src/types/cell.ts                      — CellStyle 타입
packages/frontend/src/core/style/StyleManager.ts       — 스타일 관리
packages/frontend/src/core/style/NumberFormatter.ts    — 숫자 포맷
packages/frontend/src/core/conditional/               — 조건부 서식
```

### 표(Table) 관련

```
packages/shared/src/types/table.ts                     — TableDefinition 타입
packages/frontend/src/core/table/TableManager.ts       — 표 CRUD
packages/frontend/src/core/table/TableStyleRenderer.ts — 표 스타일 렌더링
packages/formula-engine/src/engine/table.rs            — 구조적 참조 해석
```

### 상태 관리 관련

```
packages/frontend/src/store/useWorkbookStore.ts  — 워크북 데이터
packages/frontend/src/store/useUIStore.ts        — UI 상태
packages/frontend/src/store/useAuthStore.ts      — 인증 상태
```

### 백엔드 관련

```
packages/backend/src/db/schema.ts              — DB 테이블 정의
packages/backend/src/config/env.ts             — 환경변수
packages/backend/src/app.ts                    — Fastify 앱 설정
packages/backend/src/services/grading.service.ts — 채점 로직
packages/shared/src/types/exam.ts              — ExamProblem, SubmissionResult
```

### 공유 타입 관련

```
packages/shared/src/types/cell.ts     — 셀 관련 핵심 타입
packages/shared/src/types/sheet.ts    — 시트/워크북 타입
packages/shared/src/types/exam.ts     — 문제/제출 타입
packages/shared/src/types/api.ts      — API 응답 타입
packages/shared/src/utils/workbook-serializer.ts — Map 직렬화
```

---

## 13. 검증 체크리스트

각 명령어 완료 후 다음 항목을 확인하세요.

### TypeScript 검증

```bash
# 타입 에러 확인 (에러 없어야 함)
pnpm typecheck

# 또는 패키지별
pnpm --filter @cellix/shared typecheck
pnpm --filter @cellix/frontend typecheck
pnpm --filter @cellix/backend typecheck
```

### Rust 검증

```bash
cd packages/formula-engine

# 단위 테스트 실행
cargo test 2>&1 | tail -20

# WASM 빌드 (에러 없어야 함)
wasm-pack build --target web --out-dir pkg --dev 2>&1 | tail -20
```

### 런타임 검증

```bash
# 개발 서버 실행
docker compose up -d postgres redis
pnpm build:wasm:dev
pnpm dev

# 브라우저에서 확인할 항목:
# 1. http://localhost:5173 접속 → 스프레드시트 표시
# 2. 셀 클릭 → 선택 하이라이트
# 3. 숫자 입력 → Enter → 다음 셀 이동 + 값 표시
# 4. =1+2 입력 → Enter → 3 표시
# 5. A1=5 입력, B1=A1*2 입력 → B1에 10 표시
# 6. A1 값 변경 → B1 자동 업데이트
# 7. 콘솔 에러 없음
```

### API 검증

```bash
# 백엔드 헬스 체크
curl http://localhost:3001/api/health

# 회원가입
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpassword1","name":"테스터"}'

# 로그인
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpassword1"}'
```

---

## 14. 현재 개발 상태

### 완료된 Phase

| Phase   | 내용                             | 상태    |
| ------- | -------------------------------- | ------- |
| Phase 1 | 모노레포 설정, 공유 타입, Docker | ✅ 완료 |
| Phase 2 | Canvas 그리드 엔진, React 쉘     | ✅ 완료 |

**Phase 2 완료 목록:**

- `ViewportManager` — 가상 스크롤, 좌표 변환, `SizeStore` (Uint16Array)
- `SelectionManager` — 단일/범위/다중 선택, Ctrl+클릭, 수식 참조 색깔
- `SelectionRenderer` — Canvas 선택 영역 그리기
- `InputManager` — IME 오버레이, 편집 모드, 드래그 채우기, RAF 쓰로틀링
- `GridRenderer` — Canvas 격자선, 셀 텍스트 렌더링
- `HistoryManager` — Command 패턴, Undo/Redo, 배치 커맨드
- `ClipboardManager` — Ctrl+C/X/V, TSV 직렬화, 선택하여 붙여넣기
- `SpreadsheetShell`, `GridCanvas`, `Toolbar`, `FormulaBar`, `SheetTabs`
- `useWorkbookStore`, `useUIStore`
- Fastify 기본 서버 (`/api/health`)

### 진행 예정 Phase

| Phase   | 내용                               | 상태      |
| ------- | ---------------------------------- | --------- |
| Phase 3 | Rust/WASM 수식 엔진                | 🔲 미완료 |
| Phase 4 | 셀 서식, 정렬, 필터, 유효성 검사   | 🔲 미완료 |
| Phase 5 | 표(Ctrl+T), 구조적 참조, 가상 분석 | 🔲 미완료 |
| Phase 6 | 차트(ECharts), 피벗 테이블         | 🔲 미완료 |
| Phase 7 | 백엔드 API, DB 스키마, 인증        | 🔲 미완료 |
| Phase 8 | 채점 엔진, 문제 풀이 UI            | 🔲 미완료 |
| Phase 9 | 성능 최적화, Nginx, 프로덕션 배포  | 🔲 미완료 |

### 알려진 버그 및 TODO

1. **[수정 필요]** `packages/frontend/vite.config.ts` — proxy 타겟이 `localhost:3000`으로 잘못 설정됨 → `localhost:3001`로 수정 필요
2. **[TODO]** `InputManager._commitEdit()` — `// TODO: cell data store 연동` 주석 → Phase 3-5에서 완성
3. **[TODO]** `Toolbar.tsx` — 모든 버튼이 껍데기만 있음 → Phase 4-1에서 실제 기능 연결
4. **[TODO]** `GridRenderer.ts` — 스타일/조건부 서식 미적용 → Phase 4에서 통합

---

## 부록 A: 자주 실수하는 패턴

### A-1. Map 직렬화 실수

```typescript
// ❌ 실수 — Map이 {} 로 직렬화됨
const body = JSON.stringify(workbookData);
await fetch("/api/submissions", { body });

// ✅ 올바름
import { serializeWorkbook } from "@cellix/shared";
const body = JSON.stringify(serializeWorkbook(workbookData));
```

### A-2. WASM 초기화 순서 실수

```typescript
// ❌ 실수 — 초기화 전에 사용
formulaEngine.setCell(...)  // Error: Engine not initialized

// ✅ 올바름 — 앱 시작 시 먼저 초기화
await formulaEngine.initialize()
await formulaEngine.addSheet(firstSheetId, 'Sheet1')
// 이후 setCell 사용 가능
```

### A-3. React 컴포넌트에서 Canvas 직접 접근 실수

```typescript
// ❌ 실수 — 매 렌더마다 새 인스턴스 생성
function GridCanvas() {
  const renderer = new GridRenderer(...)  // 매 렌더마다 생성됨!
  return <canvas />
}

// ✅ 올바름 — useEffect + useRef
function GridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const renderer = new GridRenderer(...)  // 마운트 시 1회만
    return () => renderer.destroy()
  }, [])
  return <canvas ref={canvasRef} />
}
```

### A-4. 행/열 인덱스 혼동

```typescript
// Cellix의 모든 인덱스는 0-based
// row=0, col=0 → A1 셀
// row=0, col=1 → B1 셀

// CellKey 형식: "{row}:{col}" (0-based)
const key = `${row}:${col}`; // ✅ "0:0" for A1

// 사용자에게 표시할 때만 +1
const displayRow = row + 1; // ✅ "1" for row=0
const displayCol = colToLetter(col); // ✅ "A" for col=0
```

### A-5. Rust에서 0-based vs 1-based

```rust
// 파서에서 셀 참조는 0-based로 변환하여 저장
// "A1" → CellRef { row: 0, col: 0 }
// "B2" → CellRef { row: 1, col: 1 }

fn parse_row_num(s: &str) -> Option<u32> {
    s.parse::<u32>().ok().map(|n| n - 1)  // ✅ 1-based 입력 → 0-based 저장
}
```

---

## 부록 B: 유용한 개발 명령어

```bash
# 전체 개발 서버 (WASM 빌드 포함)
pnpm build:wasm:dev && pnpm dev

# 특정 패키지만 타입 체크
pnpm --filter @cellix/frontend typecheck

# WASM 테스트 + 빌드 (Rust 변경 후)
cd packages/formula-engine && cargo test && wasm-pack build --target web --out-dir pkg --dev

# DB 초기화 (개발 중 스키마 망가진 경우)
docker compose down -v && docker compose up -d postgres redis
pnpm --filter @cellix/backend db:migrate

# 의존성 전체 재설치
pnpm clean && pnpm install

# 특정 패키지에 의존성 추가
pnpm --filter @cellix/frontend add react-router-dom
pnpm --filter @cellix/frontend add -D @types/node

# Drizzle Studio (DB 시각화)
docker compose up -d postgres
pnpm --filter @cellix/backend db:studio
# → http://local.drizzle.studio 에서 확인
```
