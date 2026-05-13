import React from "react";

export interface CardProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    padding?: number | string;
    shadow?: boolean;
    border?: boolean;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    style?: React.CSSProperties;
    className?: string;
}

export function Card({
    children,
    header,
    footer,
    padding = "var(--space-4)",
    shadow = true,
    border = true,
    onClick,
    style,
    className,
}: CardProps) {
    return (
        <div
            className={className}
            onClick={onClick}
            style={{
                background: "var(--color-bg-elevated)",
                borderRadius: "var(--radius-2xl)",
                boxShadow: shadow ? "var(--shadow-md)" : "none",
                border: border
                    ? "1px solid var(--color-border-subtle)"
                    : "none",
                cursor: onClick ? "pointer" : undefined,
                overflow: "hidden",
                ...style,
            }}
        >
            {header && (
                <div
                    style={{
                        padding: `var(--space-3) ${typeof padding === "number" ? `${padding}px` : padding}`,
                        borderBottom: "1px solid var(--color-border-subtle)",
                        fontWeight: 600,
                        fontSize: "var(--font-size-base)",
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-family-sans)",
                    }}
                >
                    {header}
                </div>
            )}
            <div
                style={{
                    padding: typeof padding === "number" ? padding : padding,
                }}
            >
                {children}
            </div>
            {footer && (
                <div
                    style={{
                        padding: `var(--space-3) ${typeof padding === "number" ? `${padding}px` : padding}`,
                        borderTop: "1px solid var(--color-border-subtle)",
                        color: "var(--color-text-secondary)",
                        fontSize: "var(--font-size-sm)",
                        fontFamily: "var(--font-family-sans)",
                    }}
                >
                    {footer}
                </div>
            )}
        </div>
    );
}
