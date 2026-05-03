import type { CellData } from "@cellix/shared";
import { formulaEngine } from "../../workers";

export interface DataTableParams {
    resultFormula: { row: number; col: number };
    rowInputCell?: { row: number; col: number };
    colInputCell?: { row: number; col: number };
    tableRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    };
}

/**
 * 데이터 표: 1~2개 입력 셀 변화에 따른 수식 결과 테이블 생성.
 *
 * 단변수 (열 입력만 있는 경우):
 *   - 표의 첫 번째 행이 입력값 목록 (startCol+1 ~ endCol)
 *   - 결과는 startRow+1 행에 채워짐
 *
 * 단변수 (행 입력만 있는 경우):
 *   - 표의 첫 번째 열이 입력값 목록 (startRow+1 ~ endRow)
 *   - 결과는 startCol+1 열에 채워짐
 *
 * 이변수 (행+열 입력 모두 있는 경우):
 *   - 첫 행(startCol+1~endCol): 열 입력값
 *   - 첫 열(startRow+1~endRow): 행 입력값
 *   - 내부 셀: 각 조합의 결과
 */
export class DataTableSolver {
    async solve(
        sheetId: string,
        params: DataTableParams,
        setCell: (row: number, col: number, data: CellData) => void,
    ): Promise<void> {
        const { resultFormula, rowInputCell, colInputCell, tableRange } =
            params;
        const { startRow, startCol, endRow, endCol } = tableRange;

        if (!rowInputCell && !colInputCell) return;

        if (rowInputCell && !colInputCell) {
            // 단변수: 행 입력 (첫 열에 입력값, 두 번째 열부터 결과)
            for (let r = startRow + 1; r <= endRow; r++) {
                const inputVal = await this._getCellNumericValue(
                    sheetId,
                    r,
                    startCol,
                );
                await formulaEngine.setCell(
                    sheetId,
                    rowInputCell.row,
                    rowInputCell.col,
                    inputVal,
                );
                const result = await formulaEngine.getCellValue(
                    sheetId,
                    resultFormula.row,
                    resultFormula.col,
                );
                const resultVal =
                    result.t === "n" ? (result.v as number) : null;
                setCell(r, startCol + 1, { value: resultVal });
            }
        } else if (!rowInputCell && colInputCell) {
            // 단변수: 열 입력 (첫 행에 입력값, 두 번째 행부터 결과)
            for (let c = startCol + 1; c <= endCol; c++) {
                const inputVal = await this._getCellNumericValue(
                    sheetId,
                    startRow,
                    c,
                );
                await formulaEngine.setCell(
                    sheetId,
                    colInputCell.row,
                    colInputCell.col,
                    inputVal,
                );
                const result = await formulaEngine.getCellValue(
                    sheetId,
                    resultFormula.row,
                    resultFormula.col,
                );
                const resultVal =
                    result.t === "n" ? (result.v as number) : null;
                setCell(startRow + 1, c, { value: resultVal });
            }
        } else if (rowInputCell && colInputCell) {
            // 이변수
            for (let r = startRow + 1; r <= endRow; r++) {
                const rowInputVal = await this._getCellNumericValue(
                    sheetId,
                    r,
                    startCol,
                );
                await formulaEngine.setCell(
                    sheetId,
                    rowInputCell.row,
                    rowInputCell.col,
                    rowInputVal,
                );

                for (let c = startCol + 1; c <= endCol; c++) {
                    const colInputVal = await this._getCellNumericValue(
                        sheetId,
                        startRow,
                        c,
                    );
                    await formulaEngine.setCell(
                        sheetId,
                        colInputCell.row,
                        colInputCell.col,
                        colInputVal,
                    );

                    const result = await formulaEngine.getCellValue(
                        sheetId,
                        resultFormula.row,
                        resultFormula.col,
                    );
                    const resultVal =
                        result.t === "n" ? (result.v as number) : null;
                    setCell(r, c, { value: resultVal });
                }
            }
        }
    }

    private async _getCellNumericValue(
        sheetId: string,
        row: number,
        col: number,
    ): Promise<number | null> {
        const result = await formulaEngine.getCellValue(sheetId, row, col);
        if (result.t === "n") return result.v as number;
        return null;
    }
}

export const dataTableSolver = new DataTableSolver();
