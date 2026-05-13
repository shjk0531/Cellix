import React, { useState } from "react";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "children"
> {
    options: SelectOption[];
    label?: string;
    error?: string;
    hint?: string;
    placeholder?: string;
    fullWidth?: boolean;
}

// SVG chevron as data URI — color matches token (updated per theme via filter isn't feasible inline,
// so we use a neutral gray that works on both light/dark backgrounds)
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239aa0a6' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`;

export function Select({
    options,
    label,
    error,
    hint,
    placeholder,
    fullWidth,
    id,
    style,
    onFocus,
    onBlur,
    ...props
}: SelectProps) {
    const [focused, setFocused] = useState(false);
    const uid = React.useId();
    const selectId = id ?? uid;

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
                    htmlFor={selectId}
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
            <select
                id={selectId}
                onFocus={(e) => {
                    setFocused(true);
                    onFocus?.(e);
                }}
                onBlur={(e) => {
                    setFocused(false);
                    onBlur?.(e);
                }}
                style={{
                    height: 36,
                    padding: "0 28px 0 var(--space-2)",
                    background: "var(--color-bg-base)",
                    border: `1px solid ${borderColor}`,
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-base)",
                    fontFamily: "var(--font-family-sans)",
                    color: "var(--color-text-primary)",
                    cursor: props.disabled ? "not-allowed" : "pointer",
                    outline: "none",
                    transition: "border-color 100ms ease",
                    width: fullWidth ? "100%" : undefined,
                    appearance: "none",
                    backgroundImage: CHEVRON,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 8px center",
                    ...style,
                }}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((opt) => (
                    <option
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.disabled}
                    >
                        {opt.label}
                    </option>
                ))}
            </select>
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
