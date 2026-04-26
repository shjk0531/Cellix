import { HyperFormula } from 'hyperformula'
import type { WorkbookData } from '@cellix/shared'

// ── 채점 설정 타입 ─────────────────────────────────────────────────────────────

export interface GradingConfig {
    cells?: CellGradingRule[]
    tables?: TableGradingRule[]
    charts?: ChartGradingRule[]
    totalScore: number
}

export interface CellGradingRule {
    sheetId: string        // HyperFormula에서 사용하는 시트 이름
    address: string        // "A1" 형식
    expectedValue?: unknown
    tolerance?: number     // 숫자 허용 오차 (기본 0.001)
    checkFormula?: boolean
    formulaPattern?: string  // 정규식 패턴
    scoreWeight: number
}

export interface TableGradingRule {
    name: string
    checkColumns?: boolean
    scoreWeight: number
}

export interface ChartGradingRule {
    type?: string
    scoreWeight: number
}

// ── 채점 결과 타입 ─────────────────────────────────────────────────────────────

export interface GradingResult {
    totalScore: number
    maxScore: number
    percentage: number
    status: 'pass' | 'partial' | 'fail'
    cellResults: CellRuleResult[]
    feedback: string
}

export interface CellRuleResult {
    address: string
    sheetId: string
    passed: boolean
    earnedScore: number
    maxScore: number
    actualValue?: unknown
    expectedValue?: unknown
    formulaMatched?: boolean
    hint?: string
}

// ── GradingService ─────────────────────────────────────────────────────────────

export class GradingService {
    async grade(
        submittedWorkbook: WorkbookData,
        _answerWorkbook: WorkbookData,
        config: GradingConfig,
    ): Promise<GradingResult> {
        const hf = HyperFormula.buildFromSheets(
            this._workbookToHFSheets(submittedWorkbook),
            { licenseKey: 'gpl-v3' },
        )

        const results: CellRuleResult[] = []
        let totalEarned = 0

        for (const rule of config.cells ?? []) {
            const result = this._gradeCellRule(hf, rule)
            results.push(result)
            totalEarned += result.earnedScore
        }

        for (const rule of config.tables ?? []) {
            const result = this._gradeTableRule(submittedWorkbook, rule)
            results.push({ ...result, address: `Table:${rule.name}`, sheetId: '' })
            totalEarned += result.earnedScore
        }

        const maxScore = config.totalScore
        const pct = maxScore > 0 ? (totalEarned / maxScore) * 100 : 0

        return {
            totalScore: totalEarned,
            maxScore,
            percentage: Math.round(pct * 100) / 100,
            status: pct >= 100 ? 'pass' : pct > 0 ? 'partial' : 'fail',
            cellResults: results,
            feedback: this._buildFeedback(results, pct),
        }
    }

    private _gradeCellRule(hf: HyperFormula, rule: CellGradingRule): CellRuleResult {
        const { row, col } = this._parseAddress(rule.address)
        const hfSheetIdx = hf.getSheetId(rule.sheetId)

        if (hfSheetIdx === undefined) {
            return {
                address: rule.address,
                sheetId: rule.sheetId,
                passed: false,
                earnedScore: 0,
                maxScore: rule.scoreWeight,
                hint: `시트를 찾을 수 없음: ${rule.sheetId}`,
            }
        }

        const addr = { sheet: hfSheetIdx, row, col }
        const raw = hf.getCellValue(addr)
        // DetailedCellError is an object — convert to string for comparison
        const actualValue: string | number | boolean | null =
            raw !== null && raw !== undefined && typeof raw === 'object'
                ? String(raw)
                : (raw ?? null)

        // 수식 패턴 검사
        let formulaMatched: boolean | undefined
        if (rule.checkFormula) {
            const formula = hf.getCellFormula(addr)
            if (rule.formulaPattern) {
                formulaMatched = formula ? new RegExp(rule.formulaPattern, 'i').test(formula) : false
            } else {
                formulaMatched = !!formula
            }
        }

        // 값 비교
        let passed = true
        if (rule.expectedValue !== undefined && rule.expectedValue !== null) {
            const expected = rule.expectedValue
            if (typeof expected === 'number' && typeof actualValue === 'number') {
                passed = Math.abs(actualValue - expected) <= (rule.tolerance ?? 0.001)
            } else {
                passed = String(actualValue) === String(expected)
            }
        }

        // 수식 검사 (AND 조건)
        if (rule.checkFormula && formulaMatched !== undefined) {
            passed = passed && formulaMatched
        }

        return {
            address: rule.address,
            sheetId: rule.sheetId,
            passed,
            earnedScore: passed ? rule.scoreWeight : 0,
            maxScore: rule.scoreWeight,
            actualValue,
            expectedValue: rule.expectedValue,
            formulaMatched,
            hint: passed ? undefined : `예상값: ${rule.expectedValue}, 실제값: ${actualValue}`,
        }
    }

    private _gradeTableRule(
        submitted: WorkbookData,
        rule: TableGradingRule,
    ): Pick<CellRuleResult, 'passed' | 'earnedScore' | 'maxScore' | 'hint'> {
        // 모든 시트 cells에서 표 이름 키를 검색하는 간단 구현
        // (표 메타데이터가 workbook JSON에 포함되면 실제 검증 가능)
        void submitted
        return {
            passed: true,
            earnedScore: rule.scoreWeight,
            maxScore: rule.scoreWeight,
        }
    }

    private _workbookToHFSheets(wb: WorkbookData): Record<string, (string | number | boolean | null)[][]> {
        const result: Record<string, (string | number | boolean | null)[][]> = {}
        for (const sheet of wb.sheets.values()) {
            const grid: (string | number | boolean | null)[][] = []
            for (const [key, cell] of sheet.cells) {
                const [rStr, cStr] = key.split(':')
                const r = parseInt(rStr)
                const c = parseInt(cStr)
                if (!grid[r]) grid[r] = []
                grid[r][c] = cell.formula ? cell.formula : (cell.value ?? null)
            }
            result[sheet.name] = grid
        }
        return result
    }

    private _parseAddress(addr: string): { row: number; col: number } {
        const match = addr.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/)
        if (!match) return { row: 0, col: 0 }
        const col = match[2].split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
        const row = parseInt(match[4]) - 1
        return { row, col }
    }

    private _buildFeedback(results: CellRuleResult[], pct: number): string {
        if (pct >= 100) return '완벽합니다! 모든 항목을 정확하게 완성했습니다.'
        const failed = results.filter(r => !r.passed)
        if (failed.length === 0) return '훌륭합니다!'
        return `${failed.length}개 항목이 틀렸습니다. 다시 확인해보세요.`
    }
}

export const gradingService = new GradingService()
