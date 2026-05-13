import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "cellix-theme";
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedTheme {
    return window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";
}

function resolve(mode: ThemeMode): ResolvedTheme {
    return mode === "system" ? getSystemTheme() : mode;
}

function applyTheme(resolved: ResolvedTheme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
}

// MediaQuery listener — replaced each time mode changes to 'system'
let mqlCleanup: (() => void) | null = null;

function attachSystemListener(onChanged: (resolved: ResolvedTheme) => void) {
    mqlCleanup?.();
    const mql = window.matchMedia(SYSTEM_QUERY);
    const handler = (e: MediaQueryListEvent) => {
        const resolved: ResolvedTheme = e.matches ? "dark" : "light";
        applyTheme(resolved);
        onChanged(resolved);
    };
    mql.addEventListener("change", handler);
    mqlCleanup = () => mql.removeEventListener("change", handler);
}

function detachSystemListener() {
    mqlCleanup?.();
    mqlCleanup = null;
}

interface ThemeState {
    mode: ThemeMode;
    resolvedTheme: ResolvedTheme;
    setMode: (mode: ThemeMode) => void;
}

const savedMode = (localStorage.getItem(STORAGE_KEY) ?? "system") as ThemeMode;
const initialResolved = resolve(savedMode);
applyTheme(initialResolved);

export const useThemeStore = create<ThemeState>()((set) => {
    if (savedMode === "system") {
        attachSystemListener((resolved) => set({ resolvedTheme: resolved }));
    }

    return {
        mode: savedMode,
        resolvedTheme: initialResolved,

        setMode: (mode) => {
            localStorage.setItem(STORAGE_KEY, mode);
            const resolved = resolve(mode);
            applyTheme(resolved);

            if (mode === "system") {
                attachSystemListener((r) => set({ resolvedTheme: r }));
            } else {
                detachSystemListener();
            }

            set({ mode, resolvedTheme: resolved });
        },
    };
});
