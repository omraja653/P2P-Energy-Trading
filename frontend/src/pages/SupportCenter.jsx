import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import RaiseTicketModal from '../components/RaiseTicketModal.jsx'
import { TicketStatusBadge, PriorityBadge } from '../components/TicketBadges.jsx'
import { formatDateTime } from '../utils/formatting.js'

function SupportCenter() {
  const tickets = useFetch('/support/tickets')
  const [showModal, setShowModal] = useState(false)
  const [justCreated, setJustCreated] = useState(null)

  function handleCreated(ticket) {
    setShowModal(false)
    setJustCreated(ticket)
    // useFetch has no manual refetch — a full reload keeps this simple and
    // guarantees the new ticket (and any auto-assignment) shows up.
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Support Center</h1>
            <p className="text-slate-500">Raise a ticket or check on one you already opened.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{ backgroundColor: 'rgb(0, 150, 135)' }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            + Raise a Ticket
          </button>
        </div>

        {justCreated && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Ticket {justCreated.ticketId} created — refreshing your ticket list…
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {tickets.loading ? (
            <div className="p-6"><LoadingSpinner /></div>
          ) : tickets.error ? (
            <p className="p-6 text-red-600">Failed to load your tickets.</p>
          ) : tickets.data.length === 0 ? (
            <p className="p-6 text-slate-500">You haven&apos;t raised any tickets yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Ticket ID</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Created</th>
                  <th className="px-4 py-2.5">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.data.map((t) => (
                  <tr key={t._id} className="cursor-pointer transition hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link to={`/support/tickets/${t._id}`} className="font-medium text-brand-blue hover:underline">
                        {t.ticketId}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{t.subject}</td>
                    <td className="px-4 py-2.5"><TicketStatusBadge status={t.status} /></td>
                    <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && <RaiseTicketModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}

export default SupportCenter
