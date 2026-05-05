import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SpreadsheetShell } from "../components/spreadsheet";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { useWorkbookStore } from "../store";
import { problemApi } from "../api/problemApi";
import type {
    CreateProblemPayload,
    GradingCell,
    GradingConfig,
} from "../api/problemApi";
import type { SerializedWorkbookData } from "@cellix/shared";
import type {
    DifficultyLevel,
    ProblemCategory,
    ProblemType,
} from "@cellix/shared";

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "쉬움 (Easy)" },
    { value: "medium", label: "보통 (Medium)" },
    { value: "hard", label: "어려움 (Hard)" },
];

const LEVEL_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({
    value: String(n),
    label: `Lv.${n}`,
}));

const TYPE_OPTIONS = [
    { value: "formula", label: "수식" },
    { value: "formatting", label: "서식" },
    { value: "chart", label: "차트" },
    { value: "table", label: "표/피벗" },
    { value: "function", label: "함수" },
    { value: "data", label: "정렬/필터/유효성" },
    { value: "mixed", label: "복합" },
];

const CATEGORY_OPTIONS = [
    { value: "practice", label: "단계별 학습 (Practice)" },
    { value: "exam", label: "실전 시험 (Exam)" },
    { value: "skill_check", label: "스킬 체크 (Skill Check)" },
];

const STEP_LABELS = ["기본 정보", "초기 폼 설정", "채점 규칙"];

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface Step1Form {
    title: string;
    description: string;
    difficulty: DifficultyLevel;
    level: number;
    type: ProblemType;
    category: ProblemCategory;
    stepLevel: string;
    score: string;
    timeLimit: string;
    estimatedMinutes: string;
    tags: string;
    hints: string;
}

const INITIAL_STEP1: Step1Form = {
    title: "",
    description: "",
    difficulty: "medium",
    level: 1,
    type: "formula",
    category: "practice",
    stepLevel: "",
    score: "100",
    timeLimit: "",
    estimatedMinutes: "",
    tags: "",
    hints: "",
};

// ── 스텝 인디케이터 ───────────────────────────────────────────────────────────

