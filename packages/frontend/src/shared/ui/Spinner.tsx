import React from "react";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
    size?: SpinnerSize;
    color?: string;
    style?: React.CSSProperties;
}

const DIM: Record<SpinnerSize, number> = { sm: 14, md: 20, lg: 32 };
const BORDER: Record<SpinnerSize, number> = { sm: 2, md: 2, lg: 3 };

export function Spinner({ size = "md", color, style }: SpinnerProps) {
    const px = DIM[size];
    const b = BORDER[size];
    return (
        <span
            role="status"
            aria-label="로딩 중"
            style={{
                display: "inline-block",
                width: px,
                height: px,
                borderRadius: "50%",
                border: `${b}px solid var(--color-border-default)`,
                borderTopColor: color ?? "currentColor",
                animation: "cellix-spin 0.7s linear infinite",
                flexShrink: 0,
                ...style,
            }}
        />
    );
}
