import type { CellData, TableDefinition, TableColumn } from "@cellix/shared";
import { formulaEngine } from "../../workers";

export class TableManager {
    private readonly tables = new Map<string, TableDefinition>();
    private readonly listeners = new Set<() => void>();

    async createTable(
        sheetId: string,
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number,
        getCell: (row: number, col: number) => CellData | null,
        options?: { hasHeaders?: boolean; styleName?: string },
    ): Promise<TableDefinition> {
        const hasHeaders =
            options?.hasHeaders ??
            this._detectHeaders(startRow, startCol, endCol, getCell);

        const columns: TableColumn[] = [];
        for (let c = startCol; c <= endCol; c++) {
            const headerCell = hasHeaders ? getCell(startRow, c) : null;
            columns.push({
                index: c - startCol,
                name: String(headerCell?.value ?? `Column${c - startCol + 1}`),
            });
        }

        const table: TableDefinition = {
            id: crypto.randomUUID(),
            name: this._generateName(),
            sheetId,
            range: {
                start: { row: startRow, col: startCol, sheetId },
                end: { row: endRow, col: endCol, sheetId },
            },
            columns,
            styleName: options?.styleName ?? "TableStyleLight1",
            showHeaderRow: hasHeaders,
            showTotalRow: false,
            showBandedRows: true,
            showBandedCols: false,
            showFirstColumnStripe: false,
            showLastColumnStripe: false,
        };

        this.tables.set(table.id, table);

        try {
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
        } catch (err) {
            console.warn("[TableManager] WASM registerTable failed:", err);
        }

        this._notify();
        return table;
    }

    async deleteTable(tableId: string): Promise<void> {
        this.tables.delete(tableId);
        try {
            await formulaEngine.unregisterTable(tableId);
        } catch (err) {
            console.warn("[TableManager] WASM unregisterTable failed:", err);
        }
        this._notify();
    }

    resizeTable(tableId: string, newEndRow: number, newEndCol: number): void {
        const table = this.tables.get(tableId);
        if (!table) return;
        this.tables.set(tableId, {
            ...table,
            range: {
                ...table.range,
                end: { ...table.range.end, row: newEndRow, col: newEndCol },
            },
        });
        this._notify();
    }

    toggleTotalRow(
        tableId: string,
        setCell: (row: number, col: number, data: CellData) => void,
    ): void {
        const table = this.tables.get(tableId);
        if (!table) return;

        if (table.showTotalRow) {
            // Remove total row: clear cells and shrink range
            const totalRow = table.range.end.row;
            for (let c = table.range.start.col; c <= table.range.end.col; c++) {
                setCell(totalRow, c, { value: null });
            }
            this.tables.set(tableId, {
                ...table,
                range: {
                    ...table.range,
                    end: { ...table.range.end, row: totalRow - 1 },
                },
                showTotalRow: false,
            });
        } else {
            // Add total row: extend range and insert formulas
            const newTotalRow = table.range.end.row + 1;
            const headerRow = table.range.start.row;
            const dataStartRow = table.showHeaderRow
                ? headerRow + 1
                : headerRow;
            const dataEndRow = table.range.end.row;

            for (let i = 0; i < table.columns.length; i++) {
                const col = table.columns[i];
                const c = table.range.start.col + i;
                const func = col.totalRowFunction ?? "sum";

                if (func === "none") {
                    if (col.totalRowLabel) {
                        setCell(newTotalRow, c, { value: col.totalRowLabel });
                    }
                } else {
                    const r1 = dataStartRow + 1; // 1-based for formula
                    const r2 = dataEndRow + 1;
                    const colLetter = this._colToLetter(c);
                    const funcName =
                        func === "count"
                            ? "COUNT"
                            : func === "average"
                              ? "AVERAGE"
                              : func === "min"
                                ? "MIN"
                                : func === "max"
                                  ? "MAX"
                                  : "SUM";
                    setCell(newTotalRow, c, {
                        value: null,
                        formula: `=${funcName}(${colLetter}${r1}:${colLetter}${r2})`,
                    });
                }
            }

            this.tables.set(tableId, {
                ...table,
                range: {
                    ...table.range,
                    end: { ...table.range.end, row: newTotalRow },
                },
                showTotalRow: true,
            });
        }
        this._notify();
    }

