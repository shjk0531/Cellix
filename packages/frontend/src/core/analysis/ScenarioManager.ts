import type { CellData } from '@cellix/shared'

export interface Scenario {
    id: string
    name: string
    changingCells: Array<{
        row: number
        col: number
        sheetId: string
        value: string | number | null
    }>
    comment?: string
}

export class ScenarioManager {
    private readonly scenarios = new Map<string, Scenario[]>()

    addScenario(sheetId: string, scenario: Omit<Scenario, 'id'>): string {
        const id = crypto.randomUUID()
        const list = this.scenarios.get(sheetId) ?? []
        list.push({ ...scenario, id })
        this.scenarios.set(sheetId, list)
        return id
    }

    deleteScenario(sheetId: string, id: string): void {
        const list = this.scenarios.get(sheetId)
        if (!list) return
        const next = list.filter(s => s.id !== id)
        this.scenarios.set(sheetId, next)
    }

    showScenario(
        sheetId: string,
        id: string,
        setCell: (row: number, col: number, data: CellData) => void,
    ): void {
        const list = this.scenarios.get(sheetId) ?? []
        const scenario = list.find(s => s.id === id)
        if (!scenario) return

        for (const cell of scenario.changingCells) {
            setCell(cell.row, cell.col, { value: cell.value })
        }
    }

    getScenariosForSheet(sheetId: string): Scenario[] {
        return this.scenarios.get(sheetId) ?? []
    }

    /**
     * 시나리오 요약 보고서 생성.
     * 새 시트(summarySheetId)에 비교표를 기록.
     * 행: 변경 셀 레이블, 결과 셀 값
     * 열: 각 시나리오
     */
    generateSummary(
        sheetId: string,
        resultCells: Array<{ row: number; col: number }>,
        setCell: (targetSheetId: string, row: number, col: number, data: CellData) => void,
        summarySheetId: string,
        getCell: (row: number, col: number) => CellData | null,
    ): void {
        const list = this.scenarios.get(sheetId) ?? []
        if (list.length === 0) return

        let row = 0

        // 헤더 행: 빈 셀 + 시나리오 이름들
        setCell(summarySheetId, row, 0, { value: '변경 셀 / 시나리오' })
        for (let i = 0; i < list.length; i++) {
            setCell(summarySheetId, row, i + 1, { value: list[i].name })
        }
        row++

        // 변경 셀 행들
        const allChangingCells = new Map<string, { row: number; col: number }>()
        for (const scenario of list) {
            for (const cell of scenario.changingCells) {
                const key = `${cell.row}:${cell.col}`
                if (!allChangingCells.has(key)) {
                    allChangingCells.set(key, { row: cell.row, col: cell.col })
                }
            }
        }

        for (const [, cell] of allChangingCells) {
            const colLetter = _colToLetter(cell.col)
            setCell(summarySheetId, row, 0, { value: `${colLetter}${cell.row + 1}` })

            for (let i = 0; i < list.length; i++) {
                const found = list[i].changingCells.find(
                    c => c.row === cell.row && c.col === cell.col,
                )
                setCell(summarySheetId, row, i + 1, { value: found?.value ?? null })
            }
            row++
        }

        // 구분선
        row++

        // 결과 셀 행들 (현재 시트의 현재 값)
        setCell(summarySheetId, row, 0, { value: '결과 셀' })
        row++

        for (const rc of resultCells) {
            const colLetter = _colToLetter(rc.col)
            setCell(summarySheetId, row, 0, { value: `${colLetter}${rc.row + 1}` })

            const currentVal = getCell(rc.row, rc.col)
            for (let i = 0; i < list.length; i++) {
                setCell(summarySheetId, row, i + 1, { value: currentVal?.value ?? null })
            }
            row++
        }
    }
}

function _colToLetter(col: number): string {
    let result = ''
    let n = col + 1
    while (n > 0) {
        const r = (n - 1) % 26
        result = String.fromCharCode(65 + r) + result
        n = Math.floor((n - 1) / 26)
    }
    return result
}

export const scenarioManager = new ScenarioManager()
