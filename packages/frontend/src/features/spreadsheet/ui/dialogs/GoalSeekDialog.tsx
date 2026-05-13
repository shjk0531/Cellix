import React, { useState } from "react";
import { goalSeekSolver } from "../../core/analysis";
import type { GoalSeekParams, GoalSeekResult } from "../../core/analysis";

interface Props {
    sheetId: string;
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

export function GoalSeekDialog({ sheetId, onClose }: Props) {
    const [formulaCellRef, setFormulaCellRef] = useState("");
    const [targetValue, setTargetValue] = useState("");
    const [changingCellRef, setChangingCellRef] = useState("");
    const [result, setResult] = useState<GoalSeekResult | null>(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSolve = async () => {
        setError(null);
        setResult(null);

        const fc = parseCellRef(formulaCellRef);
        const cc = parseCellRef(changingCellRef);
        const tv = parseFloat(targetValue);

        if (!fc) {
            setError("수식 셀 주소가 올바르지 않습니다.");
            return;
        }
        if (!cc) {
            setError("변경 셀 주소가 올바르지 않습니다.");
            return;
        }
        if (isNaN(tv)) {
            setError("목표 값이 올바르지 않습니다.");
            return;
        }

        const params: GoalSeekParams = {
            formulaCell: fc,
            targetValue: tv,
            changingCell: cc,
        };

        setRunning(true);
        try {
            const res = await goalSeekSolver.solve(sheetId, params);
            setResult(res);
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
                    minWidth: 320,
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
                    목표값 찾기
                </h3>

                <label style={labelStyle}>수식 셀</label>
                <input
                    style={inputStyle}
                    placeholder="예: B1"
                    value={formulaCellRef}
                    onChange={(e) => setFormulaCellRef(e.target.value)}
                />

                <label style={labelStyle}>찾는 값</label>
                <input
                    style={inputStyle}
                    type="number"
                    placeholder="예: 10"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                />

                <label style={labelStyle}>변경 셀</label>
                <input
                    style={inputStyle}
                    placeholder="예: A1"
                    value={changingCellRef}
                    onChange={(e) => setChangingCellRef(e.target.value)}
                />

                {error && (
                    <div style={{ color: "#c0392b", marginBottom: 8 }}>
                        {error}
                    </div>
                )}

                {result && (
                    <div
                        style={{
                            marginBottom: 12,
                            padding: 8,
                            background: result.success ? "#e8f5e9" : "#fce4ec",
                            borderRadius: 4,
                        }}
                    >
                        {result.success
                            ? `완료: 변경 셀 = ${result.foundValue?.toFixed(6)} (${result.iterations}회 반복)`
                            : `수렴 실패 (${result.iterations}회 반복, 오차 ${result.finalDiff.toExponential(2)})`}
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                        marginTop: 8,
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
