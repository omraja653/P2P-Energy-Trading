import { useEffect, useMemo, useRef } from 'react'

const FALLBACK_LOCATIONS = [
  { label: 'Bengaluru, India', lat: 12.9716, lng: 77.5946 },
  { label: 'Delhi, India', lat: 28.6139, lng: 77.209 },
  { label: 'Mumbai, India', lat: 19.076, lng: 72.8777 },
  { label: 'Pune, India', lat: 18.5204, lng: 73.8567 },
  { label: 'Hyderabad, India', lat: 17.385, lng: 78.4867 },
  { label: 'Chennai, India', lat: 13.0827, lng: 80.2707 },
  { label: 'Ahmedabad, India', lat: 23.0225, lng: 72.5714 },
  { label: 'Kolkata, India', lat: 22.5726, lng: 88.3639 },
]

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function GoogleMapPanel({ listings = [] }) {
  const mapRef = useRef(null)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const markers = useMemo(() => {
    return (listings || []).map((listing, index) => {
      const rawLocation = listing.prosumerId?.location || listing.location || null
      const fallback = FALLBACK_LOCATIONS[index % FALLBACK_LOCATIONS.length]
      const location =
        rawLocation && Number.isFinite(rawLocation.lat) && Number.isFinite(rawLocation.lng)
          ? rawLocation
          : fallback

      const name = listing.prosumerId
        ? `${listing.prosumerId.firstName || ''} ${listing.prosumerId.lastName || ''}`.trim() || 'Prosumer'
        : 'Prosumer'

      return {
        id: listing._id,
        name,
        label: location.label || listing.prosumerId?.city || `${name} location`,
        lat: Number(location.lat),
        lng: Number(location.lng),
        isProsumer: listing.prosumerId?.type === 'prosumer' || location.label === 'My location' || false,
      }
    })
  }, [listings])

  useEffect(() => {
    if (!apiKey || !mapRef.current || !markers.length) return

    const initMap = () => {
      if (!window.google?.maps) return

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: markers[0].lat, lng: markers[0].lng },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })

      if (markers.length > 1) {
        const bounds = new window.google.maps.LatLngBounds()
        markers.forEach((marker) => {
          bounds.extend(new window.google.maps.LatLng(marker.lat, marker.lng))
        })
        map.fitBounds(bounds)
      }

      markers.forEach((marker) => {
        const isProsumer = marker.isProsumer
        const googleMarker = new window.google.maps.Marker({
          position: { lat: marker.lat, lng: marker.lng },
          map,
          title: marker.label,
          icon: isProsumer
            ? {
                url: '/solarpanel.png',
                scaledSize: new window.google.maps.Size(28, 28),
                anchor: new window.google.maps.Point(14, 14),
              }
            : undefined,
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: Arial, sans-serif; min-width: 170px;">
              <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(marker.label)}</div>
              <div style="color: #475569;">${escapeHtml(marker.name)}</div>
            </div>
          `,
        })

        googleMarker.addListener('click', () => {
          infoWindow.open({ anchor: googleMarker, map })
        })
      })
    }

    if (window.google?.maps) {
      initMap()
      return
    }

    const scriptId = 'google-maps-script'
    const existingScript = document.getElementById(scriptId)

    if (existingScript) {
      const waitForMap = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(waitForMap)
          initMap()
        }
      }, 200)
      return () => clearInterval(waitForMap)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.defer = true
    script.onload = initMap
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [apiKey, markers])

  if (!apiKey) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Add <span className="font-medium text-slate-700">VITE_GOOGLE_MAPS_API_KEY</span> to enable the marketplace map.
      </div>
    )
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Marketplace map</p>
          <p className="text-xs text-slate-500">Visible prosumer locations</p>
        </div>
      </div>
      <div ref={mapRef} className="h-[320px] w-full" />
    </div>
  )
}
