import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthPage, ProblemListPage, ProblemPage, ProfilePage } from "./pages";
import { useAuthStore } from "./store";
import { ThemeProvider } from "./components/providers";

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();
    if (isLoading) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    color: "#5f6368",
                }}
            >
                로딩 중...
            </div>
        );
    }
    return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
    const { checkAuth } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return (
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<AuthPage />} />
                    <Route
                        path="/"
                        element={
                            <PrivateRoute>
                                <ProblemListPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/problems/:id"
                        element={
                            <PrivateRoute>
                                <ProblemPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/profile"
                        element={
                            <PrivateRoute>
                                <ProfilePage />
                            </PrivateRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}
