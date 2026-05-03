import React from "react";
import { Toolbar } from "./Toolbar";
import { FormulaBar } from "./FormulaBar";
import { GridCanvas } from "./GridCanvas";
import { SheetTabs } from "./SheetTabs";

/**
 * 스프레드시트 전체 레이아웃 컨테이너.
 *
 * 구조:
 *   ┌────────────────────────────┐
 *   │         Toolbar            │  40px
 *   ├────────────────────────────┤
 *   │        FormulaBar          │  28px
 *   ├────────────────────────────┤
 *   │                            │
 *   │        GridCanvas          │  flex: 1
 *   │                            │
 *   ├────────────────────────────┤
 *   │         SheetTabs          │  30px
 *   └────────────────────────────┘
 */
interface SpreadsheetShellProps {
    style?: React.CSSProperties;
}

export function SpreadsheetShell({ style }: SpreadsheetShellProps = {}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background: "#f8f9fa",
                ...style,
            }}
        >
            <Toolbar />
            <FormulaBar />
            <GridCanvas />
            <SheetTabs />
        </div>
    );
}
