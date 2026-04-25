import type { CellData, CellRange, CellStyle, CellValue } from '@cellix/shared'

export interface ValidationRule {
    id: string
    sheetId: string
    range: CellRange
    type: 'list' | 'number' | 'text' | 'date' | 'custom'
    operator?: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
    value1?: string
    value2?: string
    listSource?: string  // 쉼표 구분 값 또는 =A1:A10 같은 범위 참조
    allowBlank?: boolean
    showDropdown?: boolean
    errorTitle?: string
    errorMessage?: string
    promptTitle?: string
    promptMessage?: string
}

let _idCounter = 0

export class DataValidationManager {
    private rules: ValidationRule[] = []
    private readonly listeners = new Set<() => void>()

    addRule(rule: Omit<ValidationRule, 'id'>): string {
        const id = `dval_${Date.now()}_${_idCounter++}`
        this.rules.push({ ...rule, id })
        this._notify()
        return id
    }

    removeRule(id: string): void {
        this.rules = this.rules.filter(r => r.id !== id)
        this._notify()
    }

    getRulesForCell(sheetId: string, row: number, col: number): ValidationRule[] {
        return this.rules.filter(r =>
            r.sheetId === sheetId &&
            row >= Math.min(r.range.start.row, r.range.end.row) &&
            row <= Math.max(r.range.start.row, r.range.end.row) &&
            col >= Math.min(r.range.start.col, r.range.end.col) &&
            col <= Math.max(r.range.start.col, r.range.end.col),
        )
    }

    validate(
        sheetId: string,
        row: number,
        col: number,
        value: CellValue,
        getCell: (row: number, col: number) => CellData | null,
    ): { valid: boolean; message?: string; style?: Partial<CellStyle> } {
        const rules = this.getRulesForCell(sheetId, row, col)
        if (!rules.length) return { valid: true }

        for (const rule of rules) {
            if ((value === null || value === '') && (rule.allowBlank ?? true)) continue

            if (!this._validateRule(value, rule, getCell)) {
                return {
                    valid: false,
                    message: rule.errorMessage ?? '유효하지 않은 값입니다.',
                    style: {
                        border: {
                            top:    { style: 'thin', color: '#ff0000' },
                            bottom: { style: 'thin', color: '#ff0000' },
                            left:   { style: 'thin', color: '#ff0000' },
                            right:  { style: 'thin', color: '#ff0000' },
                        },
                    },
                }
            }
        }
        return { valid: true }
    }

    getListValues(
        rule: ValidationRule,
        getCell: (row: number, col: number) => CellData | null,
    ): string[] {
        if (!rule.listSource) return []

        if (rule.listSource.startsWith('=')) {
            const ref = rule.listSource.slice(1)
            const match = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
            if (!match) return []

            const colToNum = (s: string): number =>
                s.split('').reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1

            const r1 = parseInt(match[2]) - 1
            const r2 = parseInt(match[4]) - 1
            const c1 = colToNum(match[1])
            const c2 = colToNum(match[3])

            const values: string[] = []
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    const cell = getCell(r, c)
                    if (cell?.value !== null && cell?.value !== undefined) {
                        values.push(String(cell.value))
                    }
                }
            }
            return values
        }

        return rule.listSource.split(',').map(v => v.trim()).filter(v => v !== '')
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    private _validateRule(
        value: CellValue,
        rule: ValidationRule,
        getCell: (row: number, col: number) => CellData | null,
    ): boolean {
        switch (rule.type) {
            case 'list': {
                const allowed = this.getListValues(rule, getCell)
                if (!allowed.length) return true
                return allowed.includes(String(value ?? ''))
            }
            case 'number': {
                if (typeof value !== 'number') return false
                return this._checkOperator(value, rule)
            }
            case 'text': {
                if (typeof value !== 'string') return false
                return this._checkOperator(value.length, rule)
            }
            case 'date': {
                if (typeof value !== 'number') return false
                return this._checkOperator(value, rule)
            }
            default:
                return true
        }
    }

    private _checkOperator(value: number, rule: ValidationRule): boolean {
        const v1 = rule.value1 !== undefined ? Number(rule.value1) : undefined
        const v2 = rule.value2 !== undefined ? Number(rule.value2) : undefined
        switch (rule.operator) {
            case 'between':
                return v1 !== undefined && v2 !== undefined && value >= v1 && value <= v2
            case 'notBetween':
                return v1 !== undefined && v2 !== undefined && (value < v1 || value > v2)
            case 'equal':              return v1 !== undefined && value === v1
            case 'notEqual':           return v1 !== undefined && value !== v1
            case 'greaterThan':        return v1 !== undefined && value > v1
            case 'lessThan':           return v1 !== undefined && value < v1
            case 'greaterThanOrEqual': return v1 !== undefined && value >= v1
            case 'lessThanOrEqual':    return v1 !== undefined && value <= v1
            default: return true
        }
    }

    private _notify(): void {
        this.listeners.forEach(fn => fn())
    }
}

export const dataValidationManager = new DataValidationManager()
