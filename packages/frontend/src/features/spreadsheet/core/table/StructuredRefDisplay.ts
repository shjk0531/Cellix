import type { TableDefinition } from "@cellix/shared";

/**
 * 셀 범위를 구조적 참조 문자열로 역변환.
 * 주어진 범위가 어떤 표의 특정 열 데이터 범위와 정확히 일치하면 "TableName[ColumnName]" 반환.
 * 일치하지 않으면 null (일반 A1 표기 유지).
 */
export function cellRangeToStructuredRef(
    sheetId: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    tables: TableDefinition[],
): string | null {
    for (const table of tables) {
        if (table.sheetId !== sheetId) continue;

        const tStartRow = table.range.start.row;
        const tEndRow = table.range.end.row;
        const tStartCol = table.range.start.col;

        // 단일 열 범위만 구조적 참조로 변환 (startCol === endCol)
        if (startCol !== endCol) continue;

        // 열이 표 범위 안에 있는지 확인
        if (startCol < tStartCol || startCol > table.range.end.col) continue;

        // 데이터 범위 (헤더/합계 행 제외)
        const dataStartRow = table.showHeaderRow ? tStartRow + 1 : tStartRow;
        const dataEndRow = table.showTotalRow ? tEndRow - 1 : tEndRow;

        if (startRow !== dataStartRow || endRow !== dataEndRow) continue;

        // 해당 열의 TableColumn 찾기
        const colIndex = startCol - tStartCol;
        const column = table.columns.find((c) => c.index === colIndex);
        if (!column) continue;

        return `${table.name}[${column.name}]`;
    }

    return null;
}
