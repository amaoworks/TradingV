import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
  type AuthUser,
} from '../lib/auth'

interface AuthContextValue {
  /** Currently logged-in user, or null */
  user: AuthUser | null
  /** JWT token, or null */
  token: string | null
  /** Whether user is authenticated */
  isLoggedIn: boolean
  /** Call after a successful /api/auth/login response */
  login: (token: string, user: AuthUser) => void
  /** Clear auth state and redirect to login */
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken)
    setStoredUser(newUser)
    setTokenState(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setTokenState(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoggedIn: !!token,
      login,
      logout,
    }),
    [user, token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
