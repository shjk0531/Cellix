import type {
    CellData,
    CellValue,
    CellAddress,
    CellStyle,
} from "@cellix/shared";
import type { PivotDefinition, PivotField, AggregationType } from "./types";

interface PivotData {
    headers: string[][];
    colHeaders: string[][];
    values: (number | null)[][];
    rowGrandTotals?: (number | null)[];
    colGrandTotals?: (number | null)[];
    grandTotal?: number | null;
}

export class PivotEngine {
    calculate(
        def: PivotDefinition,
        getCell: (sheetId: string, row: number, col: number) => CellData | null,
    ): PivotData {
        const records = this._readSourceData(def, getCell);

        if (records.length === 0 || def.valueFields.length === 0) {
            return { headers: [], colHeaders: [], values: [] };
        }

        const rowCombos: CellValue[][] =
            def.rowFields.length > 0
                ? this._uniqueCombos(records, def.rowFields)
                : [[]];

        const colCombos: CellValue[][] | null =
            def.colFields.length > 0
                ? this._uniqueCombos(records, def.colFields)
                : null;

        // ── Build column headers ─────────────────────────────────────────────
        let colHeaders: string[][];
        let numDataCols: number;

        if (colCombos === null) {
            colHeaders = [
                def.valueFields.map((f) => f.displayName ?? f.fieldName),
            ];
            numDataCols = def.valueFields.length;
        } else {
            numDataCols = colCombos.length * def.valueFields.length;
            const levels = def.colFields.length;
            colHeaders = Array.from({ length: levels }, () => [] as string[]);

            for (const combo of colCombos) {
                for (let vi = 0; vi < def.valueFields.length; vi++) {
                    for (let li = 0; li < levels; li++) {
                        colHeaders[li].push(String(combo[li] ?? ""));
                    }
                }
            }
            if (def.valueFields.length > 1) {
                const vfRow: string[] = [];
                for (let ci = 0; ci < colCombos.length; ci++) {
                    for (const vf of def.valueFields) {
                        vfRow.push(vf.displayName ?? vf.fieldName);
                    }
                }
                colHeaders.push(vfRow);
            }
        }

        // ── Build row headers ────────────────────────────────────────────────
        const headers: string[][] = rowCombos.map((combo) =>
            combo.map((v) => String(v ?? "")),
        );

        // ── Build values grid ────────────────────────────────────────────────
        const values: (number | null)[][] = [];

        for (const rowCombo of rowCombos) {
            const rowRecords =
                def.rowFields.length > 0
                    ? records.filter((r) =>
                          def.rowFields.every((f, i) =>
                              this._valEq(r[f.fieldName], rowCombo[i]),
                          ),
                      )
                    : records;

            const rowData: (number | null)[] = [];

            if (colCombos === null) {
                for (const vf of def.valueFields) {
                    const vals = rowRecords.map((r) => r[vf.fieldName]);
                    rowData.push(this._aggregate(vals, vf.aggregation));
                }
            } else {
                for (const colCombo of colCombos) {
                    const colRecords = rowRecords.filter((r) =>
                        def.colFields.every((f, i) =>
                            this._valEq(r[f.fieldName], colCombo[i]),
                        ),
                    );
                    for (const vf of def.valueFields) {
                        const vals = colRecords.map((r) => r[vf.fieldName]);
                        rowData.push(this._aggregate(vals, vf.aggregation));
                    }
                }
            }

            values.push(rowData);
        }

        // ── Grand totals ─────────────────────────────────────────────────────
        let rowGrandTotals: (number | null)[] | undefined;
        let colGrandTotals: (number | null)[] | undefined;
        let grandTotal: number | null | undefined;

        if (def.showRowGrandTotal) {
            rowGrandTotals = Array.from({ length: numDataCols }, (_, ci) => {
                const nums = values
                    .map((row) => row[ci])
                    .filter((v): v is number => typeof v === "number");
                return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
            });
        }

        if (def.showColGrandTotal) {
            colGrandTotals = values.map((row) => {
                const nums = row.filter(
                    (v): v is number => typeof v === "number",
                );
                return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
            });
        }

        if (def.showRowGrandTotal && def.showColGrandTotal) {
            const allNums = values
                .flat()
                .filter((v): v is number => typeof v === "number");
            grandTotal =
                allNums.length > 0 ? allNums.reduce((a, b) => a + b, 0) : null;
        }

        return {
            headers,
            colHeaders,
            values,
            rowGrandTotals,
            colGrandTotals,
            grandTotal,
        };
    }

