import React, { useState } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 28, md: 36, lg: 44 };
const PADDING: Record<ButtonSize, string> = {
    sm: "0 8px",
    md: "0 12px",
    lg: "0 16px",
};
const FONTSIZE: Record<ButtonSize, string> = {
    sm: "var(--font-size-sm)",
    md: "var(--font-size-base)",
    lg: "var(--font-size-lg)",
};
const GAP: Record<ButtonSize, string> = {
    sm: "var(--space-1)",
    md: "var(--space-1-5)",
    lg: "var(--space-2)",
};

type StyleMap = Record<
    ButtonVariant,
    (hovered: boolean, disabled: boolean) => React.CSSProperties
>;

const VARIANT_STYLES: StyleMap = {
    primary: (h, d) => ({
        background: d
            ? "var(--color-accent-disabled)"
            : h
              ? "var(--color-accent-hover)"
              : "var(--color-accent)",
        color: "var(--color-text-on-accent)",
        border: "none",
    }),
    secondary: (h) => ({
        background: h ? "var(--color-bg-hover)" : "transparent",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border-default)",
    }),
    ghost: (h) => ({
        background: h ? "var(--color-bg-hover)" : "transparent",
        color: "var(--color-text-primary)",
        border: "none",
    }),
    danger: (h, d) => ({
        background: d
            ? "var(--color-error-subtle)"
            : h
              ? "var(--color-error-hover)"
              : "var(--color-error)",
        color: d ? "var(--color-error-text)" : "#ffffff",
        border: "none",
    }),
};

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    style,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...props
}: ButtonProps) {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const isDisabled = disabled || loading;

    const spinnerColor =
        variant === "primary" || variant === "danger"
            ? "#ffffff"
            : "var(--color-accent)";

    return (
        <button
            disabled={isDisabled}
            onMouseEnter={(e) => {
                setHovered(true);
                onMouseEnter?.(e);
            }}
            onMouseLeave={(e) => {
                setHovered(false);
                onMouseLeave?.(e);
            }}
            onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
            }}
            onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
            }}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: GAP[size],
                height: HEIGHT[size],
                padding: PADDING[size],
                fontSize: FONTSIZE[size],
                fontFamily: "var(--font-family-sans)",
                fontWeight: 500,
                borderRadius: "var(--radius-xl)",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.6 : 1,
                transition: "background 100ms ease",
                width: fullWidth ? "100%" : undefined,
                whiteSpace: "nowrap",
                outline: focused
                    ? "2px solid var(--color-border-focus)"
                    : "none",
                outlineOffset: 2,
                ...VARIANT_STYLES[variant](hovered && !isDisabled, isDisabled),
                ...style,
            }}
            {...props}
        >
            {loading ? <Spinner size="sm" color={spinnerColor} /> : leftIcon}
            {children}
            {!loading && rightIcon}
        </button>
    );
}
