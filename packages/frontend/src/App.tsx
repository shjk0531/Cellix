import React, { useRef, useEffect } from "react";

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#e0e0e0";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Cellix", canvas.width / 2, canvas.height / 2);
    }, []);

    return (
        <main
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                background: "#0f0f1a",
            }}
        >
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ border: "1px solid #333" }}
            />
        </main>
    );
}
