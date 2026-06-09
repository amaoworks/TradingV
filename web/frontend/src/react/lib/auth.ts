/**
 * Lightweight auth token helpers.
 *
 * In this first iteration we only store/read a JWT from localStorage.
 * The actual login API call lives in LoginPage; these helpers are shared
 * across the app so any component can check auth state.
 */

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export interface AuthUser {
  id?: string
  username: string
  email?: string
  role?: 'admin' | 'member' | 'viewer'
  avatar?: string
  active?: boolean
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function removeStoredUser() {
  localStorage.removeItem(USER_KEY)
}

export function clearAuth() {
  removeToken()
  removeStoredUser()
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
