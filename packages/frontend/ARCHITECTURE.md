# Frontend Architecture

Cellix frontend is organized by ownership, not by file type. New code should live near the feature or entity that owns the behavior.

## Top-level Layout

```txt
src/
  app/        app wiring, providers, layouts
  routes/     route-level screens
  features/   user-facing domains and feature modules
  entities/   cross-feature business entities
  shared/     reusable infrastructure and UI
```

## Spreadsheet Feature

Spreadsheet code is intentionally grouped under `features/spreadsheet` because it is the largest interaction surface in the app.

```txt
features/spreadsheet/
  ui/       React UI around the canvas: toolbar, formula bar, overlays, dialogs
  core/     canvas engine and spreadsheet domain logic; no React except migrated UI exits
  model/    workbook and spreadsheet UI state stores
```

Use `ui/` for React components, dialogs, overlays, and panels. Use `core/` for rendering, viewport, selection, input, history, table, chart, pivot, formula, style, and data engines. Use `model/` for Zustand stores and UI state adapters.

Canvas cells must remain rendered by `core/renderer` through `GridCanvas`; do not introduce DOM cell rendering.

## Data Boundaries

Server state belongs in route loaders, API clients, or feature APIs. Client-only interaction state belongs in feature or entity stores.

```txt
shared/api/              generic API client
features/problems/api/   problem-specific API contracts
entities/auth/model/     auth state
entities/theme/model/    theme state
```

If a type is shared with backend or more than one package, define it in `@cellix/shared` first.

## Import Style

Prefer aliases for cross-boundary imports:

```ts
import { SpreadsheetShell } from "@features/spreadsheet/ui";
import { useWorkbookStore } from "@features/spreadsheet/model";
import { apiClient } from "@shared/api";
```

Relative imports are fine inside the same small module, especially within `core`.
