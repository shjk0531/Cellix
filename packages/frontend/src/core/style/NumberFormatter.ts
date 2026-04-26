export class NumberFormatter {
    static format(value: number | string | boolean | null, formatCode: string): string {
        if (value === null || value === undefined) return ''
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
        if (typeof value === 'string') {
            if (formatCode === '@') return value
            return value
        }
        if (formatCode === 'General' || formatCode === '') return String(value)
        return this._applyNumericFormat(value, formatCode)
    }

    private static _applyNumericFormat(num: number, fmt: string): string {
        if (fmt.endsWith('%')) {
            const decimals = (fmt.match(/\.(\d+)/) ?? [, ''])[1]?.length ?? 0
            return (num * 100).toFixed(decimals) + '%'
        }

        if (fmt.includes('y') || fmt.includes('m') || fmt.includes('d')) {
            return this._formatDate(num, fmt)
        }

        const hasThousand = fmt.includes(',')
        const decimalMatch = fmt.match(/\.(\d+)/)
        const decimals = decimalMatch ? decimalMatch[1].length : 0
        const prefix = fmt.match(/^[^#0,.]*/)?.[0] ?? ''

        const formatted = hasThousand
            ? num.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : num.toFixed(decimals)

        return prefix + formatted
    }

    private static _formatDate(serial: number, fmt: string): string {
        const date = new Date((serial - 25569) * 86400 * 1000)
        const yyyy = date.getUTCFullYear()
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
        const dd = String(date.getUTCDate()).padStart(2, '0')
        const hh = String(date.getUTCHours()).padStart(2, '0')
        const min = String(date.getUTCMinutes()).padStart(2, '0')
        const ss = String(date.getUTCSeconds()).padStart(2, '0')
        return fmt
            .replace('yyyy', String(yyyy)).replace('yy', String(yyyy).slice(-2))
            .replace('mm', mm).replace('dd', dd)
            .replace('hh', hh).replace('mm', min).replace('ss', ss)
    }
}
