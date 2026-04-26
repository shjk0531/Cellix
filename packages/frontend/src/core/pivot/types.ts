import type { CellRange } from '@cellix/shared'

export type AggregationType =
    | 'sum'
    | 'count'
    | 'average'
    | 'max'
    | 'min'
    | 'countNumbers'
    | 'product'

export interface PivotField {
    fieldName: string
    displayName?: string
}

export interface PivotValueField extends PivotField {
    aggregation: AggregationType
    numberFormat?: string
}

export interface PivotDefinition {
    id: string
    name: string
    sourceSheetId: string
    sourceRange: CellRange
    targetSheetId: string
    targetStartRow: number
    targetStartCol: number
    rowFields: PivotField[]
    colFields: PivotField[]
    valueFields: PivotValueField[]
    filterFields: PivotField[]
    showRowGrandTotal: boolean
    showColGrandTotal: boolean
    showSubtotals: boolean
}
