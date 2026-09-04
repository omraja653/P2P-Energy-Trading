import { useEffect, useState } from 'react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Toast from '../components/Toast.jsx'
import { fetchSystemSettings, updateSystemSettings } from '../services/admin.js'

function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSystemSettings()
      .then((s) => {
        setSettings(s)
        setForm(s)
      })
      .catch(() => setError('Could not load settings.'))
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSystemSettings({
        tradingHoursEnabled: form.tradingHoursEnabled,
        tradingHoursStart: form.tradingHoursStart,
        tradingHoursEnd: form.tradingHoursEnd,
        platformFeeRate: Number(form.platformFeeRate),
        gridWheelRate: Number(form.gridWheelRate),
        minTradeKWh: Number(form.minTradeKWh),
        maxTradeKWh: Number(form.maxTradeKWh),
        settlementConfirmationHours: Number(form.settlementConfirmationHours),
      })
      setSettings(updated)
      setForm(updated)
      setToast('Settings saved')
    } catch (err) {
      setToast(err.response?.data?.error || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  const prosumerPayoutPercent = form ? Math.round((1 - form.platformFeeRate - form.gridWheelRate) * 1000) / 10 : null

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !form ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              Fee rates below are live — they're read by the settlement engine on every trade settlement. Trading hours and
              min/max trade amount are stored here but not yet enforced anywhere in the trading flow.
            </p>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.tradingHoursEnabled} onChange={(e) => update('tradingHoursEnabled', e.target.checked)} />
              Restrict trading to specific hours
            </label>

            {form.tradingHoursEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Start</label>
                  <input type="time" value={form.tradingHoursStart} onChange={(e) => update('tradingHoursStart', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">End</label>
                  <input type="time" value={form.tradingHoursEnd} onChange={(e) => update('tradingHoursEnd', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Platform Fee (%)</label>
                <input type="number" step="0.1" min="0" max="50" value={form.platformFeeRate * 100} onChange={(e) => update('platformFeeRate', Number(e.target.value) / 100)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Grid Wheeling Fee (%)</label>
                <input type="number" step="0.1" min="0" max="50" value={form.gridWheelRate * 100} onChange={(e) => update('gridWheelRate', Number(e.target.value) / 100)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <p className="text-xs text-slate-500">Prosumer payout: <span className="font-semibold text-slate-700">{prosumerPayoutPercent}%</span> of trade total (100% − platform − grid fees)</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Min Trade (kWh)</label>
                <input type="number" step="0.1" min="0" value={form.minTradeKWh} onChange={(e) => update('minTradeKWh', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Max Trade (kWh)</label>
                <input type="number" step="0.1" min="0" value={form.maxTradeKWh} onChange={(e) => update('maxTradeKWh', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Settlement Confirmation Time (hours)</label>
              <input type="number" min="1" value={form.settlementConfirmationHours} onChange={(e) => update('settlementConfirmationHours', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Email template editing and per-admin role scoping aren't built — there's no template system in this project's email
              sender, and every admin currently has full access (no tiered permissions exist to scope down).
            </p>

            <button type="submit" disabled={saving} style={{ backgroundColor: 'rgb(76, 175, 80)' }} className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

export default AdminSettings
