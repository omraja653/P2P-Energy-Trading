import axios from 'axios'

// Relative by default so requests go back to whatever host/IP the page
// itself was loaded from (http://192.168.1.5:5173 -> /api resolves to
// http://192.168.1.5:5173/api), which vite.config.js's dev-server proxy
// then forwards to the backend on localhost:5000 (same machine, so
// "localhost" there is always correct regardless of which host/IP the
// browser used to reach the dev server). A hardcoded absolute URL here
// would bypass that proxy and break as soon as the page isn't loaded from
// literally "localhost".
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
