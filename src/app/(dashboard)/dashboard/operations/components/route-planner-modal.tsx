"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DriverSelector } from "./driver-selector"
import { format } from "date-fns"
import {
  MapPin,
  Clock,
  Users,
  GripVertical,
  ArrowDown,
  Route,
  Banknote,
  X,
  Plus,
  Map,
  Navigation,
  SortAsc,
  Car,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import dynamic from "next/dynamic"

// Dynamically import map component to avoid SSR issues
const RouteMapPreview = dynamic(() => import("./route-map-preview"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-slate-100 rounded-lg">
      <div className="text-sm text-muted-foreground">Harita yükleniyor...</div>
    </div>
  ),
})

interface Transfer {
  id: string
  status: string
  driverId: string | null
  arrivalTime: string | null
  appointment: {
    id: string
    startTime: string
    endTime: string
    pax: number | null
    customerName: string | null
    notes: string | null
    service: {
      id: string
      name: string
      duration: number
    }
    hotel: {
      id: string
      name: string
      address: string | null
      lat: number | null
      lng: number | null
      region: {
        name: string
      }
    } | null
  }
  driver: {
    id: string
    user: {
      id: string
      name: string
    }
  } | null
}

interface Driver {
  id: string
  phone: string
  isActive: boolean
  user: {
    id: string
    name: string
  }
}

interface RoutePlannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfers: Transfer[]
  drivers: Driver[]
  busyDriverIds: string[]
  mode: "pickup" | "dropoff"
  onAssignRoute: (transferIds: string[], driverId: string) => void
}

// Orient Marina Hamam koordinatları
const ORIENT_SPA_COORDS = { lat: 36.5603513, lng: 31.9483576 }

// Bölgelerin yaklaşık koordinatları (Alanya ve çevresi)
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Alanya Merkez": { lat: 36.5436, lng: 31.9956 },
  "Konaklı": { lat: 36.5833, lng: 31.8667 },
  "Mahmutlar": { lat: 36.4667, lng: 32.0833 },
  "Oba": { lat: 36.5500, lng: 32.0167 },
  "Kestel": { lat: 36.5333, lng: 32.0333 },
  "Kargıcak": { lat: 36.5000, lng: 32.0667 },
  "Tosmur": { lat: 36.5333, lng: 32.0000 },
  "Cikcilli": { lat: 36.5500, lng: 32.0000 },
  "Avsallar": { lat: 36.6333, lng: 31.7667 },
  "Türkler": { lat: 36.6167, lng: 31.8000 },
  "Okurcalar": { lat: 36.6667, lng: 31.7167 },
  "Payallar": { lat: 36.6500, lng: 31.7333 },
  "İncekum": { lat: 36.6833, lng: 31.7000 },
}

// Mesafe hesaplama (Haversine)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// En yakın komşu algoritması ile rota optimizasyonu
function optimizeRouteByLocation(transfers: Transfer[], startCoords: { lat: number; lng: number }): Transfer[] {
  if (transfers.length <= 1) return transfers

  const remaining = [...transfers]
  const optimized: Transfer[] = []
  let currentPos = startCoords

  while (remaining.length > 0) {
    let nearestIdx = 0
    let nearestDist = Infinity

    remaining.forEach((transfer, idx) => {
      const regionName = transfer.appointment.hotel?.region?.name || "Alanya Merkez"
      const coords = REGION_COORDS[regionName] || REGION_COORDS["Alanya Merkez"]
      const dist = calculateDistance(currentPos.lat, currentPos.lng, coords.lat, coords.lng)

      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = idx
      }
    })

    const nearest = remaining.splice(nearestIdx, 1)[0]
    optimized.push(nearest)

    const regionName = nearest.appointment.hotel?.region?.name || "Alanya Merkez"
    currentPos = REGION_COORDS[regionName] || REGION_COORDS["Alanya Merkez"]
  }

  return optimized
}

