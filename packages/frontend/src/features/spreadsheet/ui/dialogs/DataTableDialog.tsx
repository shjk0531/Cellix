import React, { useState } from "react";
import { dataTableSolver } from "../../core/analysis";
import type { DataTableParams } from "../../core/analysis";
import type { CellData } from "@cellix/shared";

interface Props {
    sheetId: string;
    setCell: (row: number, col: number, data: CellData) => void;
    onClose: () => void;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
    const m = ref
        .trim()
        .toUpperCase()
        .match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    return { row: parseInt(m[2], 10) - 1, col: col - 1 };
}

function parseRangeRef(ref: string): {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
} | null {
    const parts = ref.trim().toUpperCase().split(":");
    if (parts.length !== 2) return null;
    const a = parseCellRef(parts[0]);
    const b = parseCellRef(parts[1]);
    if (!a || !b) return null;
    return {
        startRow: Math.min(a.row, b.row),
        startCol: Math.min(a.col, b.col),
        endRow: Math.max(a.row, b.row),
        endCol: Math.max(a.col, b.col),
    };
}

export function DataTableDialog({ sheetId, setCell, onClose }: Props) {
    const [resultRef, setResultRef] = useState("");
    const [tableRangeRef, setTableRangeRef] = useState("");
    const [rowInputRef, setRowInputRef] = useState("");
    const [colInputRef, setColInputRef] = useState("");
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleSolve = async () => {
        setError(null);
        setDone(false);

        const resultCell = parseCellRef(resultRef);
        if (!resultCell) {
            setError("결과 수식 셀 주소가 올바르지 않습니다.");
            return;
        }

        const tableRange = parseRangeRef(tableRangeRef);
        if (!tableRange) {
            setError("표 범위가 올바르지 않습니다. (예: A1:D5)");
            return;
        }

        const rowInput = rowInputRef.trim()
            ? parseCellRef(rowInputRef)
            : undefined;
        const colInput = colInputRef.trim()
            ? parseCellRef(colInputRef)
            : undefined;

        if (!rowInput && !colInput) {
            setError(
                "행 입력 셀 또는 열 입력 셀 중 하나는 반드시 지정해야 합니다.",
            );
            return;
        }

        if (rowInput === null || colInput === null) {
            setError("셀 주소 형식이 올바르지 않습니다.");
            return;
        }

        const params: DataTableParams = {
            resultFormula: resultCell,
            tableRange,
            rowInputCell: rowInput ?? undefined,
            colInputCell: colInput ?? undefined,
        };

        setRunning(true);
        try {
            await dataTableSolver.solve(sheetId, params, setCell);
            setDone(true);
        } catch (err) {
            setError(String(err));
        } finally {
            setRunning(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
            onMouseDown={onClose}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 6,
                    padding: 24,
                    minWidth: 340,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 13,
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h3
                    style={{
                        margin: "0 0 16px",
                        fontSize: 15,
                        fontWeight: 600,
                    }}
                >
                    데이터 표
                </h3>

                <label style={labelStyle}>결과 수식 셀</label>
                <input
                    style={inputStyle}
                    placeholder="예: B1"
                    value={resultRef}
                    onChange={(e) => setResultRef(e.target.value)}
                />

                <label style={labelStyle}>표 범위</label>
                <input
                    style={inputStyle}
                    placeholder="예: A3:E8"
                    value={tableRangeRef}
                    onChange={(e) => setTableRangeRef(e.target.value)}
                />

                <label style={labelStyle}>행 입력 셀 (선택)</label>
                <input
                    style={inputStyle}
                    placeholder="예: A1"
                    value={rowInputRef}
                    onChange={(e) => setRowInputRef(e.target.value)}
                />

                <label style={labelStyle}>열 입력 셀 (선택)</label>
                <input
                    style={inputStyle}
                    placeholder="예: B1"
                    value={colInputRef}
                    onChange={(e) => setColInputRef(e.target.value)}
                />

                <p
                    style={{
                        color: "#5f6368",
                        marginBottom: 12,
                        lineHeight: 1.5,
                    }}
                >
                    단변수: 행 또는 열 입력 셀만 지정
                    <br />
                    이변수: 행과 열 입력 셀 모두 지정
                </p>

                {error && (
                    <div style={{ color: "#c0392b", marginBottom: 8 }}>
                        {error}
                    </div>
                )}
                {done && (
                    <div style={{ color: "#1e8e3e", marginBottom: 8 }}>
                        데이터 표가 완성되었습니다.
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        style={btnStyle("#f1f3f4", "#202124")}
                        onClick={onClose}
                    >
                        닫기
                    </button>
                    <button
                        style={btnStyle("#1a73e8", "#fff")}
                        onClick={handleSolve}
                        disabled={running}
                    >
                        {running ? "계산 중…" : "확인"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 4,
    fontWeight: 500,
    color: "#5f6368",
};

const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginBottom: 12,
    border: "1px solid #dadce0",
    borderRadius: 4,
    padding: "6px 8px",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
};

function btnStyle(bg: string, color: string): React.CSSProperties {
    return {
        padding: "6px 16px",
        borderRadius: 4,
        border: "none",
        background: bg,
        color,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
    };
}
