import { formulaEngine } from '../../workers'

export interface GoalSeekParams {
    formulaCell: { row: number; col: number }
    targetValue: number
    changingCell: { row: number; col: number }
}

export interface GoalSeekResult {
    success: boolean
    foundValue?: number
    iterations: number
    finalDiff: number
}

export class GoalSeekSolver {
    async solve(
        sheetId: string,
        params: GoalSeekParams,
        maxIterations = 1000,
        tolerance = 0.001,
    ): Promise<GoalSeekResult> {
        const { formulaCell, targetValue, changingCell } = params

        const evaluate = async (x: number): Promise<number> => {
            await formulaEngine.setCell(sheetId, changingCell.row, changingCell.col, x)
            const result = await formulaEngine.getCellValue(sheetId, formulaCell.row, formulaCell.col)
            if (result.t !== 'n' || result.v === undefined) return NaN
            return result.v as number
        }

        // 초기 탐색 범위 설정
        let lo = -1e6
        let hi = 1e6

        // 초기값으로 현재 수식 셀 값 확인
        const f0 = await evaluate(0)
        if (isNaN(f0)) {
            return { success: false, iterations: 0, finalDiff: Infinity }
        }

        // 이분법으로 lo/hi의 부호가 반대인 구간 탐색
        let fLo = await evaluate(lo) - targetValue
        let fHi = await evaluate(hi) - targetValue

        // 같은 부호이면 범위 확장 시도
        if (Math.sign(fLo) === Math.sign(fHi)) {
            const candidates = [-1e9, -1e4, -100, -1, 0, 1, 100, 1e4, 1e9]
            let found = false
            for (let i = 0; i < candidates.length - 1 && !found; i++) {
                const a = candidates[i]
                const b = candidates[i + 1]
                const fa = await evaluate(a) - targetValue
                const fb = await evaluate(b) - targetValue
                if (Math.sign(fa) !== Math.sign(fb)) {
                    lo = a; hi = b; fLo = fa; fHi = fb
                    found = true
                }
            }
            if (!found) {
                // Newton-Raphson 단독 시도
                return this._newtonRaphson(sheetId, params, evaluate, maxIterations, tolerance)
            }
        }

        let iterations = 0
        let mid = (lo + hi) / 2
        let fMid = await evaluate(mid) - targetValue

        // 이분법 + 뉴턴-랩슨 혼합
        while (iterations < maxIterations && Math.abs(fMid) > tolerance) {
            iterations++

            // 뉴턴-랩슨 스텝 시도 (수렴 가속)
            const dx = (hi - lo) * 1e-6
            const fMidPlusDx = await evaluate(mid + dx) - targetValue
            const derivative = (fMidPlusDx - fMid) / dx

            let newtonStep = mid
            if (Math.abs(derivative) > 1e-12) {
                newtonStep = mid - fMid / derivative
            }

            // 뉴턴 스텝이 구간 안에 있으면 사용, 아니면 이분법
            if (newtonStep > lo && newtonStep < hi) {
                mid = newtonStep
            } else {
                mid = (lo + hi) / 2
            }

            fMid = await evaluate(mid) - targetValue

            if (Math.sign(fMid) === Math.sign(fLo)) {
                lo = mid; fLo = fMid
            } else {
                hi = mid; fHi = fMid
            }
        }

        const success = Math.abs(fMid) <= tolerance
        if (success) {
            // 최종값을 변경 셀에 저장
            await formulaEngine.setCell(sheetId, changingCell.row, changingCell.col, mid)
        }

        return { success, foundValue: mid, iterations, finalDiff: Math.abs(fMid) }
    }

    private async _newtonRaphson(
        sheetId: string,
        params: GoalSeekParams,
        evaluate: (x: number) => Promise<number>,
        maxIterations: number,
        tolerance: number,
    ): Promise<GoalSeekResult> {
        const { targetValue, changingCell } = params
        let x = 0
        let iterations = 0

        while (iterations < maxIterations) {
            iterations++
            const fx = await evaluate(x) - targetValue
            if (Math.abs(fx) <= tolerance) {
                await formulaEngine.setCell(sheetId, changingCell.row, changingCell.col, x)
                return { success: true, foundValue: x, iterations, finalDiff: Math.abs(fx) }
            }

            const dx = Math.max(Math.abs(x) * 1e-6, 1e-8)
            const fxdx = await evaluate(x + dx) - targetValue
            const derivative = (fxdx - fx) / dx

            if (Math.abs(derivative) < 1e-12) break
            x = x - fx / derivative
        }

        const finalFx = await evaluate(x) - targetValue
        return { success: false, foundValue: x, iterations, finalDiff: Math.abs(finalFx) }
    }
}

export const goalSeekSolver = new GoalSeekSolver()
