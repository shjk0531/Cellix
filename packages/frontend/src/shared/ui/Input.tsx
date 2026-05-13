import React, { useState } from "react";

export interface InputProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "prefix"
> {
    label?: string;
    error?: string;
    hint?: string;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    fullWidth?: boolean;
}

export function Input({
    label,
    error,
    hint,
    prefix,
    suffix,
    fullWidth,
    id,
    style,
    onFocus,
    onBlur,
    ...props
}: InputProps) {
    const [focused, setFocused] = useState(false);
    const uid = React.useId();
    const inputId = id ?? uid;

    const borderColor = error
        ? "var(--color-border-error)"
        : focused
          ? "var(--color-border-focus)"
          : "var(--color-border-default)";

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-0-5)",
                width: fullWidth ? "100%" : undefined,
            }}
        >
            {label && (
                <label
                    htmlFor={inputId}
                    style={{
                        fontSize: "var(--font-size-sm)",
                        fontFamily: "var(--font-family-sans)",
                        fontWeight: 500,
                        color: error
                            ? "var(--color-error-text)"
                            : "var(--color-text-secondary)",
                    }}
                >
                    {label}
                </label>
            )}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    height: 36,
                    padding: "0 var(--space-2)",
                    background: "var(--color-bg-base)",
                    border: `1px solid ${borderColor}`,
                    borderRadius: "var(--radius-md)",
                    transition: "border-color 100ms ease",
                    width: fullWidth ? "100%" : undefined,
                    boxSizing: "border-box",
                }}
            >
                {prefix && (
                    <span
                        style={{
                            color: "var(--color-text-tertiary)",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        {prefix}
                    </span>
                )}
                <input
                    id={inputId}
                    onFocus={(e) => {
                        setFocused(true);
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setFocused(false);
                        onBlur?.(e);
                    }}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: "var(--font-size-base)",
                        fontFamily: "var(--font-family-sans)",
                        color: "var(--color-text-primary)",
                        ...style,
                    }}
                    {...props}
                />
                {suffix && (
                    <span
                        style={{
                            color: "var(--color-text-tertiary)",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        {suffix}
                    </span>
                )}
            </div>
            {(error || hint) && (
                <span
                    style={{
                        fontSize: "var(--font-size-xs)",
                        fontFamily: "var(--font-family-sans)",
                        color: error
                            ? "var(--color-error-text)"
                            : "var(--color-text-tertiary)",
                    }}
                >
                    {error ?? hint}
                </span>
            )}
        </div>
    );
}
