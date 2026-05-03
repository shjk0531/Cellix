import React from "react";
import type { FilterCriteria } from "../../core/data";

interface FilterDropdownProps {
    col: number;
    uniqueValues: string[];
    currentCriteria: FilterCriteria | undefined;
    position: { x: number; y: number };
    onApply: (criteria: FilterCriteria | null) => void;
    onClose: () => void;
}

type Tab = "values" | "condition";

type CondType = "text" | "number";

const OVERLAY: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 999,
};

const PANEL: React.CSSProperties = {
    position: "absolute",
    zIndex: 1000,
    width: 220,
    background: "#ffffff",
    border: "1px solid #dadce0",
    borderRadius: 4,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    fontSize: 13,
    color: "#3c4043",
    fontFamily: "system-ui, -apple-system, sans-serif",
    userSelect: "none",
};

const TAB_BAR: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid #dadce0",
};

const TAB_BTN = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "6px 0",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    color: active ? "#1a73e8" : "#5f6368",
    borderBottom: active ? "2px solid #1a73e8" : "2px solid transparent",
    fontWeight: active ? 600 : 400,
});

const FOOTER: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    gap: 6,
    padding: "6px 8px",
    borderTop: "1px solid #dadce0",
};

const BTN_PRIMARY: React.CSSProperties = {
    padding: "4px 12px",
    border: "none",
    borderRadius: 3,
    background: "#1a73e8",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
};

const BTN_SECONDARY: React.CSSProperties = {
    padding: "4px 12px",
    border: "1px solid #dadce0",
    borderRadius: 3,
    background: "#fff",
    color: "#3c4043",
    cursor: "pointer",
    fontSize: 12,
};

const TEXT_OPS = [
    { value: "contains", label: "포함" },
    { value: "notContains", label: "포함하지 않음" },
    { value: "beginsWith", label: "시작 문자" },
    { value: "endsWith", label: "끝 문자" },
    { value: "equals", label: "같음" },
    { value: "notEquals", label: "같지 않음" },
];

const NUM_OPS = [
    { value: "equals", label: "같음 (=)" },
    { value: "notEquals", label: "같지 않음 (≠)" },
    { value: "greaterThan", label: "보다 큼 (>)" },
    { value: "lessThan", label: "보다 작음 (<)" },
    { value: "between", label: "사이" },
];

