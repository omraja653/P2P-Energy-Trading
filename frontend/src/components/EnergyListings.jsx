import { useFetch } from '../hooks/useFetch.js'
import LoadingSpinner from './LoadingSpinner.jsx'

function EnergyListings() {
  // Note: base axios URL already includes /api — don't prefix it again here.
  const { data: listings, loading, error } = useFetch('/pricing/listings')

  if (loading) return <LoadingSpinner />
  if (error) return <p className="text-red-600">Failed to load listings.</p>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(listings || []).map((listing) => (
        <div key={listing._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="font-medium">{listing.quantityKWh} kWh available</p>
          <p className="text-sm text-gray-600">${listing.pricePerKwh} / kWh</p>
        </div>
      ))}
    </div>
  )
}

export default EnergyListings
