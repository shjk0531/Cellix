import type { CellStyle } from '@cellix/shared'
import type { TableDefinition } from '@cellix/shared'

interface TableStyleDef {
    header: { backgroundColor: string; color: string }
    bandedRow1: { backgroundColor: string }
    bandedRow2: { backgroundColor?: string }
    totalRow: { backgroundColor: string }
}

const TABLE_STYLES: Record<string, TableStyleDef> = {
    TableStyleLight1: {
        header: { backgroundColor: '#1167b1', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#deeaf1' },
        bandedRow2: {},
        totalRow: { backgroundColor: '#deeaf1' },
    },
    TableStyleLight2: {
        header: { backgroundColor: '#e8700a', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#fce4d6' },
        bandedRow2: {},
        totalRow: { backgroundColor: '#fce4d6' },
    },
    TableStyleLight3: {
        header: { backgroundColor: '#70ad47', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#e2efda' },
        bandedRow2: {},
        totalRow: { backgroundColor: '#e2efda' },
    },
    TableStyleLight4: {
        header: { backgroundColor: '#ffd966', color: '#000000' },
        bandedRow1: { backgroundColor: '#fff2cc' },
        bandedRow2: {},
        totalRow: { backgroundColor: '#fff2cc' },
    },
    TableStyleLight5: {
        header: { backgroundColor: '#4472c4', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#dae3f3' },
        bandedRow2: {},
        totalRow: { backgroundColor: '#dae3f3' },
    },
    TableStyleLight6: {
        header: { backgroundColor: '#e74c3c', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#fce4e4' },
        bandedRow2: {},
        totalRow: { backgroundColor: '#fce4e4' },
    },
    TableStyleMedium1: {
        header: { backgroundColor: '#1565c0', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#bbdefb' },
        bandedRow2: { backgroundColor: '#e3f2fd' },
        totalRow: { backgroundColor: '#1565c0' },
    },
    TableStyleMedium2: {
        header: { backgroundColor: '#00695c', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#b2dfdb' },
        bandedRow2: { backgroundColor: '#e0f2f1' },
        totalRow: { backgroundColor: '#00695c' },
    },
    TableStyleMedium3: {
        header: { backgroundColor: '#4a148c', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#e1bee7' },
        bandedRow2: { backgroundColor: '#f3e5f5' },
        totalRow: { backgroundColor: '#4a148c' },
    },
    TableStyleMedium4: {
        header: { backgroundColor: '#37474f', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#cfd8dc' },
        bandedRow2: { backgroundColor: '#eceff1' },
        totalRow: { backgroundColor: '#37474f' },
    },
    TableStyleDark1: {
        header: { backgroundColor: '#0d47a1', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#1565c0' },
        bandedRow2: { backgroundColor: '#1976d2' },
        totalRow: { backgroundColor: '#0d47a1' },
    },
    TableStyleDark2: {
        header: { backgroundColor: '#1b5e20', color: '#ffffff' },
        bandedRow1: { backgroundColor: '#2e7d32' },
        bandedRow2: { backgroundColor: '#388e3c' },
        totalRow: { backgroundColor: '#1b5e20' },
    },
}

const DEFAULT_STYLE = TABLE_STYLES['TableStyleLight1']

export class TableStyleRenderer {
    static getCellStyleForTable(
        table: TableDefinition,
        row: number,
        col: number,
    ): Partial<CellStyle> {
        const styleDef = TABLE_STYLES[table.styleName ?? ''] ?? DEFAULT_STYLE

        const headerRow = table.range.start.row
        const isHeader = table.showHeaderRow && row === headerRow

        const isTotal = table.showTotalRow && row === table.range.end.row

        const firstDataRow = table.showHeaderRow ? headerRow + 1 : headerRow
        const dataRowIndex = row - firstDataRow

        if (isHeader) {
            return {
                backgroundColor: styleDef.header.backgroundColor,
                font: { color: styleDef.header.color, weight: 'bold' },
            }
        }

        if (isTotal) {
            return {
                backgroundColor: styleDef.totalRow.backgroundColor,
                font: { weight: 'bold' },
                border: {
                    top: { style: 'double', color: styleDef.header.backgroundColor },
                },
            }
        }

        if (table.showBandedCols) {
            const colIndex = col - table.range.start.col
            const isEven = colIndex % 2 === 0
            const bg = isEven ? styleDef.bandedRow1.backgroundColor : styleDef.bandedRow2.backgroundColor
            if (bg) return { backgroundColor: bg }
        }

        if (table.showBandedRows) {
            const isEven = dataRowIndex % 2 === 0
            const bg = isEven ? styleDef.bandedRow1.backgroundColor : styleDef.bandedRow2.backgroundColor
            if (bg) return { backgroundColor: bg }
        }

        return {}
    }
}
