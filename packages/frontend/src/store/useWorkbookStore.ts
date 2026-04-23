import { create } from 'zustand'
import type { CellData } from '@cellix/shared'

export interface SheetInfo {
    id: string
    name: string
}

interface WorkbookState {
    sheets: SheetInfo[]
    activeSheetId: string
    /** key: `${sheetId}:${row}:${col}` */
    cells: Record<string, CellData>

    addSheet: () => void
    deleteSheet: (id: string) => void
    renameSheet: (id: string, name: string) => void
    setActiveSheet: (id: string) => void
    setCell: (sheetId: string, row: number, col: number, data: CellData | null) => void
    getCell: (sheetId: string, row: number, col: number) => CellData | null
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

        addSheet: () =>
            set((state) => {
                const id = mkId()
                const name = `Sheet${state.sheets.length + 1}`
                return { sheets: [...state.sheets, { id, name }], activeSheetId: id }
            }),

        deleteSheet: (id) =>
            set((state) => {
                if (state.sheets.length <= 1) return state
                const sheets = state.sheets.filter((s) => s.id !== id)
                const activeSheetId =
                    state.activeSheetId === id ? sheets[0].id : state.activeSheetId
                return { sheets, activeSheetId }
            }),

        renameSheet: (id, name) =>
            set((state) => ({
                sheets: state.sheets.map((s) => (s.id === id ? { ...s, name } : s)),
            })),

        setActiveSheet: (id) => set({ activeSheetId: id }),

        setCell: (sheetId, row, col, data) =>
            set((state) => {
                const key = cellKey(sheetId, row, col)
                if (data === null) {
                    const { [key]: _removed, ...rest } = state.cells
                    return { cells: rest }
                }
                return { cells: { ...state.cells, [key]: data } }
            }),

        getCell: (sheetId, row, col) =>
            get().cells[cellKey(sheetId, row, col)] ?? null,
    }
})
