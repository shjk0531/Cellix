import { useEffect } from "react";
import { useThemeStore } from "../../store";

interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute("data-theme", resolvedTheme);
        root.classList.toggle("dark", resolvedTheme === "dark");
    }, [resolvedTheme]);

    return <>{children}</>;
}
