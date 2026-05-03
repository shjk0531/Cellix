import React from "react";
import type { CellRange, CellStyle } from "@cellix/shared";
import { useUIStore, useWorkbookStore } from "../../store";
import { styleManager } from "../../core/style";
import { ChartInsertDialog } from "../dialogs";

const BTN: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 3,
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    color: "#3c4043",
    fontFamily: "system-ui, sans-serif",
    transition: "background 0.1s",
};

const BTN_ACTIVE: React.CSSProperties = {
    ...BTN,
    background: "#e8f0fe",
    color: "#1a73e8",
};

const SEP: React.CSSProperties = {
    width: 1,
    height: 20,
    background: "#dadce0",
    margin: "0 4px",
};

const SELECT_STYLE: React.CSSProperties = {
    height: 26,
    border: "1px solid #dadce0",
    borderRadius: 3,
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 12,
    color: "#3c4043",
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    padding: "0 2px",
};

const FONT_SIZES = [
    8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72,
];

const FONT_FAMILIES: { label: string; value: string }[] = [
    { label: "System UI", value: "system-ui, sans-serif" },
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Helvetica", value: "Helvetica, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Times New Roman", value: '"Times New Roman", serif' },
    { label: "Courier New", value: '"Courier New", monospace' },
    { label: "Verdana", value: "Verdana, sans-serif" },
    { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
];

type BtnProps = {
    label: React.ReactNode;
    title: string;
    style?: React.CSSProperties;
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

function Btn({ label, title, style, active, disabled, onClick }: BtnProps) {
    const [hover, setHover] = React.useState(false);
    const base = active ? BTN_ACTIVE : BTN;
    return (
        <button
            title={title}
            disabled={disabled}
            style={{
                ...base,
                ...(hover && !active ? { background: "#f1f3f4" } : {}),
                ...(disabled ? { opacity: 0.4, cursor: "default" } : {}),
                ...style,
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

/**
 * 상단 리본 툴바.
 * styleManager와 연동하여 셀 스타일(굵게/기울임/정렬/색상/숫자 포맷 등)을 적용합니다.
 */
export const Toolbar = React.memo(function Toolbar() {
    const { canUndo, canRedo, activeCell, selections } = useUIStore();
    const activeSheetId = useWorkbookStore((s) => s.activeSheetId);
    const [showChartInsert, setShowChartInsert] = React.useState(false);
    const [chartInsertRange, setChartInsertRange] =
        React.useState<CellRange | null>(null);

    // styleManager 변경 시 리렌더링
    const [, setStyleVersion] = React.useState(0);
    React.useEffect(
        () => styleManager.subscribe(() => setStyleVersion((v) => v + 1)),
        [],
    );

    // 색상 피커 ref
    const fontColorRef = React.useRef<HTMLInputElement>(null);
    const bgColorRef = React.useRef<HTMLInputElement>(null);

    // 현재 활성 셀의 스타일
    const currentStyle: CellStyle = activeCell
        ? styleManager.getStyle(activeSheetId, activeCell.row, activeCell.col)
        : {};

    const isBold = currentStyle.font?.weight === "bold";
    const isItalic = currentStyle.font?.style === "italic";
    const isUnderline = currentStyle.font?.decoration === "underline";
    const isStrike = currentStyle.font?.decoration === "line-through";
    const hAlign = currentStyle.horizontalAlign ?? "general";
    const currentFontSize = currentStyle.font?.size ?? 13;
    const currentFontFamily =
        currentStyle.font?.family ?? "system-ui, sans-serif";
    const currentFontColor = currentStyle.font?.color ?? "#1f2329";
    const currentBgColor = currentStyle.backgroundColor ?? "#ffffff";

    // selections → CellRange[] 변환 (항상 activeSheetId 기준)
    const getSelectedRanges = (): CellRange[] => {
        if (selections.length > 0) {
            return selections.map((sel) => ({
                start: { ...sel.start, sheetId: activeSheetId },
                end: { ...sel.end, sheetId: activeSheetId },
            }));
        }
        if (activeCell) {
            return [
                {
                    start: {
                        row: activeCell.row,
                        col: activeCell.col,
                        sheetId: activeSheetId,
                    },
                    end: {
                        row: activeCell.row,
                        col: activeCell.col,
                        sheetId: activeSheetId,
                    },
                },
            ];
        }
        return [];
    };

    const applyStyle = (partial: Partial<CellStyle>) => {
        const ranges = getSelectedRanges();
        if (!ranges.length) return;
        styleManager.applyStyle(activeSheetId, ranges, partial);
    };

    // 소수점 자리수 증감 헬퍼
    const adjustDecimals = (delta: 1 | -1) => {
        const fmt = currentStyle.numberFormat ?? "";
        const isPercent = fmt.endsWith("%");
        const hasComma = fmt.includes(",");
        const decimalMatch = fmt.match(/\.(\d+)/);
        const decimals = decimalMatch ? decimalMatch[1].length : 0;
        const newDecimals = Math.max(0, decimals + delta);
        const base = hasComma ? "#,##0" : "0";
        const decPart = newDecimals > 0 ? "." + "0".repeat(newDecimals) : "";
        const newFmt = isPercent ? `0${decPart}%` : `${base}${decPart}`;
        applyStyle({ numberFormat: newFmt });
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                height: 40,
                padding: "0 8px",
                background: "#ffffff",
                borderBottom: "1px solid #dadce0",
                gap: 2,
                flexShrink: 0,
                userSelect: "none",
                overflowX: "auto",
            }}
        >
            {/* 실행취소 / 다시실행 */}
            <Btn
                label="↩"
                title="실행취소 (Ctrl+Z)"
                disabled={!canUndo}
                onClick={() => {
                    if (canUndo)
                        document.dispatchEvent(
                            new KeyboardEvent("keydown", {
                                key: "z",
                                ctrlKey: true,
                                bubbles: true,
                            }),
                        );
                }}
            />
            <Btn
                label="↪"
                title="다시실행 (Ctrl+Y)"
                disabled={!canRedo}
                onClick={() => {
                    if (canRedo)
                        document.dispatchEvent(
                            new KeyboardEvent("keydown", {
                                key: "y",
                                ctrlKey: true,
                                bubbles: true,
                            }),
                        );
                }}
            />

            <div style={SEP} />

            {/* 글꼴 패밀리 */}
            <select
                title="글꼴"
                value={currentFontFamily}
                style={{ ...SELECT_STYLE, width: 110 }}
                onChange={(e) =>
                    applyStyle({ font: { family: e.target.value } })
                }
            >
                {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                        {f.label}
                    </option>
                ))}
            </select>

            {/* 글꼴 크기 */}
            <select
                title="글꼴 크기"
                value={currentFontSize}
                style={{ ...SELECT_STYLE, width: 50 }}
                onChange={(e) =>
                    applyStyle({ font: { size: Number(e.target.value) } })
                }
            >
                {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>
                        {s}
                    </option>
                ))}
            </select>

            <div style={SEP} />

            {/* 굵게 */}
            <Btn
                label="B"
                title="굵게 (Ctrl+B)"
                style={{ fontWeight: 700 }}
                active={isBold}
                onClick={() =>
                    applyStyle({ font: { weight: isBold ? "normal" : "bold" } })
                }
            />

            {/* 기울임 */}
            <Btn
                label="I"
                title="기울임 (Ctrl+I)"
                style={{ fontStyle: "italic" }}
                active={isItalic}
                onClick={() =>
                    applyStyle({
                        font: { style: isItalic ? "normal" : "italic" },
                    })
                }
            />

            {/* 밑줄 */}
            <Btn
                label="U"
                title="밑줄 (Ctrl+U)"
                style={{ textDecoration: "underline" }}
                active={isUnderline}
                onClick={() =>
                    applyStyle({
                        font: {
                            decoration: isUnderline ? "none" : "underline",
                        },
                    })
                }
            />

            {/* 취소선 */}
            <Btn
                label="S"
                title="취소선"
                style={{ textDecoration: "line-through" }}
                active={isStrike}
                onClick={() =>
                    applyStyle({
                        font: {
                            decoration: isStrike ? "none" : "line-through",
                        },
                    })
                }
            />

            <div style={SEP} />

            {/* 글꼴 색 */}
            <div style={{ position: "relative", display: "inline-flex" }}>
                <button
                    title="글꼴 색"
                    style={BTN}
                    onClick={() => fontColorRef.current?.click()}
                >
                    <span
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                lineHeight: 1,
                                fontWeight: 700,
                            }}
                        >
                            A
                        </span>
                        <span
                            style={{
                                width: 14,
                                height: 3,
                                background: currentFontColor,
                                borderRadius: 1,
                            }}
                        />
                    </span>
                </button>
                <input
                    ref={fontColorRef}
                    type="color"
                    value={currentFontColor}
                    style={{
                        position: "absolute",
                        opacity: 0,
                        width: 0,
                        height: 0,
                        pointerEvents: "none",
                    }}
                    onChange={(e) =>
                        applyStyle({ font: { color: e.target.value } })
                    }
                />
            </div>

            {/* 배경색 */}
            <div style={{ position: "relative", display: "inline-flex" }}>
                <button
                    title="채우기 색"
                    style={BTN}
                    onClick={() => bgColorRef.current?.click()}
                >
                    <span
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <span style={{ fontSize: 11, lineHeight: 1 }}>⬛</span>
                        <span
                            style={{
                                width: 14,
                                height: 3,
                                background: currentBgColor,
                                border: "1px solid #dadce0",
                                borderRadius: 1,
                            }}
                        />
                    </span>
                </button>
                <input
                    ref={bgColorRef}
                    type="color"
                    value={currentBgColor}
                    style={{
                        position: "absolute",
                        opacity: 0,
                        width: 0,
                        height: 0,
                        pointerEvents: "none",
                    }}
                    onChange={(e) =>
                        applyStyle({ backgroundColor: e.target.value })
                    }
                />
            </div>

            <div style={SEP} />

            {/* 테두리 / 병합 (껍데기 유지) */}
            <Btn label="⊞" title="테두리" />
            <Btn label="⊡" title="셀 병합" />

            <div style={SEP} />

            {/* 정렬 */}
            <Btn
                label="≡"
                title="왼쪽 정렬"
                active={hAlign === "left"}
                onClick={() => applyStyle({ horizontalAlign: "left" })}
            />
            <Btn
                label={<span style={{ letterSpacing: 1 }}>≡</span>}
                title="가운데 정렬"
                active={hAlign === "center"}
                onClick={() => applyStyle({ horizontalAlign: "center" })}
            />
            <Btn
                label="≡"
                title="오른쪽 정렬"
                active={hAlign === "right"}
                onClick={() => applyStyle({ horizontalAlign: "right" })}
            />

            <div style={SEP} />

            {/* 숫자 서식 */}
            <Btn
                label="%"
                title="백분율"
                onClick={() => applyStyle({ numberFormat: "0%" })}
            />
            <Btn
                label=","
                title="천단위 구분"
                onClick={() => applyStyle({ numberFormat: "#,##0" })}
            />
            <Btn
                label=".0"
                title="소수점 늘리기"
                onClick={() => adjustDecimals(1)}
            />
            <Btn
                label=".9"
                title="소수점 줄이기"
                onClick={() => adjustDecimals(-1)}
            />

            <div style={SEP} />

            {/* 차트 삽입 */}
            <Btn
                label="📊"
                title="차트 삽입"
                style={{ fontSize: 16 }}
                onClick={() => {
                    const ranges = getSelectedRanges();
                    setChartInsertRange(ranges[0] ?? null);
                    setShowChartInsert(true);
                }}
            />

            {showChartInsert && (
                <ChartInsertDialog
                    sheetId={activeSheetId}
                    initialRange={chartInsertRange ?? undefined}
                    onClose={() => setShowChartInsert(false)}
                />
            )}
        </div>
    );
});
