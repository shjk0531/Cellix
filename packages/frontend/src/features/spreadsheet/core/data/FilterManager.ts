import type { CellData, CellRange, CellValue } from "@cellix/shared";

export interface FilterCriteria {
    type: "values" | "text" | "number" | "date" | "color";
    selectedValues?: Set<string>;
    textOperator?:
        | "contains"
        | "notContains"
        | "beginsWith"
        | "endsWith"
        | "equals"
        | "notEquals";
    textValue?: string;
    numberOperator?:
        | "equals"
        | "notEquals"
        | "greaterThan"
        | "lessThan"
        | "between"
        | "top10";
    numberValue1?: number;
    numberValue2?: number;
}

export interface AutoFilter {
    sheetId: string;
    headerRow: number;
    startCol: number;
    endCol: number;
    endRow: number;
    criteria: Map<number, FilterCriteria>;
}

export class FilterManager {
    readonly hiddenRows = new Map<string, Set<number>>();
    private readonly autoFilters = new Map<string, AutoFilter>();
    private readonly listeners = new Set<() => void>();

    enableAutoFilter(sheetId: string, range: CellRange): void {
        const headerRow = Math.min(range.start.row, range.end.row);
        const startCol = Math.min(range.start.col, range.end.col);
        const endCol = Math.max(range.start.col, range.end.col);
        const endRow = Math.max(range.start.row, range.end.row);
        this.autoFilters.set(sheetId, {
            sheetId,
            headerRow,
            startCol,
            endCol,
            endRow,
            criteria: new Map(),
        });
        this._notify();
    }

    disableAutoFilter(sheetId: string): void {
        this.autoFilters.delete(sheetId);
        this.hiddenRows.delete(sheetId);
        this._notify();
    }

    getAutoFilter(sheetId: string): AutoFilter | undefined {
        return this.autoFilters.get(sheetId);
    }

    applyFilter(
        sheetId: string,
        col: number,
        criteria: FilterCriteria | null,
        getCell: (row: number, col: number) => CellData | null,
    ): void {
        const af = this.autoFilters.get(sheetId);
        if (!af) return;
        if (criteria === null) {
            af.criteria.delete(col);
        } else {
            af.criteria.set(col, criteria);
        }
        this._recalcHiddenRows(sheetId, getCell);
        this._notify();
    }

    clearFilter(sheetId: string, col?: number): void {
        const af = this.autoFilters.get(sheetId);
        if (!af) return;
        if (col !== undefined) {
            af.criteria.delete(col);
        } else {
            af.criteria.clear();
        }
        this.hiddenRows.set(sheetId, new Set());
        this._notify();
    }

    isRowHidden(sheetId: string, row: number): boolean {
        return this.hiddenRows.get(sheetId)?.has(row) ?? false;
    }

    getUniqueValues(
        sheetId: string,
        col: number,
        rows: number[],
        getCell: (row: number, col: number) => CellData | null,
    ): string[] {
        void sheetId;
        const seen = new Set<string>();
        for (const row of rows) {
            const cell = getCell(row, col);
            const v = cell?.value ?? null;
            seen.add(v === null ? "(공백)" : String(v));
        }
        return [...seen].sort();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private _recalcHiddenRows(
        sheetId: string,
        getCell: (row: number, col: number) => CellData | null,
    ): void {
        const af = this.autoFilters.get(sheetId);
        const hidden = new Set<number>();
        if (af && af.criteria.size > 0) {
            for (let row = af.headerRow + 1; row <= af.endRow; row++) {
                for (const [col, crit] of af.criteria) {
                    const cell = getCell(row, col);
                    const value: CellValue = cell?.value ?? null;
                    if (!this._matchCriteria(value, crit)) {
                        hidden.add(row);
                        break;
                    }
                }
            }
        }
        this.hiddenRows.set(sheetId, hidden);
    }

    private _matchCriteria(
        value: CellValue,
        criteria: FilterCriteria,
    ): boolean {
        switch (criteria.type) {
            case "values": {
                const sv = criteria.selectedValues;
                if (!sv || sv.size === 0) return true;
                const str = value === null ? "(공백)" : String(value);
                return sv.has(str);
            }
            case "text": {
                if (typeof value !== "string") return false;
                const tv = criteria.textValue ?? "";
                switch (criteria.textOperator) {
                    case "contains":
                        return value.includes(tv);
                    case "notContains":
                        return !value.includes(tv);
                    case "beginsWith":
                        return value.startsWith(tv);
                    case "endsWith":
                        return value.endsWith(tv);
                    case "equals":
                        return value === tv;
                    case "notEquals":
                        return value !== tv;
                    default:
                        return true;
                }
            }
            case "number": {
                if (typeof value !== "number") return false;
                const n1 = criteria.numberValue1;
                const n2 = criteria.numberValue2;
                switch (criteria.numberOperator) {
                    case "equals":
                        return n1 !== undefined && value === n1;
                    case "notEquals":
                        return n1 !== undefined && value !== n1;
                    case "greaterThan":
                        return n1 !== undefined && value > n1;
                    case "lessThan":
                        return n1 !== undefined && value < n1;
                    case "between":
                        return (
                            n1 !== undefined &&
                            n2 !== undefined &&
                            value >= n1 &&
                            value <= n2
                        );
                    default:
                        return true;
                }
            }
            default:
                return true;
        }
    }

    private _notify(): void {
        this.listeners.forEach((fn) => fn());
    }
}

export const filterManager = new FilterManager();
