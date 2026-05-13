import type { ChartDefinition } from "./types";

export class ChartManager {
    private readonly charts = new Map<string, ChartDefinition>();
    private readonly listeners = new Set<() => void>();

    createChart(def: Omit<ChartDefinition, "id">): ChartDefinition {
        const id = crypto.randomUUID();
        const chart: ChartDefinition = { ...def, id };
        this.charts.set(id, chart);
        this._notify();
        return chart;
    }

    updateChart(id: string, patch: Partial<ChartDefinition>): void {
        const existing = this.charts.get(id);
        if (!existing) return;
        this.charts.set(id, { ...existing, ...patch });
        this._notify();
    }

    deleteChart(id: string): void {
        this.charts.delete(id);
        this._notify();
    }

    getChartsForSheet(sheetId: string): ChartDefinition[] {
        return [...this.charts.values()].filter((c) => c.sheetId === sheetId);
    }

    getChartAt(
        sheetId: string,
        row: number,
        col: number,
    ): ChartDefinition | null {
        for (const chart of this.charts.values()) {
            if (chart.sheetId !== sheetId) continue;
            if (
                row >= chart.anchorRow &&
                row < chart.anchorRow + chart.heightRows &&
                col >= chart.anchorCol &&
                col < chart.anchorCol + chart.widthCols
            ) {
                return chart;
            }
        }
        return null;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private _notify(): void {
        for (const fn of this.listeners) fn();
    }
}

export const chartManager = new ChartManager();
