"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface Hotel {
  id: string
  name: string
  lat: number | null
  lng: number | null
  region: { name: string }
  distanceToMarina: number | null
  googleMapsUrl?: string | null
}

interface HotelsMapProps {
  hotels: Hotel[]
  selectedRegion?: string
}

// Bölge renkleri
const REGION_COLORS: { [key: string]: string } = {
  "Okurcalar": "#ef4444",
  "Avsallar": "#f97316",
  "Türkler": "#eab308",
  "Konaklı": "#22c55e",
  "Oba": "#14b8a6",
  "Alanya Merkez": "#3b82f6",
  "Cikcilli": "#6366f1",
  "Tosmur": "#8b5cf6",
  "Kestel": "#d946ef",
  "Mahmutlar": "#ec4899",
  "Kargıcak": "#f43f5e",
}

// Özel marker ikonu oluştur
function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 14px;
      height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// Orient Marina ikonu
const marinaIcon = L.divIcon({
  className: "marina-marker",
  html: `<div style="
    background: #059669;
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 11px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    white-space: nowrap;
  ">🏢 Orient Marina Spa</div>`,
  iconSize: [140, 30],
  iconAnchor: [70, 15],
})

// Harita merkezini ayarla
function MapController({ selectedRegion, hotels }: { selectedRegion?: string; hotels: Hotel[] }) {
  const map = useMap()

  useEffect(() => {
    if (selectedRegion && selectedRegion !== "all") {
      const regionHotels = hotels.filter(h => h.region.name === selectedRegion && h.lat && h.lng)
      if (regionHotels.length > 0) {
        const bounds = L.latLngBounds(regionHotels.map(h => [h.lat!, h.lng!]))
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    } else {
      map.setView([36.5509, 31.9961], 11)
    }
  }, [selectedRegion, hotels, map])

  return null
}

export default function HotelsMap({ hotels, selectedRegion }: HotelsMapProps) {
  const orientMarina = { lat: 36.5509, lng: 31.9961 }

  const filteredHotels = selectedRegion && selectedRegion !== "all"
    ? hotels.filter(h => h.region.name === selectedRegion)
    : hotels

  return (
    <div className="relative">
      <MapContainer
        center={[orientMarina.lat, orientMarina.lng]}
        zoom={11}
        style={{ height: "400px", width: "100%", borderRadius: "8px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController selectedRegion={selectedRegion} hotels={hotels} />

        {/* Orient Marina Marker */}
        <Marker position={[orientMarina.lat, orientMarina.lng]} icon={marinaIcon}>
          <Popup>
            <strong>Orient Marina Spa</strong>
            <br />
            Merkez Konum
          </Popup>
        </Marker>

        {/* Hotel Markers */}
        {filteredHotels.map((hotel) => {
          if (!hotel.lat || !hotel.lng) return null

          const color = REGION_COLORS[hotel.region.name] || "#6b7280"
          const icon = createMarkerIcon(color)

          return (
            <Marker key={hotel.id} position={[hotel.lat, hotel.lng]} icon={icon}>
              <Popup>
                <div className="text-sm">
                  <strong>{hotel.name}</strong>
                  <br />
                  <span className="text-gray-600">{hotel.region.name}</span>
                  <br />
                  <span className="text-green-600">{hotel.distanceToMarina} km uzaklıkta</span>
                  {hotel.googleMapsUrl && (
                    <>
                      <br />
                      <a
                        href={hotel.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Google Maps'te Aç →
                      </a>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Bölge Renk Açıklaması */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg text-xs z-[1000]">
        <div className="font-semibold mb-2">Bölgeler</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(REGION_COLORS).map(([region, color]) => (
            <div key={region} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
                style={{ background: color }}
              />
              <span className="truncate">{region}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