    renameTable(tableId: string, name: string): void {
        if (!name || /\s/.test(name))
            throw new Error("표 이름에 공백이 없어야 합니다");
        if (/^[A-Za-z]+\d+$/.test(name))
            throw new Error("셀 주소와 같은 이름은 사용할 수 없습니다");

        const existing = new Set(
            [...this.tables.values()]
                .filter((t) => t.id !== tableId)
                .map((t) => t.name),
        );
        if (existing.has(name))
            throw new Error(`이름 "${name}"은 이미 사용 중입니다`);

        const table = this.tables.get(tableId);
        if (!table) return;
        this.tables.set(tableId, { ...table, name });
        this._notify();
    }

    addColumn(
        tableId: string,
        position: number | undefined,
        setCell: (row: number, col: number, data: CellData) => void,
    ): void {
        const table = this.tables.get(tableId);
        if (!table) return;

        const newColIdx = position ?? table.columns.length;
        const absoluteCol = table.range.end.col + 1;
        const newColumn: TableColumn = {
            index: newColIdx,
            name: `Column ${table.columns.length + 1}`,
        };

        if (table.showHeaderRow) {
            setCell(table.range.start.row, absoluteCol, {
                value: newColumn.name,
            });
        }

        this.tables.set(tableId, {
            ...table,
            range: {
                ...table.range,
                end: { ...table.range.end, col: absoluteCol },
            },
            columns: [...table.columns, newColumn],
        });
        this._notify();
    }

    checkAutoExpand(
        sheetId: string,
        row: number,
        col: number,
        _getCell: (row: number, col: number) => CellData | null,
    ): string | null {
        for (const table of this.tables.values()) {
            if (table.sheetId !== sheetId) continue;
            const nextRow = table.range.end.row + 1;
            if (row !== nextRow) continue;
            if (col < table.range.start.col || col > table.range.end.col)
                continue;
            return table.id;
        }
        return null;
    }

    expandTable(
        tableId: string,
        _setCell: (row: number, col: number, data: CellData | null) => void,
    ): void {
        const table = this.tables.get(tableId);
        if (!table) return;
        this.tables.set(tableId, {
            ...table,
            range: {
                ...table.range,
                end: { ...table.range.end, row: table.range.end.row + 1 },
            },
        });
        this._notify();
    }

    getTableAt(
        sheetId: string,
        row: number,
        col: number,
    ): TableDefinition | null {
        for (const table of this.tables.values()) {
            if (table.sheetId !== sheetId) continue;
            const r1 = Math.min(table.range.start.row, table.range.end.row);
            const r2 = Math.max(table.range.start.row, table.range.end.row);
            const c1 = Math.min(table.range.start.col, table.range.end.col);
            const c2 = Math.max(table.range.start.col, table.range.end.col);
            if (row >= r1 && row <= r2 && col >= c1 && col <= c2) return table;
        }
        return null;
    }

    getTablesForSheet(sheetId: string): TableDefinition[] {
        return [...this.tables.values()].filter((t) => t.sheetId === sheetId);
    }

    getAllTables(): TableDefinition[] {
        return [...this.tables.values()];
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private _detectHeaders(
        startRow: number,
        startCol: number,
        endCol: number,
        getCell: (row: number, col: number) => CellData | null,
    ): boolean {
        for (let c = startCol; c <= endCol; c++) {
            const cell = getCell(startRow, c);
            if (cell?.value !== null && typeof cell?.value !== "string")
                return false;
        }
        return true;
    }

    private _generateName(): string {
        const names = new Set([...this.tables.values()].map((t) => t.name));
        let n = 1;
        while (names.has(`Table${n}`)) n++;
        return `Table${n}`;
    }

    private _colToLetter(col: number): string {
        let result = "";
        let n = col + 1;
        while (n > 0) {
            const r = (n - 1) % 26;
            result = String.fromCharCode(65 + r) + result;
            n = Math.floor((n - 1) / 26);
        }
        return result;
    }

    private _notify(): void {
        this.listeners.forEach((fn) => fn());
    }
}

export const tableManager = new TableManager();
