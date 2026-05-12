import { createRequire } from "node:module";
import { Injectable } from "@nestjs/common";
import type { FormulaEngine as IFormulaEngine } from "formula-engine-node";
import type { WorkbookData, CellValue } from "@cellix/shared";
import { deserializeWorkbook } from "@cellix/shared";
import type {
    GradingConfig,
    CellGradingRule,
    TableGradingRule,
    CellRuleResult,
    GradingResult,
} from "../entity/submission.entity.js";

const _require = createRequire(import.meta.url);
const { FormulaEngine } = _require("formula-engine-node") as {
    FormulaEngine: new () => IFormulaEngine;
};

@Injectable()
export class GradingService {
    async grade(
        submittedRaw: unknown,
        config: GradingConfig,
    ): Promise<GradingResult> {
        const workbook = deserializeWorkbook(submittedRaw);

        const engine = new FormulaEngine();
        this._loadWorkbookIntoEngine(engine, workbook);

        const cellResults: CellRuleResult[] = [];
        let totalEarned = 0;

        for (const rule of config.cells ?? []) {
            const result = this._gradeCellRule(engine, rule);
            cellResults.push(result);
            totalEarned += result.earnedScore;
        }

        const tableResults: GradingResult["tableResults"] = [];
        for (const rule of config.tables ?? []) {
            const result = this._gradeTableRule(workbook, rule);
            tableResults.push(result);
            totalEarned += result.earnedScore;
        }

        const maxScore = config.totalScore;
        const percentage =
            maxScore > 0
                ? Math.round((totalEarned / maxScore) * 10000) / 100
                : 0;

        const status: GradingResult["status"] =
            percentage >= 100 ? "pass" : percentage > 0 ? "partial" : "fail";

        return {
            totalScore: Math.round(totalEarned * 100) / 100,
            maxScore,
            percentage,
            status,
            cellResults,
            tableResults,
            feedback: this._buildFeedback(
                cellResults,
                tableResults,
                percentage,
            ),
        };
    }

    private _loadWorkbookIntoEngine(
        engine: IFormulaEngine,
        workbook: WorkbookData,
    ): void {
        for (const sheetId of workbook.sheetOrder) {
            const sheet = workbook.sheets.get(sheetId);
            if (!sheet) continue;

            engine.add_sheet(sheetId, sheet.name);

            const updates: Array<{
                sheet_id: string;
                row: number;
                col: number;
                data: { value: CellValue; formula?: string };
            }> = [];

            for (const [key, cellData] of sheet.cells) {
                const [rowStr, colStr] = key.split(":");
                const row = parseInt(rowStr, 10);
                const col = parseInt(colStr, 10);
                if (isNaN(row) || isNaN(col)) continue;
                updates.push({
                    sheet_id: sheetId,
                    row,
                    col,
                    data: { value: cellData.value, formula: cellData.formula },
                });
            }

            if (updates.length > 0) {
                engine.batch_set(JSON.stringify(updates));
            }
        }

        if (workbook.activeSheetId) {
            engine.set_active_sheet(workbook.activeSheetId);
        }
    }

    private _gradeCellRule(
        engine: IFormulaEngine,
        rule: CellGradingRule,
    ): CellRuleResult {
        const { row, col } = this._parseAddress(rule.address);

        const rawJson = engine.get_cell_value(rule.sheetId, row, col);
        const parsed = this._parseCellVal(rawJson);
        const actualValue = this._toValue(parsed);

        const formulaUsed =
            engine.get_cell_formula(rule.sheetId, row, col) ?? undefined;

        let formulaMatched: boolean | undefined;
        if (rule.checkFormula && rule.formulaPattern) {
            if (!formulaUsed) {
                formulaMatched = false;
            } else {
                try {
                    formulaMatched = new RegExp(rule.formulaPattern, "i").test(
                        formulaUsed,
                    );
                } catch {
                    formulaMatched = false;
                }
            }
        }

        if (parsed?.t === "e") {
            return {
                address: rule.address,
                sheetId: rule.sheetId,
                passed: false,
                earnedScore: 0,
                maxScore: rule.scoreWeight,
                actualValue: String(parsed.v ?? "#ERROR"),
                expectedValue: rule.expectedValue,
                formulaUsed,
                formulaMatched,
                hint: rule.hint ?? `????ㅻ쪟媛 ?덉뒿?덈떎: ${parsed.v}`,
            };
        }

        let valuePassed = false;
        if (rule.expectedValue === undefined || rule.expectedValue === null) {
            valuePassed = true;
        } else if (
            typeof rule.expectedValue === "number" &&
            typeof actualValue === "number"
        ) {
            valuePassed =
                Math.abs(actualValue - rule.expectedValue) <=
                (rule.tolerance ?? 0.001);
        } else if (typeof rule.expectedValue === "boolean") {
            valuePassed = actualValue === rule.expectedValue;
        } else {
            valuePassed =
                String(actualValue ?? "").trim() ===
                String(rule.expectedValue).trim();
        }

        const passed =
            valuePassed &&
            (rule.checkFormula ? formulaMatched !== false : true);

        return {
            address: rule.address,
            sheetId: rule.sheetId,
            passed,
            earnedScore: passed ? rule.scoreWeight : 0,
            maxScore: rule.scoreWeight,
            actualValue,
            expectedValue: rule.expectedValue,
            formulaUsed,
            formulaMatched,
            hint: passed
                ? undefined
                : (rule.hint ??
                  this._buildCellHint(
                      rule,
                      actualValue,
                      formulaUsed,
                      formulaMatched,
                  )),
        };
    }

