import { create } from 'zustand'
import type { CellData } from '@cellix/shared'
import { formulaEngine } from '../workers'

export interface SheetInfo {
    id: string
    name: string
}

interface WorkbookState {
    sheets: SheetInfo[]
    activeSheetId: string
    /** key: `${sheetId}:${row}:${col}` */
    cells: Record<string, CellData>
    /** WASM에서 받은 계산 결과 캐시. key: `${sheetId}:${row}:${col}` */
    calculatedValues: Record<string, string | number | boolean | null>

    addSheet: () => void
    deleteSheet: (id: string) => void
    renameSheet: (id: string, name: string) => void
    setActiveSheet: (id: string) => void
    setCell: (sheetId: string, row: number, col: number, data: CellData | null) => void
    getCell: (sheetId: string, row: number, col: number) => CellData | null
    setCalculatedValues: (values: Record<string, string | number | boolean | null>) => void
}

let _counter = 1

function mkId(): string {
    return `s${Date.now()}_${_counter++}`
}

function cellKey(sheetId: string, row: number, col: number): string {
    return `${sheetId}:${row}:${col}`
}

export const useWorkbookStore = create<WorkbookState>()((set, get) => {
    const firstId = mkId()

    return {
        sheets: [{ id: firstId, name: 'Sheet1' }],
        activeSheetId: firstId,
        cells: {},
        calculatedValues: {},

        addSheet: () => {
            const id = mkId()
            set((state) => {
                const name = `Sheet${state.sheets.length + 1}`
                return { sheets: [...state.sheets, { id, name }], activeSheetId: id }
            })
            const name = get().sheets.find((s) => s.id === id)?.name ?? 'Sheet'
            formulaEngine.addSheet(id, name).catch(console.error)
        },

        deleteSheet: (id) => {
            if (get().sheets.length <= 1) return
            set((state) => {
                const sheets = state.sheets.filter((s) => s.id !== id)
                const activeSheetId =
                    state.activeSheetId === id ? sheets[0].id : state.activeSheetId
                return { sheets, activeSheetId }
            })
            formulaEngine.removeSheet(id).catch(console.error)
        },

        renameSheet: (id, name) =>
            set((state) => ({
                sheets: state.sheets.map((s) => (s.id === id ? { ...s, name } : s)),
            })),

        setActiveSheet: (id) => {
            set({ activeSheetId: id })
            formulaEngine.setActiveSheet(id).catch(console.error)
        },

        setCell: (sheetId, row, col, data) => {
            set((state) => {
                const key = cellKey(sheetId, row, col)
                if (data === null) {
                    const { [key]: _removed, ...rest } = state.cells
                    return { cells: rest }
                }
                return { cells: { ...state.cells, [key]: data } }
            })
            formulaEngine
                .setCell(sheetId, row, col, data?.value ?? null, data?.formula)
                .catch(console.error)
        },

        getCell: (sheetId, row, col) =>
            get().cells[cellKey(sheetId, row, col)] ?? null,

        setCalculatedValues: (values) => set({ calculatedValues: values }),
    }
})
