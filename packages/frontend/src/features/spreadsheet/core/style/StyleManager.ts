import type { CellStyle, CellRange } from "@cellix/shared";

const DEFAULT_STYLE: CellStyle = {
    font: { family: "system-ui, sans-serif", size: 13, color: "#1f2329" },
    horizontalAlign: "general",
    verticalAlign: "middle",
};

export { DEFAULT_STYLE };

export class StyleManager {
    // key: "${sheetId}:${row}:${col}"
    private styles = new Map<string, CellStyle>();
    private listeners = new Set<() => void>();

    getStyle(sheetId: string, row: number, col: number): CellStyle {
        return {
            ...DEFAULT_STYLE,
            ...this.styles.get(`${sheetId}:${row}:${col}`),
        };
    }

    applyStyle(
        sheetId: string,
        ranges: CellRange[],
        partial: Partial<CellStyle>,
    ): void {
        for (const range of ranges) {
            const r1 = Math.min(range.start.row, range.end.row);
            const r2 = Math.max(range.start.row, range.end.row);
            const c1 = Math.min(range.start.col, range.end.col);
            const c2 = Math.max(range.start.col, range.end.col);
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    const key = `${sheetId}:${r}:${c}`;
                    const existing = this.styles.get(key) ?? {};
                    this.styles.set(key, this._mergeStyle(existing, partial));
                }
            }
        }
        this._notify();
    }

    private _mergeStyle(base: CellStyle, patch: Partial<CellStyle>): CellStyle {
        const result = { ...base };
        if (patch.font) result.font = { ...base.font, ...patch.font };
        if (patch.border) result.border = { ...base.border, ...patch.border };
        for (const k of [
            "backgroundColor",
            "horizontalAlign",
            "verticalAlign",
            "wrapText",
            "numberFormat",
            "indent",
            "locked",
        ] as const) {
            if (k in patch)
                (result as Record<string, unknown>)[k] = (
                    patch as Record<string, unknown>
                )[k];
        }
        return result;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private _notify() {
        this.listeners.forEach((fn) => fn());
    }
}

export const styleManager = new StyleManager();