function StepIndicator({
    current,
    total,
}: {
    current: number;
    total: number;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                marginBottom: 32,
            }}
        >
            {Array.from({ length: total }, (_, i) => {
                const step = i + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <React.Fragment key={step}>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "var(--font-size-md)",
                                    fontWeight: "var(--font-weight-semibold)",
                                    background: done || active
                                        ? "var(--color-accent)"
                                        : "var(--color-bg-sunken)",
                                    color: done || active
                                        ? "var(--color-text-on-accent)"
                                        : "var(--color-text-tertiary)",
                                    transition: "background 200ms",
                                }}
                            >
                                {done ? "✓" : step}
                            </div>
                            <span
                                style={{
                                    fontSize: "var(--font-size-xs)",
                                    color: active
                                        ? "var(--color-accent)"
                                        : "var(--color-text-tertiary)",
                                    fontWeight: active
                                        ? "var(--font-weight-semibold)"
                                        : "var(--font-weight-regular)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {STEP_LABELS[i]}
                            </span>
                        </div>
                        {i < total - 1 && (
                            <div
                                style={{
                                    flex: 1,
                                    height: 2,
                                    background: done
                                        ? "var(--color-accent)"
                                        : "var(--color-border-default)",
                                    marginBottom: 20,
                                    transition: "background 200ms",
                                }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ── Step 1: 기본 정보 ─────────────────────────────────────────────────────────

function Step1({
    form,
    setForm,
    errors,
}: {
    form: Step1Form;
    setForm: React.Dispatch<React.SetStateAction<Step1Form>>;
    errors: Partial<Record<keyof Step1Form, string>>;
}) {
    const field = <K extends keyof Step1Form>(key: K) => ({
        value: form[key] as string,
        onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
        ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Input
                label="제목 *"
                placeholder="문제 제목을 입력하세요"
                fullWidth
                error={errors.title}
                {...field("title")}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label
                    style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 500,
                        color: errors.description
                            ? "var(--color-error-text)"
                            : "var(--color-text-secondary)",
                    }}
                >
                    문제 설명 *
                </label>
                <textarea
                    placeholder="문제 배경, 요구사항, 조건 등을 상세히 작성하세요"
                    value={form.description}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={6}
                    style={{
                        padding: "10px 12px",
                        border: `1px solid ${errors.description ? "var(--color-border-error)" : "var(--color-border-default)"}`,
                        borderRadius: "var(--radius-md)",
                        fontSize: "var(--font-size-base)",
                        fontFamily: "var(--font-family-sans)",
                        color: "var(--color-text-primary)",
                        background: "var(--color-bg-base)",
                        resize: "vertical",
                        outline: "none",
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                />
                {errors.description && (
                    <span
                        style={{
                            fontSize: "var(--font-size-xs)",
                            color: "var(--color-error-text)",
                        }}
                    >
                        {errors.description}
                    </span>
                )}
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                }}
            >
                <Select
                    label="난이도 *"
                    fullWidth
                    options={DIFFICULTY_OPTIONS}
                    value={form.difficulty}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            difficulty: e.target.value as DifficultyLevel,
                        }))
                    }
                />
                <Select
                    label="레벨 *"
                    fullWidth
                    options={LEVEL_OPTIONS}
                    value={String(form.level)}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            level: Number(e.target.value),
                        }))
                    }
                />
                <Select
                    label="문제 유형 *"
                    fullWidth
                    options={TYPE_OPTIONS}
                    value={form.type}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            type: e.target.value as ProblemType,
                        }))
                    }
                />
                <Select
                    label="카테고리 *"
                    fullWidth
                    options={CATEGORY_OPTIONS}
                    value={form.category}
                    onChange={(e) =>
                        setForm((f) => ({
                            ...f,
                            category: e.target.value as ProblemCategory,
                        }))
                    }
                />
                {form.category === "practice" && (
                    <Input
                        label="단계 번호 (practice 카테고리)"
                        placeholder="1, 2, 3..."
                        fullWidth
                        type="number"
                        min={1}
                        error={errors.stepLevel}
                        {...field("stepLevel")}
                    />
                )}
                <Input
                    label="배점"
                    placeholder="100"
                    fullWidth
                    type="number"
                    min={1}
                    error={errors.score}
                    {...field("score")}
                />
                <Input
                    label="시간 제한 (초)"
                    placeholder="예) 1800 (30분)"
                    fullWidth
                    type="number"
                    min={60}
                    {...field("timeLimit")}
                />
                <Input
                    label="예상 풀이 시간 (분)"
                    placeholder="예) 20"
                    fullWidth
                    type="number"
                    min={1}
                    {...field("estimatedMinutes")}
                />
            </div>

            <Input
                label="태그 (쉼표로 구분)"
                placeholder="SUM, VLOOKUP, 조건부서식..."
                fullWidth
                hint="쉼표(,)로 구분하여 여러 태그를 입력하세요"
                {...field("tags")}
            />

            <Input
                label="힌트 (쉼표로 구분, 선택)"
                placeholder="SUM 함수를 사용해보세요, A1:A10 범위를 확인하세요..."
                fullWidth
                hint="문제 풀이 도중 표시될 힌트입니다"
                {...field("hints")}
            />
        </div>
    );
}

// ── Step 2: 초기 엑셀 폼 설정 ─────────────────────────────────────────────────

function Step2({
    captured,
    onCapture,
}: {
    captured: SerializedWorkbookData | null;
    onCapture: (wb: SerializedWorkbookData) => void;
}) {
    const snapshot = useWorkbookStore((s) => s.snapshot);

    const handleCapture = useCallback(() => {
        onCapture(snapshot());
    }, [snapshot, onCapture]);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                height: "100%",
            }}
        >
            <div
                style={{
                    padding: "10px 16px",
                    background: "var(--color-bg-sunken)",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "var(--font-size-md)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.6,
                }}
            >
                응시자가 문제를 열었을 때 보게 될 초기 스프레드시트를 설정합니다.
                데이터 입력, 헤더 작성, 서식 지정 등을 마친 후{" "}
                <strong style={{ color: "var(--color-accent)" }}>
                    "현재 상태를 템플릿으로 저장"
                </strong>
                을 클릭하세요.
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <Button variant="primary" size="md" onClick={handleCapture}>
                    현재 상태를 템플릿으로 저장
                </Button>
                {captured && (
                    <span
                        style={{
                            fontSize: "var(--font-size-sm)",
                            color: "var(--color-success)",
                        }}
                    >
                        ✓ 저장됨 — 시트{" "}
                        {Object.values(captured.sheets)
                            .map((s) => s.name)
                            .join(", ")}
                    </span>
                )}
            </div>

            <div
                style={{
                    flex: 1,
                    minHeight: 480,
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "var(--radius-xl)",
                    overflow: "hidden",
                }}
            >
                <SpreadsheetShell />
            </div>
        </div>
    );
}

