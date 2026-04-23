import { create } from 'zustand'
import type { CellData } from '@cellix/shared'
import type { SelectionRange, SelectionState } from '../core/selection'
import type { EditState } from '../core/input'
import type { HistoryState } from '../core/history'

interface UIState {
    selections: SelectionRange[]
    activeCell: { row: number; col: number } | null
    editMode: 'none' | 'edit' | 'formula'
    editValue: string
    canUndo: boolean
    canRedo: boolean
    /** 현재 활성 셀의 데이터 — FormulaBar 표시용 */
    activeCellData: CellData | null

    setSelectionState: (state: SelectionState) => void
    setEditState: (state: EditState) => void
    setHistoryState: (state: HistoryState) => void
    setActiveCellData: (data: CellData | null) => void
}

export const useUIStore = create<UIState>()((set) => ({
    selections: [],
    activeCell: null,
    editMode: 'none',
    editValue: '',
    canUndo: false,
    canRedo: false,
    activeCellData: null,

    setSelectionState: (state) =>
        set({ selections: state.selections, activeCell: state.activeCell }),

    setEditState: (state) =>
        set({ editMode: state.mode, editValue: state.value }),

    setHistoryState: (state) =>
        set({ canUndo: state.canUndo, canRedo: state.canRedo }),

    setActiveCellData: (data) => set({ activeCellData: data }),
}))
