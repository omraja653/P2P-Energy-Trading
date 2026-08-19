import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { TicketStatusBadge, PriorityBadge } from '../components/TicketBadges.jsx'
import { formatDateTime } from '../utils/formatting.js'
import { fetchTicket, fetchTicketReplies, addReply, closeTicket } from '../services/support.js'

function ReplyBubble({ reply }) {
  const isCustomer = reply.userRole === 'customer'
  const name = reply.userId ? `${reply.userId.firstName || ''} ${reply.userId.lastName || ''}`.trim() : 'Unknown'
  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm shadow-sm ${isCustomer ? 'bg-brand-blue text-white' : 'bg-white text-slate-800'}`}>
        <div className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${isCustomer ? 'text-white/80' : 'text-slate-500'}`}>
          <span>📧</span>
          <span>{name || (isCustomer ? 'You' : 'Support')}</span>
          <span>·</span>
          <span>{formatDateTime(reply.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap">{reply.message}</p>
      </div>
    </div>
  )
}

function TicketDetail() {
  const { ticketId } = useParams()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [t, r] = await Promise.all([fetchTicket(ticketId), fetchTicketReplies(ticketId)])
      setTicket(t)
      setReplies(r)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load this ticket.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  async function handleReply(e) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const reply = await addReply(ticketId, message.trim())
      setReplies((prev) => [...prev, reply])
      setMessage('')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send your reply.')
    } finally {
      setSending(false)
    }
  }

  async function handleClose() {
    setClosing(true)
    try {
      const updated = await closeTicket(ticketId)
      setTicket(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not close this ticket.')
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5] p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !ticket) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5] p-8">
        <p className="text-red-600">{error}</p>
        <Link to="/support" className="mt-3 inline-block text-sm text-brand-blue hover:underline">
          ← Back to Support Center
        </Link>
      </div>
    )
  }

  const isOwner = String(ticket.userId?._id || ticket.userId) === String(user?.id)
  const canClose = isOwner && ticket.status === 'Resolved'
  const isClosed = ticket.status === 'Closed'
  const agentName = ticket.assignedTo ? `${ticket.assignedTo.firstName || ''} ${ticket.assignedTo.lastName || ''}`.trim() : 'Unassigned'

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <Link to="/support" className="text-sm text-brand-blue hover:underline">
          ← Back to Support Center
        </Link>

        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{ticket.ticketId}</p>
              <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={ticket.priority} />
              <TicketStatusBadge status={ticket.status} />
            </div>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{ticket.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-4">
            <div>
              <p className="font-medium text-slate-400">Category</p>
              <p className="mt-0.5 text-slate-700">{ticket.category}</p>
            </div>
            <div>
              <p className="font-medium text-slate-400">Assigned To</p>
              <p className="mt-0.5 text-slate-700">{agentName}</p>
            </div>
            <div>
              <p className="font-medium text-slate-400">Created</p>
              <p className="mt-0.5 text-slate-700">{formatDateTime(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="font-medium text-slate-400">Last Updated</p>
              <p className="mt-0.5 text-slate-700">{formatDateTime(ticket.updatedAt)}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="font-medium text-slate-400">Resolved</p>
                <p className="mt-0.5 text-slate-700">{formatDateTime(ticket.resolvedAt)}</p>
              </div>
            )}
          </div>

          {canClose && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={closing}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {closing ? 'Closing…' : 'Close Ticket'}
              </button>
            </div>
          )}
        </div>

        {/* Thread */}
        <div className="mt-6 space-y-3">
          {replies.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">No replies yet.</p>
          ) : (
            replies.map((r) => <ReplyBubble key={r._id} reply={r} />)
          )}
        </div>

        {error && ticket && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <form onSubmit={handleReply} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            disabled={isClosed}
            placeholder={isClosed ? 'This ticket is closed and no longer accepts replies.' : 'Add a reply…'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isClosed || sending || !message.trim()}
              style={{ backgroundColor: 'rgb(0, 150, 135)' }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Add Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TicketDetail
