import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
    plugins: [react(), wasm(), topLevelAwait(), tailwindcss()],
    resolve: {
        alias: {
            "@app": path.resolve(__dirname, "src/app"),
            "@routes": path.resolve(__dirname, "src/routes"),
            "@features": path.resolve(__dirname, "src/features"),
            "@entities": path.resolve(__dirname, "src/entities"),
            "@shared": path.resolve(__dirname, "src/shared"),
            "@cellix/shared": path.resolve(__dirname, "../shared/src/index.ts"),
        },
    },
    build: {
        target: "es2022",
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) return undefined;
                    if (id.includes("/react/") || id.includes("/react-dom/")) {
                        return "react-vendor";
                    }
                    if (id.includes("/zustand/")) return "zustand";
                    if (id.includes("/react-router-dom/")) return "router";
                    return undefined;
                },
            },
        },
    },
    server: {
        port: 5173,
        host: "0.0.0.0",
        fs: {
            allow: ["../.."],
        },
        proxy: {
            "/api": {
                target: "http://backend:3001",
                changeOrigin: true,
            },
        },
    },
});
