import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: number | string;
}

export function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    width = 480,
}: ModalProps) {
    // Lock body scroll while open
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    // Escape key to close
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "var(--color-bg-overlay)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 400,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--color-bg-elevated)",
                    borderRadius: "var(--radius-3xl)",
                    boxShadow: "var(--shadow-xl)",
                    width: typeof width === "number" ? width : width,
                    maxWidth: "calc(100vw - 32px)",
                    maxHeight: "calc(100vh - 64px)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {title !== undefined && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 20px",
                            borderBottom:
                                "1px solid var(--color-border-subtle)",
                            flexShrink: 0,
                        }}
                    >
                        <span
                            style={{
                                fontSize: "var(--font-size-lg)",
                                fontWeight: 600,
                                fontFamily: "var(--font-family-sans)",
                                color: "var(--color-text-primary)",
                            }}
                        >
                            {title}
                        </span>
                        <button
                            onClick={onClose}
                            aria-label="닫기"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                background: "none",
                                border: "none",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                color: "var(--color-text-secondary)",
                                fontSize: 18,
                                lineHeight: 1,
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}
                <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
                    {children}
                </div>
                {footer && (
                    <div
                        style={{
                            padding: "12px 20px",
                            borderTop: "1px solid var(--color-border-subtle)",
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "var(--space-2)",
                            flexShrink: 0,
                        }}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
