import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { LineChart } from '../components/charts.jsx'
import { formatKwh } from '../utils/formatting.js'
import { fetchForecast } from '../services/advanced.js'

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function ForecastDashboard() {
  const { user } = useAuth()
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchForecast(todayDate())
      .then(setForecast)
      .catch(() => setError('Could not load your forecast.'))
  }, [])

  const isProsumer = user?.type === 'prosumer'
  const chartData = forecast?.hourly.map((h) => ({ label: `${h.hour}h`, value: h.forecast })) || []

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">⚡ AI Forecast Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isProsumer ? 'Expected solar generation for today, hour by hour.' : 'Expected energy consumption for today, hour by hour.'}
        </p>

        {/* Honesty disclosure — this is a shaped heuristic curve (a solar
            bell-curve / two-peak usage pattern with light randomness), not a
            trained ML model. There's no historical-data pipeline or model
            file behind it. */}
        <p className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
          This forecast is a pattern-based estimate (typical solar/usage curves), not a trained machine-learning model — this
          project has no historical-data pipeline to train one on yet.
        </p>

        {error ? (
          <p className="mt-6 text-red-600">{error}</p>
        ) : !forecast ? (
          <div className="mt-6"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Total {isProsumer ? 'Generation' : 'Consumption'} Today
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatKwh(forecast.totalForecast)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Best Hour</p>
                <p className="mt-1 text-2xl font-bold text-brand-green">{forecast.peakHour}:00</p>
                <p className="mt-1 text-xs text-slate-400">{forecast.hourly[forecast.peakHour]?.recommendation}</p>
              </div>
            </div>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">24-Hour Forecast</h2>
              <div className="mt-4">
                <LineChart data={chartData} valueFormatter={(v) => formatKwh(v)} />
              </div>
            </section>

            <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Hour</th>
                    <th className="px-4 py-2.5">Forecast</th>
                    <th className="px-4 py-2.5">Confidence</th>
                    <th className="px-4 py-2.5">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {forecast.hourly.map((h) => (
                    <tr key={h.hour} className={h.hour === forecast.peakHour ? 'bg-green-50' : undefined}>
                      <td className="px-4 py-2 text-slate-500">{h.hour}:00</td>
                      <td className="px-4 py-2 font-medium text-slate-700">{formatKwh(h.forecast)}</td>
                      <td className="px-4 py-2 text-slate-500">{Math.round(h.confidence)}%</td>
                      <td className="px-4 py-2 text-slate-600">{h.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default ForecastDashboard
