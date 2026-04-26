import type { WorkbookData, SheetData, ColumnMeta, RowMeta, CellKey } from '../types/sheet'
import type { CellData } from '../types/cell'

export interface SerializedSheetData {
    id: string
    name: string
    cells: Record<CellKey, CellData>
    columnMeta: Record<string, ColumnMeta>
    rowMeta: Record<string, RowMeta>
    frozenRows?: number
    frozenCols?: number
    hidden?: boolean
}

export interface SerializedWorkbookData {
    id: string
    name: string
    sheets: Record<string, SerializedSheetData>
    sheetOrder: string[]
    activeSheetId: string
    createdAt: string
    updatedAt: string
}

export function serializeWorkbook(workbook: WorkbookData): SerializedWorkbookData {
    const sheets: Record<string, SerializedSheetData> = {}
    for (const [sheetId, sheet] of workbook.sheets) {
        sheets[sheetId] = {
            id: sheet.id,
            name: sheet.name,
            cells: Object.fromEntries(sheet.cells),
            columnMeta: Object.fromEntries(
                [...sheet.columnMeta.entries()].map(([k, v]) => [String(k), v]),
            ),
            rowMeta: Object.fromEntries(
                [...sheet.rowMeta.entries()].map(([k, v]) => [String(k), v]),
            ),
            frozenRows: sheet.frozenRows,
            frozenCols: sheet.frozenCols,
            hidden: sheet.hidden,
        }
    }
    return {
        id: workbook.id,
        name: workbook.name,
        sheets,
        sheetOrder: workbook.sheetOrder,
        activeSheetId: workbook.activeSheetId,
        createdAt: workbook.createdAt,
        updatedAt: workbook.updatedAt,
    }
}

export function deserializeWorkbook(data: SerializedWorkbookData): WorkbookData {
    const sheets = new Map<string, SheetData>()
    for (const [sheetId, sheet] of Object.entries(data.sheets)) {
        sheets.set(sheetId, {
            id: sheet.id,
            name: sheet.name,
            cells: new Map(Object.entries(sheet.cells)) as Map<CellKey, CellData>,
            columnMeta: new Map(
                Object.entries(sheet.columnMeta).map(([k, v]) => [Number(k), v]),
            ),
            rowMeta: new Map(
                Object.entries(sheet.rowMeta).map(([k, v]) => [Number(k), v]),
            ),
            frozenRows: sheet.frozenRows,
            frozenCols: sheet.frozenCols,
            hidden: sheet.hidden,
        })
    }
    return {
        id: data.id,
        name: data.name,
        sheets,
        sheetOrder: data.sheetOrder,
        activeSheetId: data.activeSheetId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    }
}
