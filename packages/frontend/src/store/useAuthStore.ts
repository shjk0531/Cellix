import { create } from 'zustand'
import { apiClient } from '../api/client'

interface User {
    id: string
    email: string
    name: string
    role: string
}

interface AuthState {
    user: User | null
    isLoading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, name: string) => Promise<void>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    isLoading: true,

    login: async (email, password) => {
        const data = await apiClient.post<{ accessToken: string; user: User }>(
            '/api/auth/login',
            { email, password },
        )
        apiClient.setToken(data.accessToken)
        set({ user: data.user })
    },

    register: async (email, password, name) => {
        const data = await apiClient.post<{ accessToken: string; user: User }>(
            '/api/auth/register',
            { email, password, name },
        )
        apiClient.setToken(data.accessToken)
        set({ user: data.user })
    },

    logout: async () => {
        try {
            await apiClient.post('/api/auth/logout')
        } catch {
            // ignore
        }
        apiClient.setToken(null)
        set({ user: null })
    },

    checkAuth: async () => {
        set({ isLoading: true })
        try {
            const data = await apiClient.post<{ accessToken: string; user: User }>(
                '/api/auth/refresh',
            )
            apiClient.setToken(data.accessToken)
            set({ user: data.user, isLoading: false })
        } catch {
            apiClient.setToken(null)
            set({ user: null, isLoading: false })
        }
    },
}))
