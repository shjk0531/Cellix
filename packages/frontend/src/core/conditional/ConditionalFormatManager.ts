import type { CellStyle, CellRange } from '@cellix/shared'
import type {
    CondFmtEntry,
    CondFmtRule,
    CondFmtCellValueRule,
    CondFmtColorScaleRule,
    CondFmtDataBarRule,
    CondFmtTopBottomRule,
} from './types'

type CellVal = string | number | boolean | null

let _idCounter = 0

// ── 색상 보간 유틸 ────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
    const h = hex.replace('#', '').padEnd(6, '0')
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ]
}

function toHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b]
        .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
        .join('')
}

function lerpColor(c1: string, c2: string, t: number): string {
    const [r1, g1, b1] = parseHex(c1)
    const [r2, g2, b2] = parseHex(c2)
    return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

export type CondFmtCellResult = {
    style?: Partial<CellStyle>
    dataBarWidth?: number
    dataBarColor?: string
}

export class ConditionalFormatManager {
    private entries: CondFmtEntry[] = []
    private listeners = new Set<() => void>()

    addRule(entry: Omit<CondFmtEntry, 'id'>): string {
        const id = `cfmt_${Date.now()}_${_idCounter++}`
        this.entries.push({ ...entry, id })
        this._notify()
        return id
    }

    removeRule(id: string): void {
        this.entries = this.entries.filter(e => e.id !== id)
        this._notify()
    }

    updateRule(id: string, patch: Partial<CondFmtEntry>): void {
        this.entries = this.entries.map(e => e.id === id ? { ...e, ...patch } : e)
        this._notify()
    }

    getRulesForSheet(sheetId: string): CondFmtEntry[] {
        return this.entries.filter(e => e.sheetId === sheetId)
    }

    evaluateCell(
        sheetId: string,
        row: number,
        col: number,
        cellValue: CellVal,
        getCellValues: (sheetId: string, range: CellRange) => CellVal[],
    ): CondFmtCellResult {
        const applicable = this.entries
            .filter(e =>
                e.sheetId === sheetId &&
                row >= Math.min(e.range.start.row, e.range.end.row) &&
                row <= Math.max(e.range.start.row, e.range.end.row) &&
                col >= Math.min(e.range.start.col, e.range.end.col) &&
                col <= Math.max(e.range.start.col, e.range.end.col),
            )
            .sort((a, b) => a.priority - b.priority)

        if (!applicable.length) return {}

        let mergedStyle: Partial<CellStyle> | undefined
        let dataBarWidth: number | undefined
        let dataBarColor: string | undefined

        for (const entry of applicable) {
            // 데이터 막대는 _evalRule 밖에서 처리
            if (entry.rule.type === 'dataBar') {
                if (typeof cellValue === 'number') {
                    const rangeVals = getCellValues(sheetId, entry.range)
                    const nums = rangeVals.filter((v): v is number => typeof v === 'number')
                    dataBarWidth = this._calcDataBar(cellValue, entry.rule, nums)
                    dataBarColor = entry.rule.color
                }
                continue
            }

            const rangeVals = getCellValues(sheetId, entry.range)
            const result = this._evalRule(entry.rule, cellValue, rangeVals)

            if (result === null || result === false) continue

            if (typeof result === 'object') {
                // colorScale이 계산한 backgroundColor
                mergedStyle = mergedStyle ? { ...mergedStyle, ...result } : result
            } else {
                // result === true — cellValue / topBottom 매칭 → rule.format 적용
                const r = entry.rule
                if (r.type === 'cellValue' || r.type === 'topBottom' || r.type === 'formula') {
                    const fmt = r.format
                    mergedStyle = mergedStyle ? { ...mergedStyle, ...fmt } : { ...fmt }
                }
            }

            if (entry.stopIfTrue) break
        }

        return { style: mergedStyle, dataBarWidth, dataBarColor }
    }

    private _evalRule(
        rule: Exclude<CondFmtRule, CondFmtDataBarRule>,
        value: CellVal,
        rangeValues: CellVal[],
    ): boolean | Partial<CellStyle> | null {
        switch (rule.type) {
            case 'cellValue':
                return this._matchCellValue(value, rule)

            case 'formula':
                // 동기 수식 평가 미지원 (WASM 엔진은 비동기)
                return null

            case 'colorScale': {
                if (typeof value !== 'number') return null
                const nums = rangeValues.filter((v): v is number => typeof v === 'number')
                return { backgroundColor: this._calcColorScale(value, rule, nums) }
            }

            case 'topBottom': {
                const nums = rangeValues.filter((v): v is number => typeof v === 'number')
                if (!nums.length || typeof value !== 'number') return false
                const n = rule.percent
                    ? Math.max(1, Math.ceil(nums.length * rule.rank / 100))
                    : Math.min(rule.rank, nums.length)
                const sorted = [...nums].sort((a, b) => a - b)
                return rule.bottom
                    ? value <= sorted[n - 1]
                    : value >= sorted[nums.length - n]
            }
        }
    }

    private _matchCellValue(value: CellVal, rule: CondFmtCellValueRule): boolean {
        const parse = (s?: string): CellVal => {
            if (s === undefined || s === '') return null
            const n = Number(s)
            return !isNaN(n) && s.trim() !== '' ? n : s
        }
        const v1 = parse(rule.value1)
        const v2 = parse(rule.value2)

        switch (rule.operator) {
            case 'equal': return value === v1
            case 'notEqual': return value !== v1
            case 'greaterThan':
                return typeof value === 'number' && typeof v1 === 'number' && value > v1
            case 'greaterThanOrEqual':
                return typeof value === 'number' && typeof v1 === 'number' && value >= v1
            case 'lessThan':
                return typeof value === 'number' && typeof v1 === 'number' && value < v1
            case 'lessThanOrEqual':
                return typeof value === 'number' && typeof v1 === 'number' && value <= v1
            case 'between':
                return typeof value === 'number' && typeof v1 === 'number' && typeof v2 === 'number'
                    && value >= v1 && value <= v2
            case 'notBetween':
                return typeof value === 'number' && typeof v1 === 'number' && typeof v2 === 'number'
                    && (value < v1 || value > v2)
            case 'containsText':
                return typeof value === 'string' && typeof v1 === 'string' && value.includes(v1)
            case 'notContainsText':
                return typeof value === 'string' && typeof v1 === 'string' && !value.includes(v1)
            case 'beginsWith':
                return typeof value === 'string' && typeof v1 === 'string' && value.startsWith(v1)
            case 'endsWith':
                return typeof value === 'string' && typeof v1 === 'string' && value.endsWith(v1)
            case 'isBlank': return value === null || value === ''
            case 'isNotBlank': return value !== null && value !== ''
            case 'isDuplicate': return false  // TODO: rangeValues 기반 구현 필요
            case 'isUnique': return false     // TODO: rangeValues 기반 구현 필요
            default: return false
        }
    }

    private _calcColorScale(value: number, rule: CondFmtColorScaleRule, values: number[]): string {
        if (!values.length) return rule.minColor
        const sorted = [...values].sort((a, b) => a - b)

        const resolveMin = (): number => {
            switch (rule.minType) {
                case 'min': return sorted[0]
                case 'number': return rule.minValue ?? sorted[0]
                case 'percent':
                    return sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * (rule.minValue ?? 0) / 100
                case 'percentile':
                    return sorted[Math.floor((rule.minValue ?? 0) / 100 * (sorted.length - 1))]
            }
        }

        const resolveMax = (): number => {
            switch (rule.maxType) {
                case 'max': return sorted[sorted.length - 1]
                case 'number': return rule.maxValue ?? sorted[sorted.length - 1]
                case 'percent':
                    return sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * (rule.maxValue ?? 100) / 100
                case 'percentile':
                    return sorted[Math.floor((rule.maxValue ?? 100) / 100 * (sorted.length - 1))]
            }
        }

        const minVal = resolveMin()
        const maxVal = resolveMax()
        if (minVal >= maxVal) return rule.minColor

        const t = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)))

        if (rule.midColor && rule.midType !== undefined) {
            const midVal = rule.midValue ?? (minVal + maxVal) / 2
            const tMid = Math.max(0, Math.min(1, (midVal - minVal) / (maxVal - minVal)))
            if (t <= tMid) {
                return lerpColor(rule.minColor, rule.midColor, tMid === 0 ? 0 : t / tMid)
            } else {
                return lerpColor(rule.midColor, rule.maxColor, tMid === 1 ? 1 : (t - tMid) / (1 - tMid))
            }
        }

        return lerpColor(rule.minColor, rule.maxColor, t)
    }

    private _calcDataBar(value: number, rule: CondFmtDataBarRule, values: number[]): number {
        if (!values.length) return 0
        const min = rule.minValue ?? Math.min(0, ...values)
        const max = rule.maxValue ?? Math.max(...values)
        if (min >= max) return 0
        return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private _notify() { this.listeners.forEach(fn => fn()) }
}

export const conditionalFormatManager = new ConditionalFormatManager()
