"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Search, Loader2 } from "lucide-react"
import { toast } from "sonner"

const libraries: ("places" | "geometry")[] = ["places", "geometry"]

const mapContainerStyle = {
  width: "100%",
  height: "500px",
}

const defaultCenter = {
  lat: 36.5436,
  lng: 31.9956,
}

interface LocationData {
  address: string
  lat: number
  lng: number
  googleMapsUrl: string
}

interface LocationPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLocationSelect: (location: LocationData) => void
  initialLocation?: {
    lat: number | null
    lng: number | null
    address: string | null
  }
  hotelName: string
}

export function LocationPickerModal({
  open,
  onOpenChange,
  onLocationSelect,
  initialLocation,
  hotelName,
}: LocationPickerModalProps) {
  const [selectedPosition, setSelectedPosition] = useState<google.maps.LatLngLiteral | null>(
    initialLocation?.lat && initialLocation?.lng
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : null
  )
  const [address, setAddress] = useState(initialLocation?.address || "")
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(
    initialLocation?.lat && initialLocation?.lng
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : defaultCenter
  )
  const [isGeocoding, setIsGeocoding] = useState(false)

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
    language: "tr",
  })

  // Reset when modal opens
  useEffect(() => {
    if (open && initialLocation?.lat && initialLocation?.lng) {
      const pos = { lat: initialLocation.lat, lng: initialLocation.lng }
      setSelectedPosition(pos)
      setMapCenter(pos)
      setAddress(initialLocation.address || "")
    } else if (open && !initialLocation?.lat) {
      setSelectedPosition(null)
      setAddress("")
      setMapCenter(defaultCenter)
    }
  }, [open, initialLocation])

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return

      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setSelectedPosition({ lat, lng })

      // Reverse geocode to get address
      setIsGeocoding(true)
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setIsGeocoding(false)
        if (status === "OK" && results && results[0]) {
          setAddress(results[0].formatted_address)
        } else {
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        }
      })
    },
    []
  )

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()

    if (!place) {
      console.log("No place returned")
      return
    }

    console.log("Place selected:", place)

    if (!place.geometry?.location) {
      console.log("No geometry in place")
      toast.error("Seçilen konum için koordinat bulunamadı")
      return
    }

    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()
    const newPosition = { lat, lng }

    console.log("Setting new position:", newPosition)

    setSelectedPosition(newPosition)
    setMapCenter(newPosition)
    setAddress(place.formatted_address || place.name || "")

    // Zoom to the place
    if (mapRef.current) {
      if (place.geometry.viewport) {
        mapRef.current.fitBounds(place.geometry.viewport)
      } else {
        mapRef.current.setCenter(newPosition)
        mapRef.current.setZoom(16)
      }
    }

    toast.success("Konum işaretlendi")
  }, [])

  const handleConfirm = () => {
    if (!selectedPosition) {
      toast.error("Lütfen haritadan bir konum seçin")
      return
    }

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${selectedPosition.lat},${selectedPosition.lng}`

    onLocationSelect({
      address: address || `${selectedPosition.lat.toFixed(6)}, ${selectedPosition.lng.toFixed(6)}`,
      lat: selectedPosition.lat,
      lng: selectedPosition.lng,
      googleMapsUrl,
    })

    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  if (loadError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hata</DialogTitle>
          </DialogHeader>
          <div className="text-red-600">Google Maps yüklenemedi</div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!isLoaded) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konum Seç</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-[500px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {hotelName} - Konum Seç
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Box with Autocomplete */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete
                console.log("Autocomplete loaded")
              }}
              onPlaceChanged={onPlaceChanged}
              options={{
                componentRestrictions: { country: "tr" },
                fields: ["formatted_address", "geometry", "name", "place_id"],
                types: ["establishment", "geocode"],
              }}
            >
              <Input
                type="text"
                placeholder="Otel adı veya adres ara... (örn: Grand Okan)"
                className="pl-10 w-full"
                defaultValue=""
              />
            </Autocomplete>
            <div className="text-xs text-gray-500 mt-1">
              💡 Otel adını yazın, açılan listeden seçin veya haritaya tıklayın
            </div>
          </div>

          {/* Map */}
          <div className="border rounded-lg overflow-hidden">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={selectedPosition ? 16 : 12}
              onClick={onMapClick}
              onLoad={(map) => {
                mapRef.current = map
              }}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
              }}
            >
              {selectedPosition && (
                <Marker
                  position={selectedPosition}
                  animation={google.maps.Animation.DROP}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: "#3b82f6",
                    fillOpacity: 1,
                    strokeColor: "white",
                    strokeWeight: 3,
                  }}
                />
              )}
            </GoogleMap>
          </div>

          {/* Selected Address */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-slate-600 mb-1">Seçilen Konum:</div>
            {isGeocoding ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Adres alınıyor...
              </div>
            ) : selectedPosition ? (
              <div className="space-y-1">
                <div className="text-sm">{address || "Adres bulunamadı"}</div>
                <div className="text-xs text-slate-500">
                  Koordinatlar: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Yukarıdan arama yapın veya haritadan bir konum seçin
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            İptal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPosition || isGeocoding}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Konumu Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
