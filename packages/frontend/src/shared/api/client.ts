import type { ApiResponse } from "@cellix/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const AUTH_API_BASE =
    import.meta.env.VITE_AUTH_API_BASE_URL ?? "";
const REFRESH_SESSION_KEY = "cellix.hasRefreshSession";

let _accessToken: string | null = sessionStorage.getItem("accessToken");
let _refreshPromise: Promise<string | null> | null = null;

export class ApiClientError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly status: number,
        readonly response: ApiResponse<unknown>,
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

function setRefreshSession(value: boolean): void {
    if (value) localStorage.setItem(REFRESH_SESSION_KEY, "true");
    else localStorage.removeItem(REFRESH_SESSION_KEY);
}

function hasRefreshSession(): boolean {
    return localStorage.getItem(REFRESH_SESSION_KEY) === "true";
}

function canAutoRefresh(path: string): boolean {
    return !path.startsWith("/api/auth/");
}

function baseFor(path: string): string {
    return path.startsWith("/api/auth/") ? AUTH_API_BASE : API_BASE;
}

async function _doFetch(
    method: string,
    path: string,
    body: unknown,
    token: string | null,
): Promise<Response> {
    return fetch(`${baseFor(path)}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

async function request<T>(
    method: string,
    path: string,
    body?: unknown,
): Promise<T> {
    let res = await _doFetch(method, path, body, _accessToken);

    if (res.status === 401 && canAutoRefresh(path)) {
        const token = await refreshAccessToken();
        if (token) res = await _doFetch(method, path, body, token);
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success) {
        throw new ApiClientError(
            json.message || "Unknown error",
            json.code || "UNKNOWN_ERROR",
            res.status,
            json,
        );
    }
    return json.data as T;
}

async function refreshAccessToken(): Promise<string | null> {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
        try {
            const refreshRes = await fetch(`${AUTH_API_BASE}/api/auth/refresh`, {
                method: "POST",
                credentials: "include",
            });
            if (!refreshRes.ok) {
                apiClient.setToken(null);
                setRefreshSession(false);
                return null;
            }

            const refreshData = (await refreshRes.json()) as ApiResponse<{
                accessToken: string;
            }>;
            const token = refreshData.success
                ? (refreshData.data?.accessToken ?? null)
                : null;
            apiClient.setToken(token);
            setRefreshSession(Boolean(token));
            return token;
        } catch {
            apiClient.setToken(null);
            setRefreshSession(false);
            return null;
        } finally {
            _refreshPromise = null;
        }
    })();

    return _refreshPromise;
}

export const apiClient = {
    get<T>(path: string): Promise<T> {
        return request<T>("GET", path);
    },
    post<T>(path: string, body?: unknown): Promise<T> {
        return request<T>("POST", path, body);
    },
    put<T>(path: string, body?: unknown): Promise<T> {
        return request<T>("PUT", path, body);
    },
    patch<T>(path: string, body?: unknown): Promise<T> {
        return request<T>("PATCH", path, body);
    },
    delete<T>(path: string): Promise<T> {
        return request<T>("DELETE", path);
    },
    setToken(token: string | null): void {
        _accessToken = token;
        if (token) sessionStorage.setItem("accessToken", token);
        else sessionStorage.removeItem("accessToken");
    },
    getToken(): string | null {
        return _accessToken;
    },
    setRefreshSession,
    hasRefreshSession,
    shouldCheckAuth(): boolean {
        return Boolean(_accessToken) || hasRefreshSession();
    },
    refreshAccessToken,
};
