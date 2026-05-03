import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
    content: React.ReactNode;
    placement?: TooltipPlacement;
    delay?: number;
    children: React.ReactElement;
}

interface Pos {
    top: number;
    left: number;
    transform: string;
}

function calcPos(rect: DOMRect, placement: TooltipPlacement): Pos {
    const GAP = 6;
    switch (placement) {
        case "top":
            return {
                top: rect.top + window.scrollY - GAP,
                left: rect.left + window.scrollX + rect.width / 2,
                transform: "translate(-50%, -100%)",
            };
        case "bottom":
            return {
                top: rect.bottom + window.scrollY + GAP,
                left: rect.left + window.scrollX + rect.width / 2,
                transform: "translate(-50%, 0)",
            };
        case "left":
            return {
                top: rect.top + window.scrollY + rect.height / 2,
                left: rect.left + window.scrollX - GAP,
                transform: "translate(-100%, -50%)",
            };
        case "right":
            return {
                top: rect.top + window.scrollY + rect.height / 2,
                left: rect.right + window.scrollX + GAP,
                transform: "translate(0, -50%)",
            };
    }
}

export function Tooltip({
    content,
    placement = "top",
    delay = 300,
    children,
}: TooltipProps) {
    const [pos, setPos] = useState<Pos | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => {
            const el = triggerRef.current;
            if (!el) return;
            setPos(calcPos(el.getBoundingClientRect(), placement));
        }, delay);
    }, [placement, delay]);

    const hide = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setPos(null);
    }, []);

    const trigger = React.cloneElement(children, {
        ref: (node: HTMLElement | null) => {
            triggerRef.current = node;
            const { ref } = children as React.RefAttributes<HTMLElement>;
            if (typeof ref === "function") ref(node);
            else if (ref)
                (ref as React.MutableRefObject<HTMLElement | null>).current =
                    node;
        },
        onMouseEnter: (e: React.MouseEvent) => {
            show();
            children.props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
            hide();
            children.props.onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
            show();
            children.props.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
            hide();
            children.props.onBlur?.(e);
        },
    });

    return (
        <>
            {trigger}
            {pos &&
                content &&
                createPortal(
                    <span
                        role="tooltip"
                        style={{
                            position: "absolute",
                            top: pos.top,
                            left: pos.left,
                            transform: pos.transform,
                            background: "var(--color-text-primary)",
                            color: "var(--color-bg-base)",
                            padding: "4px 8px",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--font-size-xs)",
                            fontFamily: "var(--font-family-sans)",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                            zIndex: 600,
                            boxShadow: "var(--shadow-sm)",
                        }}
                    >
                        {content}
                    </span>,
                    document.body,
                )}
        </>
    );
}
