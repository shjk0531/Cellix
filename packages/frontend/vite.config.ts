import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

export default defineConfig({
    plugins: [react(), wasm(), topLevelAwait()],
    resolve: {
        alias: {
            "@cellix/shared": path.resolve(__dirname, "../shared/src/index.ts"),
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
