import { useCallback, useState } from 'react'
import { login as loginRequest, logout as clearSession, getStoredUser } from '../services/auth.js'

export function useAuth() {
  const [user, setUser] = useState(getStoredUser)

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials)
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
    }
    return data
  }, [])

  const logout = useCallback(() => {
    clearSession()
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return { user, login, logout, isAuthenticated: Boolean(user) }
}
