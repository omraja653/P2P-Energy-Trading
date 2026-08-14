import api from './api.js'

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials)
  if (data?.token) {
    localStorage.setItem('token', data.token)
  }
  return data
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export function logout() {
  localStorage.removeItem('token')
}

export function getStoredUser() {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}
