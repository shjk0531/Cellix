import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    apiClient,
    type GradingResult,
    type ProblemSummary,
    type SubmissionResponse,
} from "../api";
import { SpreadsheetShell } from "../components/spreadsheet";
import { ResultModal } from "../components/exam";
import { useWorkbookStore, useAuthStore } from "../store";
import { formulaEngine } from "../workers";
import { serializeWorkbook, deserializeWorkbook } from "@cellix/shared";
import type { SerializedWorkbookData } from "@cellix/shared";
import type { CellData } from "@cellix/shared";

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ProblemPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [problem, setProblem] = useState<ProblemSummary | null>(null);
    const [loadingProblem, setLoadingProblem] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [gradingResult, setGradingResult] = useState<GradingResult | null>(
        null,
    );
    const [elapsed, setElapsed] = useState(0);

    const engineReady = useWorkbookStore((s) => s.engineReady);
    const { logout } = useAuthStore();

    const templateRef = useRef<SerializedWorkbookData | null>(null);
    const prevSheetsRef = useRef<string[]>([]);

    // ── 문제 로드 ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;
        setLoadingProblem(true);
        setLoadError("");
        setProblem(null);
        useWorkbookStore.getState().setEngineReady(false);

        apiClient
            .get<ProblemSummary>(`/api/problems/${id}`)
            .then((p) => {
                const template =
                    p.templateWorkbook as SerializedWorkbookData | null;

                if (template && template.sheetOrder?.length > 0) {
                    // 템플릿으로 스토어 초기화
                    const sheets = template.sheetOrder.map((sid) => ({
                        id: sid,
                        name: template.sheets[sid]?.name ?? sid,
                    }));
                    const cells: Record<string, CellData> = {};
                    for (const sid of template.sheetOrder) {
                        const sheetCells = template.sheets[sid]?.cells ?? {};
                        for (const [cellKey, cellData] of Object.entries(
                            sheetCells,
                        )) {
                            cells[`${sid}:${cellKey}`] = cellData as CellData;
                        }
                    }
                    useWorkbookStore.setState({
                        sheets,
                        activeSheetId:
                            template.activeSheetId ?? template.sheetOrder[0],
                        cells,
                        calculatedValues: {},
                        engineReady: false,
                    });
                    templateRef.current = template;
                } else {
                    templateRef.current = null;
                }

                setProblem(p);
                setLoadingProblem(false);
            })
            .catch((err) => {
                setLoadError(err.message);
                setLoadingProblem(false);
            });
    }, [id]);

    // ── 엔진 준비 후 템플릿 셀 로드 ──────────────────────────────────────────
    useEffect(() => {
        if (!problem || !engineReady) return;
        const template = templateRef.current;
        if (!template) return;

        const sheetOrder = template.sheetOrder ?? [];

        // 이전 문제의 시트 제거 (first sheet은 GridCanvas가 이미 engine에 add함)
        for (const oldSid of prevSheetsRef.current) {
            if (!sheetOrder.includes(oldSid)) {
                formulaEngine.removeSheet(oldSid).catch(() => {});
            }
        }
        prevSheetsRef.current = sheetOrder;

        // 첫 시트: GridCanvas가 add_sheet 완료 → loadSheet만 실행
        const firstId = sheetOrder[0];
        if (firstId) {
            const sheetCells = template.sheets[firstId]?.cells ?? {};
            const cells = Object.entries(sheetCells).map(([key, cellData]) => {
                const [r, c] = key.split(":");
                return {
                    row: parseInt(r, 10),
                    col: parseInt(c, 10),
                    value: (cellData as CellData).value,
                    formula: (cellData as CellData).formula,
                };
            });
            formulaEngine.loadSheet(firstId, cells).catch(console.error);
        }

        // 나머지 시트: addSheet + loadSheet
        for (let i = 1; i < sheetOrder.length; i++) {
            const sid = sheetOrder[i];
            const sheetMeta = template.sheets[sid];
            if (!sheetMeta) continue;
            formulaEngine
                .addSheet(sid, sheetMeta.name)
                .then(() => {
                    const sheetCells = sheetMeta.cells ?? {};
                    const cells = Object.entries(sheetCells).map(
                        ([key, cellData]) => {
                            const [r, c] = key.split(":");
                            return {
                                row: parseInt(r, 10),
                                col: parseInt(c, 10),
                                value: (cellData as CellData).value,
                                formula: (cellData as CellData).formula,
                            };
                        },
                    );
                    return formulaEngine.loadSheet(sid, cells);
                })
                .catch(console.error);
        }
    }, [problem, engineReady]);

    // ── 타이머 ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!problem) return;
        setElapsed(0);
        const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(interval);
    }, [problem]);

    // ── 초기화 ────────────────────────────────────────────────────────────────
    const handleReset = () => {
        const template = templateRef.current;
        if (!template) return;
        const cells: Record<string, CellData> = {};
        for (const sid of template.sheetOrder ?? []) {
            const sheetCells = template.sheets[sid]?.cells ?? {};
            for (const [cellKey, cellData] of Object.entries(sheetCells)) {
                cells[`${sid}:${cellKey}`] = cellData as CellData;
            }
        }
        useWorkbookStore.setState({ cells, calculatedValues: {} });
        setGradingResult(null);
        setElapsed(0);
    };

    // ── 제출 ─────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!problem || submitting) return;
        setSubmitting(true);
        try {
            const { sheets, activeSheetId, cells } =
                useWorkbookStore.getState();
            const serializedSheets: Record<
                string,
                {
                    id: string;
                    name: string;
                    cells: Record<string, CellData>;
                    columnMeta: Record<string, unknown>;
                    rowMeta: Record<string, unknown>;
                }
            > = {};
            for (const sheet of sheets) {
                const prefix = `${sheet.id}:`;
                const sheetCells: Record<string, CellData> = {};
                for (const [key, data] of Object.entries(cells)) {
                    if (key.startsWith(prefix)) {
                        sheetCells[key.slice(prefix.length)] = data;
                    }
                }
                serializedSheets[sheet.id] = {
                    id: sheet.id,
                    name: sheet.name,
                    cells: sheetCells,
                    columnMeta: {},
                    rowMeta: {},
                };
            }
            const workbookData: SerializedWorkbookData = {
                id: problem.id,
                name: problem.title,
                sheets: serializedSheets as SerializedWorkbookData["sheets"],
                sheetOrder: sheets.map((s) => s.id),
                activeSheetId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const data = await apiClient.post<SubmissionResponse>(
                "/api/submissions",
                {
                    problemId: problem.id,
                    workbookData,
                    timeSpentSeconds: elapsed,
                },
            );
            setGradingResult(data.result);
        } catch (err) {
            console.error("제출 실패:", err);
            alert(
                err instanceof Error
                    ? err.message
                    : "제출 중 오류가 발생했습니다.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const timeLimit = problem?.timeLimit ?? null;
    const timerDisplay = timeLimit
        ? formatTime(Math.max(0, timeLimit - elapsed))
        : formatTime(elapsed);
    const timerOver = timeLimit !== null && elapsed >= timeLimit;

    if (loadingProblem) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    color: "#5f6368",
                    fontSize: 15,
                }}
            >
                문제 불러오는 중...
            </div>
        );
    }

    if (loadError) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    gap: 12,
                }}
            >
                <div style={{ color: "#c5221f" }}>{loadError}</div>
                <button
                    onClick={() => navigate("/")}
                    style={btnStyle("#1a73e8")}
                >
                    문제 목록으로
                </button>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                overflow: "hidden",
            }}
        >
            {/* ── 헤더 ── */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 16px",
                    height: 48,
                    background: "#fff",
                    borderBottom: "1px solid #dadce0",
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={() => navigate("/")}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#5f6368",
                        padding: "4px 8px",
                    }}
                >
                    ← 목록
                </button>
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#202124",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {problem?.title}
                </span>
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color: timerOver ? "#c5221f" : "#202124",
                        minWidth: 56,
                        textAlign: "center",
                    }}
                >
                    {timerDisplay}
                </span>
                <button onClick={handleReset} style={btnStyle("#5f6368")}>
                    초기화
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={btnStyle(submitting ? "#a8c7fa" : "#1a73e8")}
                >
                    {submitting ? "채점 중..." : "제출"}
                </button>
            </div>

            {/* ── 본문 ── */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* 문제 설명 패널 */}
                <div
                    style={{
                        width: 300,
                        flexShrink: 0,
                        borderRight: "1px solid #dadce0",
                        overflowY: "auto",
                        padding: 20,
                        background: "#fff",
                    }}
                >
                    <div
                        style={{
                            fontSize: 13,
                            color: "#5f6368",
                            marginBottom: 12,
                            display: "flex",
                            gap: 6,
                        }}
                    >
                        <span
                            style={{
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: "#e8f0fe",
                                color: "#1a73e8",
                                fontWeight: 600,
                            }}
                        >
                            {problem?.score}점
                        </span>
                        {problem?.timeLimit && (
                            <span
                                style={{
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    background: "#f1f3f4",
                                    color: "#5f6368",
                                }}
                            >
                                {Math.floor(problem.timeLimit / 60)}분
                            </span>
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 14,
                            lineHeight: 1.7,
                            color: "#202124",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {problem?.description}
                    </div>
                    {problem?.hints && problem.hints.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#f4b400",
                                    marginBottom: 8,
                                }}
                            >
                                💡 힌트
                            </div>
                            {problem.hints.map((h, i) => (
                                <div
                                    key={i}
                                    style={{
                                        fontSize: 13,
                                        color: "#5f6368",
                                        marginBottom: 6,
                                        paddingLeft: 8,
                                        borderLeft: "2px solid #f4b400",
                                    }}
                                >
                                    {h}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 스프레드시트 영역 */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                    <SpreadsheetShell />
                </div>
            </div>

            {/* ── 채점 결과 모달 ── */}
            {gradingResult && (
                <ResultModal
                    result={gradingResult}
                    onClose={() => setGradingResult(null)}
                    onRetry={() => {
                        setGradingResult(null);
                        handleReset();
                    }}
                />
            )}
        </div>
    );
}

function btnStyle(bg: string): React.CSSProperties {
    return {
        padding: "6px 14px",
        background: bg,
        border: "none",
        borderRadius: 6,
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
    };
}
