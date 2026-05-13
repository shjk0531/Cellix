import type { CellData } from "@cellix/shared";
import type { PivotDefinition } from "./types";
import { PivotEngine } from "./PivotEngine";

export class PivotManager {
    private readonly pivots = new Map<string, PivotDefinition>();
    private readonly listeners = new Set<() => void>();
    private readonly engine = new PivotEngine();

    createPivot(def: Omit<PivotDefinition, "id">): PivotDefinition {
        const pivot: PivotDefinition = { ...def, id: crypto.randomUUID() };
        this.pivots.set(pivot.id, pivot);
        this._notify();
        return pivot;
    }

    updatePivot(id: string, patch: Partial<PivotDefinition>): void {
        const existing = this.pivots.get(id);
        if (!existing) return;
        this.pivots.set(id, { ...existing, ...patch });
        this._notify();
    }

    deletePivot(id: string): void {
        this.pivots.delete(id);
        this._notify();
    }

    refreshPivot(
        id: string,
        getCell: (sheetId: string, row: number, col: number) => CellData | null,
        setCell: (
            sheetId: string,
            row: number,
            col: number,
            data: CellData,
        ) => void,
    ): void {
        const def = this.pivots.get(id);
        if (!def) return;
        const data = this.engine.calculate(def, getCell);
        this.engine.writeToSheet(data, def, setCell);
    }

    getPivot(id: string): PivotDefinition | undefined {
        return this.pivots.get(id);
    }

    getAllPivots(): PivotDefinition[] {
        return [...this.pivots.values()];
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private _notify(): void {
        this.listeners.forEach((fn) => fn());
    }
}

export const pivotManager = new PivotManager();
