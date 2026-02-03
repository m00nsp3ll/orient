"use client"

import { useCallback, useEffect, useState } from "react"
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
} from "@react-google-maps/api"

const libraries: ("places" | "geometry")[] = ["places", "geometry"]

interface RouteCoordinate {
  name: string
  hotel: string
  lat: number | null
  lng: number | null
  region: string
}

interface RouteMapPreviewProps {
  coordinates: RouteCoordinate[]
  spaCoords: { lat: number; lng: number }
  mode: "pickup" | "dropoff"
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
}

// Orient SPA adresi - Doğru konum
const ORIENT_SPA_ADDRESS = "Orient Marina Spa Wellness, Alanya Marina, Alanya, Antalya, Türkiye"

export default function RouteMapPreview({
  coordinates,
  spaCoords,
  mode,
}: RouteMapPreviewProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null)
  const [resolvedCoords, setResolvedCoords] = useState<google.maps.LatLng[]>([])
  const [spaLocation, setSpaLocation] = useState<google.maps.LatLng | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
    language: "tr",
  })

  // Use coordinates from database (no geocoding needed!)
  useEffect(() => {
    if (!isLoaded || coordinates.length === 0) return

    setIsCalculating(true)

    try {
      // SPA location - use provided coordinates
      const spaLoc = new google.maps.LatLng(spaCoords.lat, spaCoords.lng)
      setSpaLocation(spaLoc)

      // Use hotel coordinates from database
      const coords = coordinates
        .filter(coord => coord.lat !== null && coord.lng !== null)
        .map(coord => new google.maps.LatLng(coord.lat!, coord.lng!))

      setResolvedCoords(coords)
    } catch (error) {
      console.error("Coordinate error:", error)
    } finally {
      setIsCalculating(false)
    }
  }, [isLoaded, coordinates, spaCoords])

  // Calculate route when coordinates are resolved
  useEffect(() => {
    if (!isLoaded || !spaLocation || resolvedCoords.length === 0) return

    const directionsService = new google.maps.DirectionsService()

    // Build waypoints
    const waypoints = resolvedCoords.map((coord) => ({
      location: coord,
      stopover: true,
    }))

    directionsService.route(
      {
        origin: spaLocation,
        destination: spaLocation,
        waypoints: waypoints,
        optimizeWaypoints: false, // Keep user's order
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result)

          // Calculate total distance and duration
          let totalDistance = 0
          let totalDuration = 0
          result.routes[0].legs.forEach((leg) => {
            totalDistance += leg.distance?.value || 0
            totalDuration += leg.duration?.value || 0
          })

          setRouteInfo({
            distance: (totalDistance / 1000).toFixed(1) + " km",
            duration: Math.round(totalDuration / 60) + " dk",
          })
        } else {
          console.error("Directions request failed:", status)
        }
      }
    )
  }, [isLoaded, spaLocation, resolvedCoords])

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-red-50 rounded-lg">
        <div className="text-sm text-red-600">Harita yüklenemedi</div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-sm text-muted-foreground">Harita yükleniyor...</div>
      </div>
    )
  }

  const mapCenter = spaLocation
    ? { lat: spaLocation.lat(), lng: spaLocation.lng() }
    : spaCoords

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={11}
        options={mapOptions}
      >
        {/* Directions with route line */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#3b82f6",
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}

        {/* SPA Marker - Start/End */}
        {spaLocation && (
          <Marker
            position={{ lat: spaLocation.lat(), lng: spaLocation.lng() }}
            label={{
              text: "S",
              color: "white",
              fontWeight: "bold",
              fontSize: "14px",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 18,
              fillColor: "#22c55e",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 3,
            }}
            title="Orient SPA - Başlangıç/Bitiş"
          />
        )}

        {/* Stop Markers */}
        {resolvedCoords.map((coord, index) => (
          <Marker
            key={index}
            position={{ lat: coord.lat(), lng: coord.lng() }}
            label={{
              text: String(index + 1),
              color: "white",
              fontWeight: "bold",
              fontSize: "12px",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: "#3b82f6",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 3,
            }}
            title={`${index + 1}. ${coordinates[index]?.name} - ${coordinates[index]?.hotel}`}
          />
        ))}
      </GoogleMap>

      {/* Loading overlay */}
      {isCalculating && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Adresler çözümleniyor...</div>
        </div>
      )}

      {/* Route Info Box */}
      {routeInfo && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-sm">
          <div className="font-bold mb-1">Rota Bilgisi</div>
          <div>📍 {coordinates.length} durak</div>
          <div>🛣️ {routeInfo.distance}</div>
          <div>⏱️ ~{routeInfo.duration}</div>
        </div>
      )}
    </div>
  )
}
