import type { CellData, CellRange, CellValue } from "@cellix/shared";

export interface SortKey {
    col: number;
    direction: "asc" | "desc";
    caseInsensitive?: boolean;
}

export class SortManager {
    sort(
        _sheetId: string,
        range: CellRange,
        sortKeys: SortKey[],
        hasHeader: boolean,
        getCell: (row: number, col: number) => CellData | null,
        setCell: (row: number, col: number, data: CellData | null) => void,
    ): void {
        const r1 = Math.min(range.start.row, range.end.row);
        const r2 = Math.max(range.start.row, range.end.row);
        const c1 = Math.min(range.start.col, range.end.col);
        const c2 = Math.max(range.start.col, range.end.col);

        const dataStartRow = hasHeader ? r1 + 1 : r1;
        if (dataStartRow > r2) return;

        // Snapshot all rows
        const rows: (CellData | null)[][] = [];
        for (let row = dataStartRow; row <= r2; row++) {
            const rowData: (CellData | null)[] = [];
            for (let col = c1; col <= c2; col++) {
                rowData.push(getCell(row, col));
            }
            rows.push(rowData);
        }

        rows.sort((a, b) => {
            for (const key of sortKeys) {
                const colIdx = key.col - c1;
                if (colIdx < 0 || colIdx >= a.length) continue;
                const va = a[colIdx]?.value ?? null;
                const vb = b[colIdx]?.value ?? null;
                const cmp = this._compareValues(
                    va,
                    vb,
                    key.direction,
                    key.caseInsensitive ?? false,
                );
                if (cmp !== 0) return cmp;
            }
            return 0;
        });

        for (let i = 0; i < rows.length; i++) {
            const row = dataStartRow + i;
            for (let j = 0; j < rows[i].length; j++) {
                setCell(row, c1 + j, rows[i][j]);
            }
        }
    }

    private _compareValues(
        a: CellValue,
        b: CellValue,
        direction: "asc" | "desc",
        caseInsensitive: boolean,
    ): number {
        // Excel sort priority: numbers(0) < text(1) < booleans(2) < empty(3)
        const rank = (v: CellValue): number => {
            if (v === null || v === undefined || v === "") return 3;
            if (typeof v === "number") return 0;
            if (typeof v === "string") return 1;
            if (typeof v === "boolean") return 2;
            return 2;
        };

        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) {
            if (ra === 3) return 1; // empty always last
            if (rb === 3) return -1;
            return direction === "asc" ? ra - rb : rb - ra;
        }

        if (ra === 3) return 0; // both empty

        let cmp = 0;
        if (typeof a === "number" && typeof b === "number") {
            cmp = a - b;
        } else if (typeof a === "string" && typeof b === "string") {
            const sa = caseInsensitive ? a.toLowerCase() : a;
            const sb = caseInsensitive ? b.toLowerCase() : b;
            cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
        } else if (typeof a === "boolean" && typeof b === "boolean") {
            cmp = (a ? 1 : 0) - (b ? 1 : 0);
        }

        return direction === "asc" ? cmp : -cmp;
    }
}

export const sortManager = new SortManager();
