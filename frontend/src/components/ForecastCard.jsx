import { useNavigate } from 'react-router-dom'
import { formatKwh } from '../utils/formatting.js'

// Small dashboard-card version of ForecastDashboard.jsx's full 24-hour page
// — same real forecastService data (tomorrow's date), just the headline
// number and one CTA instead of the full hourly breakdown/table.
function ForecastCard({ forecast, userType }) {
  const navigate = useNavigate()
  const isProsumer = userType === 'prosumer'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">
        {isProsumer ? '☀️ Solar Generation Forecast' : '💡 Consumption Forecast'}
      </h2>
      {!forecast ? (
        <p className="mt-2 text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-400">Tomorrow</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatKwh(forecast.totalForecast)}</p>
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            style={{ backgroundColor: isProsumer ? 'rgb(76, 175, 80)' : 'rgb(33, 150, 243)' }}
            className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            {isProsumer ? 'Sell Now' : 'Buy Now'}
          </button>
        </>
      )}
    </div>
  )
}

export default ForecastCard
