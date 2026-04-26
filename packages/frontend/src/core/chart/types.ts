import type { CellRange } from '@cellix/shared'

export type ChartType = 'bar' | 'bar_stacked' | 'line' | 'pie' | 'scatter' | 'combo'

export interface ChartAxis {
    title?: string
    min?: number
    max?: number
    gridLines?: boolean
}

export interface ChartSeries {
    name: string
    dataRange: CellRange
    chartType?: 'bar' | 'line'   // combo용
    yAxisIndex?: 0 | 1            // 이중 축
}

export interface ChartDefinition {
    id: string
    sheetId: string
    type: ChartType
    title?: string
    // 차트 위치 (셀 기반)
    anchorRow: number
    anchorCol: number
    widthCols: number
    heightRows: number
    // 데이터
    categoryRange?: CellRange
    series: ChartSeries[]
    xAxis?: ChartAxis
    yAxis?: ChartAxis
    yAxis2?: ChartAxis
    legendPosition?: 'top' | 'bottom' | 'left' | 'right' | 'none'
}