export function FilterDropdown({
    col,
    uniqueValues,
    currentCriteria,
    position,
    onApply,
    onClose,
}: FilterDropdownProps) {
    const [tab, setTab] = React.useState<Tab>("values");

    // Values tab state
    const [selected, setSelected] = React.useState<Set<string>>(() => {
        if (
            currentCriteria?.type === "values" &&
            currentCriteria.selectedValues
        ) {
            return new Set(currentCriteria.selectedValues);
        }
        return new Set(uniqueValues);
    });

    // Condition tab state
    const [condType, setCondType] = React.useState<CondType>("text");
    const [textOp, setTextOp] = React.useState<string>(
        currentCriteria?.type === "text"
            ? (currentCriteria.textOperator ?? "contains")
            : "contains",
    );
    const [textVal, setTextVal] = React.useState(
        currentCriteria?.type === "text"
            ? (currentCriteria.textValue ?? "")
            : "",
    );
    const [numOp, setNumOp] = React.useState<string>(
        currentCriteria?.type === "number"
            ? (currentCriteria.numberOperator ?? "equals")
            : "equals",
    );
    const [numVal1, setNumVal1] = React.useState(
        currentCriteria?.type === "number"
            ? String(currentCriteria.numberValue1 ?? "")
            : "",
    );
    const [numVal2, setNumVal2] = React.useState(
        currentCriteria?.type === "number"
            ? String(currentCriteria.numberValue2 ?? "")
            : "",
    );

    // Close on outside click
    const overlayRef = React.useRef<HTMLDivElement>(null);

    const allChecked = selected.size === uniqueValues.length;
    const toggleAll = () => {
        setSelected(allChecked ? new Set() : new Set(uniqueValues));
    };
    const toggleValue = (v: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(v)) next.delete(v);
            else next.add(v);
            return next;
        });
    };

    const handleApply = () => {
        if (tab === "values") {
            if (selected.size === uniqueValues.length) {
                onApply(null);
            } else {
                onApply({ type: "values", selectedValues: new Set(selected) });
            }
        } else if (condType === "text") {
            if (!textVal) {
                onApply(null);
            } else {
                onApply({
                    type: "text",
                    textOperator: textOp as FilterCriteria["textOperator"],
                    textValue: textVal,
                });
            }
        } else {
            const n1 = numVal1 !== "" ? Number(numVal1) : undefined;
            const n2 = numVal2 !== "" ? Number(numVal2) : undefined;
            if (n1 === undefined) {
                onApply(null);
            } else {
                onApply({
                    type: "number",
                    numberOperator: numOp as FilterCriteria["numberOperator"],
                    numberValue1: n1,
                    numberValue2: n2,
                });
            }
        }
    };

    void col;

    return (
        <>
            <div ref={overlayRef} style={OVERLAY} onMouseDown={onClose} />
            <div
                style={{ ...PANEL, left: position.x, top: position.y }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* 탭 헤더 */}
                <div style={TAB_BAR}>
                    <button
                        style={TAB_BTN(tab === "values")}
                        onClick={() => setTab("values")}
                    >
                        값 선택
                    </button>
                    <button
                        style={TAB_BTN(tab === "condition")}
                        onClick={() => setTab("condition")}
                    >
                        조건
                    </button>
                </div>

                {/* 값 선택 탭 */}
                {tab === "values" && (
                    <div
                        style={{
                            maxHeight: 200,
                            overflowY: "auto",
                            padding: "4px 0",
                        }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "3px 10px",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={toggleAll}
                                style={{ cursor: "pointer" }}
                            />
                            <span style={{ fontWeight: 600 }}>(전체 선택)</span>
                        </label>
                        {uniqueValues.map((v) => (
                            <label
                                key={v}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "3px 10px",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(v)}
                                    onChange={() => toggleValue(v)}
                                    style={{ cursor: "pointer" }}
                                />
                                <span>{v}</span>
                            </label>
                        ))}
                    </div>
                )}

                {/* 조건 탭 */}
                {tab === "condition" && (
                    <div
                        style={{
                            padding: "8px 10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        <div style={{ display: "flex", gap: 6 }}>
                            <button
                                style={{
                                    ...BTN_SECONDARY,
                                    flex: 1,
                                    background:
                                        condType === "text"
                                            ? "#e8f0fe"
                                            : "#fff",
                                    color:
                                        condType === "text"
                                            ? "#1a73e8"
                                            : "#3c4043",
                                }}
                                onClick={() => setCondType("text")}
                            >
                                텍스트
                            </button>
                            <button
                                style={{
                                    ...BTN_SECONDARY,
                                    flex: 1,
                                    background:
                                        condType === "number"
                                            ? "#e8f0fe"
                                            : "#fff",
                                    color:
                                        condType === "number"
                                            ? "#1a73e8"
                                            : "#3c4043",
                                }}
                                onClick={() => setCondType("number")}
                            >
                                숫자
                            </button>
                        </div>

                        {condType === "text" && (
                            <>
                                <select
                                    value={textOp}
                                    onChange={(e) => setTextOp(e.target.value)}
                                    style={{
                                        height: 26,
                                        border: "1px solid #dadce0",
                                        borderRadius: 3,
                                        fontSize: 12,
                                        padding: "0 4px",
                                    }}
                                >
                                    {TEXT_OPS.map((op) => (
                                        <option key={op.value} value={op.value}>
                                            {op.label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={textVal}
                                    onChange={(e) => setTextVal(e.target.value)}
                                    placeholder="값 입력"
                                    style={{
                                        height: 26,
                                        border: "1px solid #dadce0",
                                        borderRadius: 3,
                                        fontSize: 12,
                                        padding: "0 6px",
                                        outline: "none",
                                    }}
                                />
                            </>
                        )}

                        {condType === "number" && (
                            <>
                                <select
                                    value={numOp}
                                    onChange={(e) => setNumOp(e.target.value)}
                                    style={{
                                        height: 26,
                                        border: "1px solid #dadce0",
                                        borderRadius: 3,
                                        fontSize: 12,
                                        padding: "0 4px",
                                    }}
                                >
                                    {NUM_OPS.map((op) => (
                                        <option key={op.value} value={op.value}>
                                            {op.label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={numVal1}
                                    onChange={(e) => setNumVal1(e.target.value)}
                                    placeholder="값"
                                    style={{
                                        height: 26,
                                        border: "1px solid #dadce0",
                                        borderRadius: 3,
                                        fontSize: 12,
                                        padding: "0 6px",
                                        outline: "none",
                                    }}
                                />
                                {numOp === "between" && (
                                    <input
                                        type="number"
                                        value={numVal2}
                                        onChange={(e) =>
                                            setNumVal2(e.target.value)
                                        }
                                        placeholder="두 번째 값"
                                        style={{
                                            height: 26,
                                            border: "1px solid #dadce0",
                                            borderRadius: 3,
                                            fontSize: 12,
                                            padding: "0 6px",
                                            outline: "none",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* 하단 버튼 */}
                <div style={FOOTER}>
                    <button style={BTN_SECONDARY} onClick={onClose}>
                        취소
                    </button>
                    <button style={BTN_PRIMARY} onClick={handleApply}>
                        확인
                    </button>
                </div>
            </div>
        </>
    );
}
