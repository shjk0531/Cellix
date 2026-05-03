import type { CellData, CellRange } from "@cellix/shared";
import type { EChartsOption } from "echarts";
import type { ChartAxis, ChartDefinition } from "./types";

function readRange(
    range: CellRange,
    getCell: (sheetId: string, row: number, col: number) => CellData | null,
): (string | number | null)[] {
    const values: (string | number | null)[] = [];
    const sheetId = range.start.sheetId;
    const r1 = Math.min(range.start.row, range.end.row);
    const r2 = Math.max(range.start.row, range.end.row);
    const c1 = Math.min(range.start.col, range.end.col);
    const c2 = Math.max(range.start.col, range.end.col);
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const v = getCell(sheetId, r, c)?.value;
            values.push(
                typeof v === "string" || typeof v === "number" ? v : null,
            );
        }
    }
    return values;
}

function axisOpts(axis?: ChartAxis): Record<string, unknown> {
    if (!axis) return {};
    const o: Record<string, unknown> = {};
    if (axis.title) o["name"] = axis.title;
    if (axis.min !== undefined) o["min"] = axis.min;
    if (axis.max !== undefined) o["max"] = axis.max;
    if (axis.gridLines === false) o["splitLine"] = { show: false };
    return o;
}

export function buildEChartsOption(
    chart: ChartDefinition,
    getCell: (sheetId: string, row: number, col: number) => CellData | null,
): EChartsOption {
    const categories = chart.categoryRange
        ? readRange(chart.categoryRange, getCell).map((v) =>
              v == null ? "" : String(v),
          )
        : undefined;

    const seriesData = chart.series.map((s) => ({
        name: s.name,
        data: readRange(s.dataRange, getCell),
        chartType: s.chartType,
        yAxisIndex: s.yAxisIndex ?? 0,
    }));

    const titleOpt = chart.title
        ? {
              text: chart.title,
              left: "center" as const,
              textStyle: { fontSize: 13 },
          }
        : undefined;

    const legendOpt: EChartsOption["legend"] =
        chart.legendPosition === "none" ? { show: false } : { show: true };

    switch (chart.type) {
        case "bar":
            return {
                title: titleOpt,
                legend: legendOpt,
                tooltip: { trigger: "axis" as const },
                xAxis: { type: "category" as const, data: categories },
                yAxis: { type: "value" as const, ...axisOpts(chart.yAxis) },
                series: seriesData.map((s) => ({
                    type: "bar" as const,
                    name: s.name,
                    data: s.data,
                })),
            };

        case "bar_stacked":
            return {
                title: titleOpt,
                legend: legendOpt,
                tooltip: { trigger: "axis" as const },
                xAxis: { type: "category" as const, data: categories },
                yAxis: { type: "value" as const, ...axisOpts(chart.yAxis) },
                series: seriesData.map((s) => ({
                    type: "bar" as const,
                    name: s.name,
                    data: s.data,
                    stack: "total",
                })),
            };

        case "line":
            return {
                title: titleOpt,
                legend: legendOpt,
                tooltip: { trigger: "axis" as const },
                xAxis: { type: "category" as const, data: categories },
                yAxis: { type: "value" as const, ...axisOpts(chart.yAxis) },
                series: seriesData.map((s) => ({
                    type: "line" as const,
                    name: s.name,
                    data: s.data,
                })),
            };

        case "pie": {
            const first = seriesData[0];
            const pieData = first
                ? first.data.map((v, i) => ({
                      value: typeof v === "number" ? v : 0,
                      name: categories?.[i] ?? `항목 ${i + 1}`,
                  }))
                : [];
            return {
                title: titleOpt,
                legend: {
                    show: chart.legendPosition !== "none",
                    orient: "vertical" as const,
                    right: "5%",
                    top: "center" as const,
                },
                tooltip: { trigger: "item" as const },
                series: [
                    {
                        type: "pie" as const,
                        radius: "60%",
                        data: pieData,
                        label: { formatter: "{b}: {d}%" },
                    },
                ],
            };
        }

        case "scatter": {
            const xData = seriesData[0]?.data ?? [];
            const yData = seriesData[1]?.data ?? xData;
            const scatterData = xData.map((x, i) => [
                typeof x === "number" ? x : 0,
                typeof yData[i] === "number" ? yData[i] : 0,
            ]);
            return {
                title: titleOpt,
                tooltip: { trigger: "item" as const },
                xAxis: { type: "value" as const, ...axisOpts(chart.xAxis) },
                yAxis: { type: "value" as const, ...axisOpts(chart.yAxis) },
                series: [{ type: "scatter" as const, data: scatterData }],
            };
        }

        case "combo": {
            const hasSecond = seriesData.some((s) => s.yAxisIndex === 1);
            return {
                title: titleOpt,
                legend: legendOpt,
                tooltip: { trigger: "axis" as const },
                xAxis: { type: "category" as const, data: categories },
                yAxis: hasSecond
                    ? [
                          { type: "value" as const, ...axisOpts(chart.yAxis) },
                          { type: "value" as const, ...axisOpts(chart.yAxis2) },
                      ]
                    : { type: "value" as const, ...axisOpts(chart.yAxis) },
                series: seriesData.map((s) => ({
                    type: (s.chartType ?? "bar") as "bar" | "line",
                    name: s.name,
                    data: s.data,
                    yAxisIndex: s.yAxisIndex ?? 0,
                })),
            };
        }

        default:
            return {};
    }
}
