import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from './LoadingSpinner.jsx'

const ROLES = [
  { type: 'prosumer', label: 'Prosumer', description: 'I generate energy' },
  { type: 'consumer', label: 'Consumer', description: 'I buy energy' },
]

/**
 * Blocking modal shown whenever an authenticated user has no `type` yet
 * (fresh local registration or first Google sign-in). No close button —
 * picking a role is a required one-time step, not optional.
 */
function RoleSelector({ onDone }) {
  const { updateUserRole } = useAuth()
  const [submitting, setSubmitting] = useState(null) // which type is in flight
  const [error, setError] = useState('')

  async function choose(type) {
    setError('')
    setSubmitting(type)
    try {
      const data = await updateUserRole(type)
      onDone(data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save your role. Please try again.')
      setSubmitting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-2xl">
        <h2 className="text-center text-xl font-bold text-slate-900">Choose your role</h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          This determines your dashboard and what you can do on GridMate.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {ROLES.map((role) => (
            <button
              key={role.type}
              type="button"
              onClick={() => choose(role.type)}
              disabled={Boolean(submitting)}
              className="rounded border border-slate-300 px-4 py-3 text-left hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              <span className="block text-base font-semibold text-slate-900">{role.label}</span>
              <span className="block text-sm text-slate-500">{role.description}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded bg-red-50 px-3 py-2 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {submitting && <LoadingSpinner />}
      </div>
    </div>
  )
}

export default RoleSelector
