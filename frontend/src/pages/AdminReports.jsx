import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatCurrency, formatKwh } from '../utils/formatting.js'
import { fetchRevenueReport, fetchComplianceReport, fetchDisputesReport, downloadRevenueCsv } from '../services/admin.js'

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}

function AdminReports() {
  const [revenue, setRevenue] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [disputes, setDisputes] = useState(null)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([fetchRevenueReport(), fetchComplianceReport(), fetchDisputesReport()])
      .then(([r, c, d]) => {
        setRevenue(r)
        setCompliance(c)
        setDisputes(d)
      })
      .catch(() => setError('Could not load reports.'))
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await downloadRevenueCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gridmate-revenue-report.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <AdminNav />
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ backgroundColor: 'rgb(0, 150, 135)' }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : '⬇ Export Revenue CSV'}
          </button>
        </div>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !revenue ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Revenue Report</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Total Trades" value={revenue.totalTrades} />
                <Stat label="Total Volume" value={formatKwh(revenue.totalVolumeKWh)} />
                <Stat label="Prosumer Earnings" value={formatCurrency(revenue.prosumerAmount)} />
                <Stat label="Grid Wheeling Fees" value={formatCurrency(revenue.gridWheelAmount)} />
                <Stat label="Platform Earned" value={formatCurrency(revenue.platformAmount)} />
                <Stat label="Total Revenue" value={formatCurrency(revenue.total)} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">Compliance Report</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Total Users" value={compliance.totalUsers} />
                <Stat label="Email Verified" value={`${compliance.emailVerifiedPercent}%`} />
                <Stat label="Mobile Verified" value={`${compliance.mobileVerifiedPercent}%`} />
                <Stat label="KYC Completed" value={`${compliance.kycVerifiedPercent}%`} />
              </div>
              {compliance.byRole.length > 0 && (
                <div className="mt-3 space-y-1 text-sm">
                  {compliance.byRole.map((r) => (
                    <div key={r.role} className="flex justify-between text-slate-600">
                      <span className="capitalize">{r.role}</span>
                      <span>{r.kycVerifiedPercent}% KYC verified ({r.total} users)</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="font-semibold text-slate-900">Disputes Report</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total Disputes" value={disputes.totalDisputes} />
                <Stat label="Dispute Rate" value={`${disputes.disputeRate}%`} />
                <Stat label="Avg Resolution Time" value={disputes.avgResolutionHours != null ? `${disputes.avgResolutionHours}h` : '—'} />
                <Stat label="Still Open" value={disputes.openCount} />
              </div>
              {Object.keys(disputes.decisionBreakdown).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {Object.entries(disputes.decisionBreakdown).map(([decision, count]) => (
                    <span key={decision} className="rounded-full bg-slate-100 px-2.5 py-1 font-medium capitalize text-slate-600">
                      {decision.replace(/_/g, ' ')}: {count}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminReports
