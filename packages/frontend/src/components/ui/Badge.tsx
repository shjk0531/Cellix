import React from "react";

export type BadgeVariant = "default" | "info" | "success" | "warning" | "error";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
    default: {
        background: "var(--color-bg-sunken)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border-default)",
    },
    info: {
        background: "var(--color-accent-subtle)",
        color: "var(--color-accent)",
        border: "1px solid var(--color-accent)",
    },
    success: {
        background: "var(--color-success-subtle)",
        color: "var(--color-success-text)",
        border: "1px solid var(--color-success)",
    },
    warning: {
        background: "var(--color-warning-subtle)",
        color: "var(--color-warning-text)",
        border: "1px solid var(--color-warning)",
    },
    error: {
        background: "var(--color-error-subtle)",
        color: "var(--color-error-text)",
        border: "1px solid var(--color-error)",
    },
};

export function Badge({
    variant = "default",
    size = "md",
    children,
    style,
}: BadgeProps) {
    const sm = size === "sm";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-0-5)",
                padding: sm ? "1px 6px" : "2px 8px",
                fontSize: sm ? "var(--font-size-xs)" : "var(--font-size-sm)",
                fontFamily: "var(--font-family-sans)",
                fontWeight: 500,
                lineHeight: "var(--line-height-snug)",
                borderRadius: "var(--radius-full)",
                ...VARIANT_STYLES[variant],
                ...style,
            }}
        >
            {children}
        </span>
    );
}