    writeToSheet(
        data: PivotData,
        def: PivotDefinition,
        setCell: (
            sheetId: string,
            row: number,
            col: number,
            cellData: CellData,
        ) => void,
    ): void {
        const {
            targetSheetId: sid,
            targetStartRow: r0,
            targetStartCol: c0,
        } = def;
        const numRowFields = Math.max(def.rowFields.length, 1);
        const numColLevels = data.colHeaders.length;
        const numDataRows = data.values.length;
        const numDataCols = data.values[0]?.length ?? 0;

        const hdrStyle: CellStyle = {
            font: { weight: "bold" },
            backgroundColor: "#f3f4f6",
        };
        const totalStyle: CellStyle = {
            font: { weight: "bold" },
            backgroundColor: "#e5e7eb",
        };

        // ── 1. Column header rows ────────────────────────────────────────────
        for (let li = 0; li < numColLevels; li++) {
            for (let fc = 0; fc < numRowFields; fc++) {
                setCell(sid, r0 + li, c0 + fc, {
                    value: null,
                    style: hdrStyle,
                });
            }
            for (let ci = 0; ci < numDataCols; ci++) {
                setCell(sid, r0 + li, c0 + numRowFields + ci, {
                    value: data.colHeaders[li]?.[ci] ?? null,
                    style: hdrStyle,
                });
            }
            if (def.showColGrandTotal) {
                setCell(sid, r0 + li, c0 + numRowFields + numDataCols, {
                    value: li === numColLevels - 1 ? "총합계" : null,
                    style: hdrStyle,
                });
            }
        }

        // ── 2. Row header merge spans ────────────────────────────────────────
        const rowSpans = this._computeRowSpans(data.headers, numRowFields);

        // ── 3. Data rows ─────────────────────────────────────────────────────
        for (let ri = 0; ri < numDataRows; ri++) {
            const absRow = r0 + numColLevels + ri;

            for (let fi = 0; fi < numRowFields; fi++) {
                const key = `${ri}:${fi}`;
                const span = rowSpans.get(key) ?? 1;
                const val = data.headers[ri]?.[fi] ?? "";

                if (span === 0) {
                    const masterRi = this._findMasterRow(ri, fi, data.headers);
                    const masterAddr: CellAddress = {
                        row: r0 + numColLevels + masterRi,
                        col: c0 + fi,
                        sheetId: sid,
                    };
                    setCell(sid, absRow, c0 + fi, {
                        value: null,
                        style: hdrStyle,
                        mergeInfo: {
                            rowSpan: 1,
                            colSpan: 1,
                            isMerged: true,
                            masterCell: masterAddr,
                        },
                    });
                } else {
                    setCell(sid, absRow, c0 + fi, {
                        value: val,
                        style: hdrStyle,
                        mergeInfo:
                            span > 1
                                ? { rowSpan: span, colSpan: 1, isMerged: false }
                                : undefined,
                    });
                }
            }

            for (let ci = 0; ci < numDataCols; ci++) {
                setCell(sid, absRow, c0 + numRowFields + ci, {
                    value: data.values[ri]?.[ci] ?? null,
                });
            }

            if (def.showColGrandTotal && data.colGrandTotals) {
                setCell(sid, absRow, c0 + numRowFields + numDataCols, {
                    value: data.colGrandTotals[ri] ?? null,
                    style: totalStyle,
                });
            }
        }

        // ── 4. Row grand total row ───────────────────────────────────────────
        if (def.showRowGrandTotal && data.rowGrandTotals) {
            const absRow = r0 + numColLevels + numDataRows;
            setCell(sid, absRow, c0, { value: "총합계", style: totalStyle });
            for (let fi = 1; fi < numRowFields; fi++) {
                setCell(sid, absRow, c0 + fi, {
                    value: null,
                    style: totalStyle,
                });
            }
            for (let ci = 0; ci < numDataCols; ci++) {
                setCell(sid, absRow, c0 + numRowFields + ci, {
                    value: data.rowGrandTotals[ci] ?? null,
                    style: totalStyle,
                });
            }
            if (def.showColGrandTotal && data.grandTotal !== undefined) {
                setCell(sid, absRow, c0 + numRowFields + numDataCols, {
                    value: data.grandTotal,
                    style: totalStyle,
                });
            }
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private _readSourceData(
        def: PivotDefinition,
        getCell: (sheetId: string, row: number, col: number) => CellData | null,
    ): Record<string, CellValue>[] {
        const { start, end } = def.sourceRange;
        const { sourceSheetId } = def;

        const headerNames: string[] = [];
        for (let c = start.col; c <= end.col; c++) {
            const cell = getCell(sourceSheetId, start.row, c);
            headerNames.push(String(cell?.value ?? `Col${c - start.col + 1}`));
        }

        const records: Record<string, CellValue>[] = [];
        for (let r = start.row + 1; r <= end.row; r++) {
            const record: Record<string, CellValue> = {};
            for (let c = start.col; c <= end.col; c++) {
                const cell = getCell(sourceSheetId, r, c);
                record[headerNames[c - start.col]!] = cell?.value ?? null;
            }
            records.push(record);
        }
        return records;
    }

    private _uniqueCombos(
        records: Record<string, CellValue>[],
        fields: PivotField[],
    ): CellValue[][] {
        const seen = new Set<string>();
        const result: CellValue[][] = [];
        for (const r of records) {
            const combo = fields.map((f) => r[f.fieldName] ?? null);
            const key = JSON.stringify(combo);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(combo);
            }
        }
        return result;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _groupBy(
        records: Record<string, CellValue>[],
        fields: PivotField[],
    ): Map<string, any> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = new Map<string, any>();
        const [first, ...rest] = fields;
        if (!first) return result;

        for (const r of records) {
            const key = String(r[first.fieldName] ?? "");
            if (!result.has(key)) result.set(key, []);
            (result.get(key) as Record<string, CellValue>[]).push(r);
        }

        if (rest.length > 0) {
            for (const [key, group] of result.entries()) {
                result.set(
                    key,
                    this._groupBy(group as Record<string, CellValue>[], rest),
                );
            }
        }

        return result;
    }

    private _aggregate(
        values: CellValue[],
        type: AggregationType,
    ): number | null {
        const nums = values.filter((v): v is number => typeof v === "number");
        const nonNull = values.filter((v) => v !== null);

        switch (type) {
            case "sum":
                return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
            case "count":
                return nonNull.length;
            case "countNumbers":
                return nums.length;
            case "average":
                return nums.length > 0
                    ? nums.reduce((a, b) => a + b, 0) / nums.length
                    : null;
            case "max":
                return nums.length > 0 ? Math.max(...nums) : null;
            case "min":
                return nums.length > 0 ? Math.min(...nums) : null;
            case "product":
                return nums.length > 0 ? nums.reduce((a, b) => a * b, 1) : null;
        }
    }

    private _valEq(
        a: CellValue | undefined,
        b: CellValue | undefined,
    ): boolean {
        if ((a ?? null) === null && (b ?? null) === null) return true;
        return String(a ?? "") === String(b ?? "");
    }

    private _computeRowSpans(
        headers: string[][],
        numRowFields: number,
    ): Map<string, number> {
        const spans = new Map<string, number>();
        for (let fi = 0; fi < numRowFields; fi++) {
            let ri = 0;
            while (ri < headers.length) {
                let end = ri + 1;
                while (
                    end < headers.length &&
                    this._sameParentGroup(headers, ri, end, fi)
                ) {
                    end++;
                }
                const span = end - ri;
                spans.set(`${ri}:${fi}`, span);
                for (let si = ri + 1; si < end; si++) {
                    spans.set(`${si}:${fi}`, 0);
                }
                ri = end;
            }
        }
        return spans;
    }

    private _sameParentGroup(
        headers: string[][],
        baseRow: number,
        checkRow: number,
        upToField: number,
    ): boolean {
        for (let fi = 0; fi <= upToField; fi++) {
            if (
                (headers[baseRow]?.[fi] ?? "") !==
                (headers[checkRow]?.[fi] ?? "")
            )
                return false;
        }
        return true;
    }

    private _findMasterRow(
        row: number,
        fi: number,
        headers: string[][],
    ): number {
        let master = row - 1;
        while (master >= 0 && this._sameParentGroup(headers, master, row, fi)) {
            master--;
        }
        return master + 1;
    }
}