// ── Step 3: 채점 규칙 설정 ───────────────────────────────────────────────────

interface CellRuleRow extends GradingCell {
    _id: string;
}

function Step3({
    rules,
    setRules,
    totalScore,
    setTotalScore,
    sheets,
}: {
    rules: CellRuleRow[];
    setRules: React.Dispatch<React.SetStateAction<CellRuleRow[]>>;
    totalScore: string;
    setTotalScore: (v: string) => void;
    sheets: { id: string; name: string }[];
}) {
    const addRule = () => {
        setRules((r) => [
            ...r,
            {
                _id: `rule_${Date.now()}`,
                sheetId: sheets[0]?.id ?? "",
                address: "",
                expectedValue: "",
                scoreWeight: 10,
                checkFormula: false,
            },
        ]);
    };

    const removeRule = (id: string) =>
        setRules((r) => r.filter((x) => x._id !== id));

    const updateRule = (id: string, patch: Partial<GradingCell>) =>
        setRules((r) =>
            r.map((x) => (x._id === id ? { ...x, ...patch } : x)),
        );

    const sheetOptions = sheets.map((s) => ({ value: s.id, label: s.name }));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
                style={{
                    padding: "10px 16px",
                    background: "var(--color-bg-sunken)",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "var(--font-size-md)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.6,
                }}
            >
                채점 기준이 될 셀을 추가합니다. 응시자 제출 시 해당 셀의 값이
                기대값과 일치하는지 자동으로 채점됩니다.
            </div>

            {/* 총 배점 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label
                    style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 500,
                        color: "var(--color-text-secondary)",
                        whiteSpace: "nowrap",
                    }}
                >
                    총 배점
                </label>
                <input
                    type="number"
                    min={1}
                    value={totalScore}
                    onChange={(e) => setTotalScore(e.target.value)}
                    style={{
                        width: 100,
                        padding: "6px 10px",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "var(--font-size-base)",
                        background: "var(--color-bg-base)",
                        color: "var(--color-text-primary)",
                        outline: "none",
                    }}
                />
                <span
                    style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-tertiary)",
                    }}
                >
                    점
                </span>
            </div>

            {/* 셀 규칙 목록 */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                {rules.map((rule, idx) => (
                    <div
                        key={rule._id}
                        style={{
                            background: "var(--color-bg-base)",
                            border: "1px solid var(--color-border-default)",
                            borderRadius: "var(--radius-xl)",
                            padding: "14px 16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: "var(--font-size-sm)",
                                    fontWeight: "var(--font-weight-semibold)",
                                    color: "var(--color-text-secondary)",
                                }}
                            >
                                규칙 {idx + 1}
                            </span>
                            <button
                                onClick={() => removeRule(rule._id)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--color-error)",
                                    fontSize: "var(--font-size-md)",
                                    padding: "2px 6px",
                                    borderRadius: "var(--radius-sm)",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "1fr 120px 1fr 80px",
                                gap: 10,
                                alignItems: "end",
                            }}
                        >
                            {/* 시트 선택 */}
                            {sheetOptions.length > 1 && (
                                <Select
                                    label="시트"
                                    fullWidth
                                    options={sheetOptions}
                                    value={rule.sheetId}
                                    onChange={(e) =>
                                        updateRule(rule._id, {
                                            sheetId: e.target.value,
                                        })
                                    }
                                />
                            )}

                            {/* 셀 주소 */}
                            <Input
                                label="셀 주소"
                                placeholder="A1"
                                fullWidth
                                value={rule.address}
                                onChange={(e) =>
                                    updateRule(rule._id, {
                                        address: e.target.value.toUpperCase(),
                                    })
                                }
                            />

                            {/* 기대값 */}
                            <Input
                                label="기대값"
                                placeholder="숫자, 텍스트, 수식..."
                                fullWidth
                                value={String(rule.expectedValue ?? "")}
                                onChange={(e) =>
                                    updateRule(rule._id, {
                                        expectedValue: e.target.value,
                                    })
                                }
                            />

                            {/* 배점 가중치 */}
                            <Input
                                label="배점 (점)"
                                placeholder="10"
                                fullWidth
                                type="number"
                                min={1}
                                value={String(rule.scoreWeight)}
                                onChange={(e) =>
                                    updateRule(rule._id, {
                                        scoreWeight: Number(e.target.value),
                                    })
                                }
                            />
                        </div>

                        {/* 수식 체크 옵션 */}
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                cursor: "pointer",
                                fontSize: "var(--font-size-sm)",
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={rule.checkFormula ?? false}
                                onChange={(e) =>
                                    updateRule(rule._id, {
                                        checkFormula: e.target.checked,
                                    })
                                }
                            />
                            값뿐만 아니라 수식 패턴도 채점
                            {rule.checkFormula && (
                                <input
                                    placeholder="수식 패턴 (예: =SUM(.*) )"
                                    value={rule.formulaPattern ?? ""}
                                    onChange={(e) =>
                                        updateRule(rule._id, {
                                            formulaPattern: e.target.value,
                                        })
                                    }
                                    style={{
                                        flex: 1,
                                        padding: "4px 8px",
                                        border: "1px solid var(--color-border-default)",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: "var(--font-size-sm)",
                                        background: "var(--color-bg-base)",
                                        color: "var(--color-text-primary)",
                                        outline: "none",
                                    }}
                                />
                            )}
                        </label>
                    </div>
                ))}
            </div>

            <Button variant="secondary" size="md" onClick={addRule}>
                + 채점 셀 추가
            </Button>

            {rules.length === 0 && (
                <div
                    style={{
                        textAlign: "center",
                        padding: "32px 0",
                        color: "var(--color-text-tertiary)",
                        fontSize: "var(--font-size-md)",
                        border: "2px dashed var(--color-border-default)",
                        borderRadius: "var(--radius-xl)",
                    }}
                >
                    채점 규칙이 없습니다. "채점 셀 추가" 버튼으로 규칙을 추가하세요.
                </div>
            )}
        </div>
    );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export function ProblemCreatePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get("edit");

    const [step, setStep] = useState(1);
    const [step1, setStep1] = useState<Step1Form>(INITIAL_STEP1);
    const [step1Errors, setStep1Errors] = useState<Partial<Record<keyof Step1Form, string>>>({});
    const [templateWb, setTemplateWb] = useState<SerializedWorkbookData | null>(null);
    const [rules, setRules] = useState<Array<GradingCell & { _id: string }>>([]);
    const [totalScore, setTotalScore] = useState("100");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const sheets = useWorkbookStore((s) => s.sheets);
    const reset = useWorkbookStore((s) => s.reset);

    // 페이지 진입 시 워크북 초기화 (기존 상태 오염 방지)
    const didReset = useRef(false);
    useEffect(() => {
        if (!didReset.current) {
            didReset.current = true;
            reset();
        }
    }, [reset]);

    // 수정 모드: 기존 문제 데이터 불러오기
    useEffect(() => {
        if (!editId) return;
        problemApi.get(editId).then(({ data }) => {
            setStep1({
                title: data.title,
                description: data.description,
                difficulty: data.difficulty,
                level: data.level,
                type: data.type,
                category: data.category,
                stepLevel: data.stepLevel ? String(data.stepLevel) : "",
                score: String(data.score),
                timeLimit: data.timeLimit ? String(data.timeLimit) : "",
                estimatedMinutes: data.estimatedMinutes
                    ? String(data.estimatedMinutes)
                    : "",
                tags: (data.tags ?? []).join(", "),
                hints: (data.hints ?? []).join(", "),
            });
            if (data.templateWorkbook) {
                setTemplateWb(data.templateWorkbook as SerializedWorkbookData);
            }
        }).catch(console.error);
    }, [editId]);

    // ── Step 1 유효성 검사 ──────────────────────────────────────────────────
    const validateStep1 = (): boolean => {
        const errs: Partial<Record<keyof Step1Form, string>> = {};
        if (!step1.title.trim()) errs.title = "제목을 입력하세요";
        if (!step1.description.trim()) errs.description = "문제 설명을 입력하세요";
        if (!step1.score || Number(step1.score) < 1)
            errs.score = "배점은 1 이상이어야 합니다";
        setStep1Errors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        setStep((s) => Math.min(s + 1, 3));
    };

    const handleBack = () => setStep((s) => Math.max(s - 1, 1));

    // ── 최종 제출 ───────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validateStep1()) {
            setStep(1);
            return;
        }

        const gradingConfig: GradingConfig = {
            cells: rules.map(({ _id: _unused, ...r }) => ({
                ...r,
                expectedValue:
                    r.expectedValue !== "" ? r.expectedValue : undefined,
            })),
            totalScore: Number(totalScore) || Number(step1.score) || 100,
        };

        const payload: CreateProblemPayload = {
            title: step1.title.trim(),
            description: step1.description.trim(),
            difficulty: step1.difficulty,
            level: step1.level,
            type: step1.type,
            category: step1.category,
            stepLevel: step1.stepLevel ? Number(step1.stepLevel) : undefined,
            score: Number(step1.score) || 100,
            timeLimit: step1.timeLimit ? Number(step1.timeLimit) : undefined,
            estimatedMinutes: step1.estimatedMinutes
                ? Number(step1.estimatedMinutes)
                : undefined,
            templateWorkbook: templateWb ?? undefined,
            gradingConfig,
            tags: step1.tags
                ? step1.tags.split(",").map((t) => t.trim()).filter(Boolean)
                : [],
            hints: step1.hints
                ? step1.hints.split(",").map((h) => h.trim()).filter(Boolean)
                : [],
        };

        try {
            setSubmitting(true);
            setSubmitError("");
            if (editId) {
                await problemApi.update(editId, payload);
            } else {
                await problemApi.create(payload);
            }
            navigate("/my-problems");
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : "제출 실패");
        } finally {
            setSubmitting(false);
        }
    };

    // ── 렌더 ────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--color-bg-page)",
            }}
        >
            {/* 헤더 */}
            <div
                style={{
                    borderBottom: "1px solid var(--color-border-default)",
                    background: "var(--color-bg-base)",
                    padding: "0 24px",
                    height: 56,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                }}
            >
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-text-secondary)",
                        fontSize: "var(--font-size-lg)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: "var(--radius-md)",
                    }}
                >
                    ← 뒤로
                </button>
                <span
                    style={{
                        fontSize: "var(--font-size-lg)",
                        fontWeight: "var(--font-weight-semibold)",
                        color: "var(--color-text-primary)",
                    }}
                >
                    {editId ? "문제 수정" : "문제 만들기"}
                </span>
            </div>

            {/* 본문 */}
            <div
                className="grid-container"
                style={{
                    paddingTop: 32,
                    paddingBottom: 48,
                    // Step 2는 스프레드시트 높이가 필요하므로 max-width 확장
                    maxWidth: step === 2 ? "none" : undefined,
                    paddingLeft: step === 2 ? 24 : undefined,
                    paddingRight: step === 2 ? 24 : undefined,
                }}
            >
                <StepIndicator current={step} total={3} />

                {/* Step 콘텐츠 */}
                <div
                    style={{
                        background: "var(--color-bg-base)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: "var(--radius-2xl)",
                        padding: step === 2 ? "24px 24px 0" : 28,
                        minHeight: step === 2 ? 620 : undefined,
                        display: step === 2 ? "flex" : undefined,
                        flexDirection: step === 2 ? "column" : undefined,
                    }}
                >
                    {step === 1 && (
                        <Step1
                            form={step1}
                            setForm={setStep1}
                            errors={step1Errors}
                        />
                    )}
                    {step === 2 && (
                        <Step2
                            captured={templateWb}
                            onCapture={setTemplateWb}
                        />
                    )}
                    {step === 3 && (
                        <Step3
                            rules={rules}
                            setRules={setRules}
                            totalScore={totalScore}
                            setTotalScore={setTotalScore}
                            sheets={sheets}
                        />
                    )}
                </div>

                {/* 에러 메시지 */}
                {submitError && (
                    <div
                        style={{
                            marginTop: 12,
                            padding: "10px 16px",
                            background: "var(--color-error-subtle)",
                            borderRadius: "var(--radius-lg)",
                            color: "var(--color-error-text)",
                            fontSize: "var(--font-size-md)",
                        }}
                    >
                        {submitError}
                    </div>
                )}

                {/* 하단 버튼 */}
                <div
                    style={{
                        marginTop: 24,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={handleBack}
                        disabled={step === 1}
                    >
                        이전
                    </Button>

                    <div style={{ display: "flex", gap: 8 }}>
                        <Button
                            variant="ghost"
                            size="md"
                            onClick={() => navigate("/my-problems")}
                        >
                            취소
                        </Button>
                        {step < 3 ? (
                            <Button
                                variant="primary"
                                size="md"
                                onClick={handleNext}
                            >
                                다음
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                size="md"
                                loading={submitting}
                                onClick={handleSubmit}
                            >
                                {editId ? "수정 완료" : "문제 등록"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