export function RoutePlannerModal({
  open,
  onOpenChange,
  transfers,
  drivers,
  busyDriverIds,
  mode,
  onAssignRoute,
}: RoutePlannerModalProps) {
  const [selectedTransfers, setSelectedTransfers] = useState<Transfer[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [showMapPreview, setShowMapPreview] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedTransfers([])
      setSelectedDriverId(null)
      setShowMapPreview(false)
    }
  }, [open])

  // Available transfers (not already in route)
  const availableTransfers = transfers.filter(
    (t) => !selectedTransfers.some((st) => st.id === t.id)
  )

  // Sort available by time then region
  const sortedAvailable = [...availableTransfers].sort((a, b) => {
    const timeA = new Date(a.appointment.startTime).getTime()
    const timeB = new Date(b.appointment.startTime).getTime()
    if (timeA !== timeB) return timeA - timeB
    const regionA = a.appointment.hotel?.region?.name || ""
    const regionB = b.appointment.hotel?.region?.name || ""
    return regionA.localeCompare(regionB, "tr")
  })

  const addToRoute = (transfer: Transfer) => {
    setSelectedTransfers([...selectedTransfers, transfer])
  }

  const removeFromRoute = (transferId: string) => {
    setSelectedTransfers(selectedTransfers.filter((t) => t.id !== transferId))
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newOrder = [...selectedTransfers]
    const [draggedItem] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(index, 0, draggedItem)
    setSelectedTransfers(newOrder)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...selectedTransfers]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setSelectedTransfers(newOrder)
  }

  const moveDown = (index: number) => {
    if (index === selectedTransfers.length - 1) return
    const newOrder = [...selectedTransfers]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setSelectedTransfers(newOrder)
  }

  const handleOptimizeByLocation = () => {
    if (selectedTransfers.length < 2) {
      toast.info("En az 2 transfer olmalı")
      return
    }
    const optimized = optimizeRouteByLocation(selectedTransfers, ORIENT_SPA_COORDS)
    setSelectedTransfers(optimized)
    toast.success("Rota konuma göre optimize edildi")
  }

  const handleAssignClick = () => {
    if (!selectedDriverId) {
      toast.error("Lütfen şoför seçin")
      return
    }
    if (selectedTransfers.length === 0) {
      toast.error("Lütfen en az bir transfer ekleyin")
      return
    }
    // Show confirmation dialog
    setShowConfirmDialog(true)
  }

  const handleConfirmAssign = () => {
    if (!selectedDriverId) return

    onAssignRoute(
      selectedTransfers.map((t) => t.id),
      selectedDriverId
    )

    // Reset state
    setSelectedTransfers([])
    setSelectedDriverId(null)
    setShowMapPreview(false)
    setShowConfirmDialog(false)
    onOpenChange(false)
  }

  // Get selected driver name
  const selectedDriver = drivers.find(d => d.id === selectedDriverId)

  const handleClose = () => {
    setSelectedTransfers([])
    setSelectedDriverId(null)
    setShowMapPreview(false)
    onOpenChange(false)
  }

  // Calculate total PAX
  const totalPax = selectedTransfers.reduce(
    (sum, t) => sum + (t.appointment.pax || 1),
    0
  )

  // Get route coordinates for map - use hotel lat/lng from database
  const routeCoordinates = selectedTransfers.map((t) => {
    const hotelName = t.appointment.hotel?.name || "Otel"
    const regionName = t.appointment.hotel?.region?.name || "Alanya"

    return {
      name: t.appointment.customerName || "Misafir",
      hotel: hotelName,
      lat: t.appointment.hotel?.lat || null,
      lng: t.appointment.hotel?.lng || null,
      region: regionName,
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="!w-[96vw] !h-[94vh] !max-w-[1800px] !max-h-[95vh] !m-0 !p-6 !rounded-lg !top-[50%] !left-[50%] !-translate-x-1/2 !-translate-y-1/2 overflow-hidden flex flex-col"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Route className="h-5 w-5" />
            {mode === "pickup" ? "Alış Rotası Oluştur" : "Bırakış Rotası Oluştur"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden min-h-[500px]">
          {/* Sol: Mevcut Transferler */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Mevcut Transferler</h3>
              <Badge variant="secondary" className="text-xs">{sortedAvailable.length} transfer</Badge>
            </div>
            <div className="flex-1 overflow-y-auto border rounded-lg p-3 bg-gray-50 space-y-2">
              {sortedAvailable.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">
                  Tüm transferler rotaya eklendi
                </p>
              ) : (
                sortedAvailable.map((transfer) => {
                  const isRest = transfer.appointment.notes?.includes("REST")
                  return (
                    <div
                      key={transfer.id}
                      className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-blue-50 cursor-pointer group transition-colors"
                      onClick={() => addToRoute(transfer)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-600">
                            {format(new Date(transfer.appointment.startTime), "HH:mm")}
                          </span>
                          <span className="font-semibold text-sm truncate">
                            {transfer.appointment.customerName || "Misafir"}
                          </span>
                          {isRest && (
                            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5">
                              <Banknote className="h-3 w-3 mr-0.5" />
                              REST
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {transfer.appointment.hotel?.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {transfer.appointment.hotel?.region?.name}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {transfer.appointment.pax || 1}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="h-5 w-5 text-blue-600" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Sağ: Rota veya Harita */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">
                  {showMapPreview ? "Rota Haritası" : "Rota Sırası"}
                </h3>
                {selectedTransfers.length > 0 && (
                  <>
                    <Badge variant="secondary" className="text-xs">{selectedTransfers.length} durak</Badge>
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {totalPax} kişi
                    </Badge>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedTransfers.length >= 2 && !showMapPreview && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleOptimizeByLocation}
                  >
                    <Navigation className="h-3.5 w-3.5 mr-1" />
                    Konuma Göre Sırala
                  </Button>
                )}
                {selectedTransfers.length > 0 && (
                  <Button
                    size="sm"
                    variant={showMapPreview ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setShowMapPreview(!showMapPreview)}
                  >
                    <Map className="h-3.5 w-3.5 mr-1" />
                    {showMapPreview ? "Listeye Dön" : "Haritada Önizle"}
                  </Button>
                )}
              </div>
            </div>

            {showMapPreview ? (
              // Harita Önizleme
              <div className="flex-1 overflow-hidden border rounded-lg">
                <RouteMapPreview
                  coordinates={routeCoordinates}
                  spaCoords={ORIENT_SPA_COORDS}
                  mode={mode}
                />
              </div>
            ) : (
              // Rota Listesi
              <div className="flex-1 overflow-y-auto border rounded-lg p-3 bg-slate-50 space-y-2">
                {selectedTransfers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-12">
                    Soldan transfer ekleyin
                  </p>
                ) : (
                  <>
                    {/* Başlangıç noktası */}
                    <div className="flex items-center gap-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        S
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-green-800">Orient SPA</span>
                        <p className="text-xs text-green-600">Başlangıç Noktası</p>
                      </div>
                    </div>

                    {selectedTransfers.map((transfer, index) => {
                      const isRest = transfer.appointment.notes?.includes("REST")
                      return (
                        <div key={transfer.id}>
                          {/* Ok işareti */}
                          <div className="flex justify-center py-1">
                            <ArrowDown className="h-5 w-5 text-slate-400" />
                          </div>

                          <div
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "flex items-center gap-3 p-3 bg-white border rounded-lg cursor-move transition-all",
                              draggedIndex === index && "opacity-50 border-blue-500 shadow-lg"
                            )}
                          >
                            <GripVertical className="h-5 w-5 text-slate-400 flex-shrink-0" />
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-slate-500">
                                  {format(new Date(transfer.appointment.startTime), "HH:mm")}
                                </span>
                                <span className="font-semibold text-sm truncate">
                                  {transfer.appointment.customerName || "Misafir"}
                                </span>
                                {isRest && (
                                  <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5">
                                    REST
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
                                  <Users className="h-3 w-3 mr-0.5" />
                                  {transfer.appointment.pax || 1}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs text-slate-500 truncate">
                                  {transfer.appointment.hotel?.name}
                                </span>
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {transfer.appointment.hotel?.region?.name}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                              >
                                <ArrowDown className="h-4 w-4 rotate-180" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => moveDown(index)}
                                disabled={index === selectedTransfers.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeFromRoute(transfer.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Bitiş noktası */}
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        B
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-red-800">Orient SPA</span>
                        <p className="text-xs text-red-600">Bitiş Noktası</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center gap-4 pt-4 border-t mt-4">
          <div className="flex-1 max-w-xs">
            <label className="text-sm font-medium mb-2 block">Şoför Seç</label>
            <DriverSelector
              drivers={drivers}
              value={selectedDriverId}
              onValueChange={setSelectedDriverId}
              busyDriverIds={busyDriverIds}
              currentDriverId={null}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="px-6">
              İptal
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowMapPreview(true)}
              disabled={selectedTransfers.length === 0}
              className="px-6"
            >
              <Map className="h-4 w-4 mr-2" />
              Rotayı Görüntüle
            </Button>
            <Button
              onClick={handleAssignClick}
              disabled={!selectedDriverId || selectedTransfers.length === 0}
              className="bg-blue-600 hover:bg-blue-700 px-6"
            >
              <Route className="h-4 w-4 mr-2" />
              Rotayı Ata ({selectedTransfers.length} durak)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Onay Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-blue-600" />
              Rota Atama Onayı
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-slate-600" />
                    <span className="font-medium">Şoför:</span>
                    <span className="text-blue-600 font-semibold">{selectedDriver?.user.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-600" />
                    <span className="font-medium">Durak:</span>
                    <span>{selectedTransfers.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-600" />
                    <span className="font-medium">Toplam:</span>
                    <span>{totalPax} kişi</span>
                  </div>
                </div>

                {/* Harita Önizleme */}
                <div className="h-[350px] border rounded-lg overflow-hidden">
                  <RouteMapPreview
                    coordinates={routeCoordinates}
                    spaCoords={ORIENT_SPA_COORDS}
                    mode={mode}
                  />
                </div>

                {/* Durak Listesi */}
                <div className="bg-slate-50 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                  <div className="text-xs font-medium text-slate-600 mb-2">Rota Sırası:</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                      S - Orient SPA
                    </Badge>
                    {selectedTransfers.map((transfer, idx) => (
                      <Badge key={transfer.id} variant="outline" className="bg-blue-50 border-blue-200">
                        {idx + 1}. {transfer.appointment.customerName || "Misafir"} - {transfer.appointment.hotel?.region?.name}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="bg-red-100 border-red-300 text-red-800">
                      B - Orient SPA
                    </Badge>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAssign}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Route className="h-4 w-4 mr-2" />
              Rotayı Onayla ve Ata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
