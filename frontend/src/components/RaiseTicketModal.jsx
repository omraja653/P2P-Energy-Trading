import { useState } from 'react'
import { createTicket } from '../services/support.js'
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../utils/formatting.js'

// Shared "raise a ticket" form — used both by the Support Center page and
// the chatbot hand-off. `initial` lets a caller pre-fill fields (e.g. the
// chatbot passing along the conversation as context).
function RaiseTicketModal({ initial, onClose, onCreated }) {
  const [subject, setSubject] = useState(initial?.subject || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [category, setCategory] = useState(initial?.category || TICKET_CATEGORIES[0])
  const [priority, setPriority] = useState(initial?.priority || 'Medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!subject.trim() || !description.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        chatbotInitiated: Boolean(initial?.chatbotInitiated),
        relatedChatMessage: initial?.relatedChatMessage || null,
      })
      onCreated?.(ticket)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Raise a Ticket</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {initial?.chatbotInitiated && (
            <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              This ticket will include your recent chat conversation for context.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              placeholder="Short summary of the issue"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              placeholder="Describe what happened, what you expected, and any steps to reproduce."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: 'rgb(0, 150, 135)' }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RaiseTicketModal