    private _gradeTableRule(
        workbook: WorkbookData,
        rule: TableGradingRule,
    ): GradingResult["tableResults"][number] {
        const raw = workbook as unknown as Record<string, unknown>;
        const tables: unknown[] = Array.isArray(raw["tables"])
            ? (raw["tables"] as unknown[])
            : [];
        const found = tables.find(
            (t): t is Record<string, unknown> =>
                typeof t === "object" &&
                t !== null &&
                (t as Record<string, unknown>)["name"] === rule.name,
        );

        if (!found) {
            return {
                name: rule.name,
                passed: false,
                earnedScore: 0,
                maxScore: rule.scoreWeight,
                hint: rule.hint ?? `"${rule.name}" ?대쫫???쒓? ?놁뒿?덈떎.`,
            };
        }

        if (rule.checkColumns && rule.expectedColumns) {
            const actualColumns = Array.isArray(found["columns"])
                ? (found["columns"] as unknown[]).map(String)
                : [];
            const colsPassed = rule.expectedColumns.every(
                (expected, i) => actualColumns[i]?.trim() === expected.trim(),
            );
            if (!colsPassed) {
                return {
                    name: rule.name,
                    passed: false,
                    earnedScore: 0,
                    maxScore: rule.scoreWeight,
                    hint:
                        rule.hint ??
                        `??而щ읆 ?ㅻ뜑媛 ?щ컮瑜댁? ?딆뒿?덈떎. ?덉긽: [${rule.expectedColumns.join(", ")}]`,
                };
            }
        }

        return {
            name: rule.name,
            passed: true,
            earnedScore: rule.scoreWeight,
            maxScore: rule.scoreWeight,
        };
    }

    private _parseAddress(addr: string): { row: number; col: number } {
        const clean = addr.replace(/\$/g, "");
        const match = clean.match(/^([A-Za-z]{1,3})(\d+)$/);
        if (!match) return { row: 0, col: 0 };
        const colStr = match[1].toUpperCase();
        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + colStr.charCodeAt(i) - 64;
        }
        return { row: parseInt(match[2], 10) - 1, col: col - 1 };
    }

    private _parseCellVal(json: string): { t: string; v?: unknown } | null {
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    private _toValue(result: { t: string; v?: unknown } | null): CellValue {
        if (!result) return null;
        switch (result.t) {
            case "n":
                return typeof result.v === "number" ? result.v : null;
            case "s":
                return typeof result.v === "string" ? result.v : null;
            case "b":
                return typeof result.v === "boolean" ? result.v : null;
            case "e":
                return String(result.v ?? "#ERROR");
            case "nil":
                return null;
            default:
                return null;
        }
    }

    private _buildCellHint(
        rule: CellGradingRule,
        actualValue: CellValue,
        formulaUsed?: string,
        formulaMatched?: boolean,
    ): string {
        const parts: string[] = [];
        if (rule.expectedValue !== undefined && rule.expectedValue !== null) {
            parts.push(
                `?덉긽媛? ${rule.expectedValue}, ?ㅼ젣媛? ${actualValue ?? "(鍮??)"}`,
            );
        }
        if (rule.checkFormula && formulaMatched === false) {
            parts.push(
                formulaUsed
                    ? `?섏떇 ?⑦꽩??留욎? ?딆뒿?덈떎 (?ъ슜???섏떇: ${formulaUsed})`
                    : "?섏떇???놁뒿?덈떎",
            );
        }
        return parts.join(" / ") || "?ㅻ떟?낅땲??";
    }

    private _buildFeedback(
        cellResults: CellRuleResult[],
        tableResults: GradingResult["tableResults"],
        percentage: number,
    ): string {
        if (percentage >= 100)
            return "?꾨꼍?⑸땲?? 紐⑤뱺 ??ぉ???뺥솗?섍쾶 ?꾩꽦?덉뒿?덈떎.";
        const failedCells = cellResults.filter((r) => !r.passed);
        const failedTables = tableResults.filter((r) => !r.passed);
        const total = failedCells.length + failedTables.length;
        if (total === 0) return "?뚮??⑸땲??";
        const parts = [`${total}媛???ぉ????몄뒿?덈떎.`];
        if (failedCells.length > 0)
            parts.push(
                `?由??: ${failedCells.map((r) => r.address).join(", ")}`,
            );
        if (failedTables.length > 0)
            parts.push(
                `???ㅻ쪟: ${failedTables.map((r) => r.name).join(", ")}`,
            );
        return parts.join(" ");
    }
}

