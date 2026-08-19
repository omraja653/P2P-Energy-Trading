import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import StatCard from '../components/StatCard.jsx'
import { TicketStatusBadge, PriorityBadge } from '../components/TicketBadges.jsx'
import { ListIcon, CashIcon, ReceiptIcon } from '../components/icons.jsx'
import { formatDateTime, TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from '../utils/formatting.js'
import { fetchAgentTickets, fetchDashboardMetrics } from '../services/support.js'

function personName(person) {
  if (!person || typeof person !== 'object') return 'Unassigned'
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown'
}

function SupportDashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [tickets, setTickets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [m, t] = await Promise.all([
        fetchDashboardMetrics(),
        fetchAgentTickets({
          status: status || undefined,
          priority: priority || undefined,
          category: category || undefined,
          assignedTo: mineOnly ? user?.id : undefined,
          search: search || undefined,
        }),
      ])
      setMetrics(m)
      setTickets(t)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the support dashboard.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, category, mineOnly, search, user?.id])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Support Dashboard</h1>
        <p className="text-slate-500">Ticket queue and response metrics.</p>

        {loading && !metrics ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Open Tickets" value={metrics.totalOpenTickets} icon={ListIcon} tone="primary" />
              <StatCard
                label="Avg Response Time"
                value={metrics.avgResponseTimeHours != null ? `${metrics.avgResponseTimeHours}h` : '—'}
                icon={ReceiptIcon}
              />
              <StatCard label="Resolution Rate" value={`${metrics.resolutionRate}%`} icon={CashIcon} tone="success" />
              <StatCard label="Pending Replies" value={metrics.pendingReplies} icon={ListIcon} tone="warning" />
            </div>

            {/* Filters */}
            <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ticket ID or subject…"
                className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal focus:outline-none"
              />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                <option value="">All Statuses</option>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                <option value="">All Priorities</option>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                <option value="">All Categories</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                Assigned to me
              </label>
            </div>

            {/* Tickets table */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {tickets.length === 0 ? (
                <p className="p-6 text-slate-500">No tickets match these filters.</p>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Priority</th>
                      <th className="px-4 py-2.5">Assigned To</th>
                      <th className="px-4 py-2.5">Created</th>
                      <th className="px-4 py-2.5">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map((t) => (
                      <tr key={t._id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <Link to={`/support-dashboard/tickets/${t._id}`} className="font-medium text-brand-blue hover:underline">
                            {t.ticketId}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{t.subject}</td>
                        <td className="px-4 py-2.5"><TicketStatusBadge status={t.status} /></td>
                        <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
                        <td className="px-4 py-2.5 text-slate-500">{personName(t.assignedTo)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.createdAt)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SupportDashboard
