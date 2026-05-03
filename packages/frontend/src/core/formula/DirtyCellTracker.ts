export class DirtyCellTracker {
    private dirty = new Set<string>() // "${sheetId}:${row}:${col}"
    private listeners = new Set<() => void>()

    markDirty(sheetId: string, row: number, col: number): void {
        this.dirty.add(`${sheetId}:${row}:${col}`)
        for (const fn of this.listeners) fn()
    }

    markDirtyBatch(cells: Array<{ sheetId: string; row: number; col: number }>): void {
        for (const c of cells) {
            this.dirty.add(`${c.sheetId}:${c.row}:${c.col}`)
        }
        if (cells.length > 0) {
            for (const fn of this.listeners) fn()
        }
    }

    getAndClear(): string[] {
        const result = [...this.dirty]
        this.dirty.clear()
        return result
    }

    hasDirty(): boolean { return this.dirty.size > 0 }

    onDirty(fn: () => void): () => void {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
    }
}

export const dirtyCellTracker = new DirtyCellTracker()
