import type { ApiResponse } from '@cellix/shared'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

let _accessToken: string | null = sessionStorage.getItem('accessToken')

async function _doFetch(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
    return fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res = await _doFetch(method, path, body, _accessToken)

    if (res.status === 401) {
        try {
            const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            })
            if (refreshRes.ok) {
                const refreshData = await refreshRes.json() as ApiResponse<{ accessToken: string }>
                apiClient.setToken(refreshData.data?.accessToken ?? null)
                res = await _doFetch(method, path, body, _accessToken)
            }
        } catch {
            apiClient.setToken(null)
        }
    }

    const json = await res.json() as ApiResponse<T>
    if (!json.success) throw new Error(json.error ?? 'Unknown error')
    return json.data as T
}

export const apiClient = {
    get<T>(path: string): Promise<T> { return request<T>('GET', path) },
    post<T>(path: string, body?: unknown): Promise<T> { return request<T>('POST', path, body) },
    put<T>(path: string, body?: unknown): Promise<T> { return request<T>('PUT', path, body) },
    delete<T>(path: string): Promise<T> { return request<T>('DELETE', path) },
    setToken(token: string | null): void {
        _accessToken = token
        if (token) sessionStorage.setItem('accessToken', token)
        else sessionStorage.removeItem('accessToken')
    },
    getToken(): string | null { return _accessToken },
}
