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
  Car,
  Copy,
  Check,
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
    childCount: number | null
    customerName: string | null
    notes: string | null
    service: {
      id: string
      name: string
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
    agency: {
      id: string
      name: string
      companyName?: string | null
      code?: string
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

// Batı rotası: en uzaktan Orient SPA'ya doğru (alış sırası)
const WEST_ROUTE_ORDER = [
  "Çenger", "Okurcalar", "İncekum", "Avsallar", "Türkler", "Payallar", "Konaklı",
]

// Doğu rotası: en uzaktan Orient SPA'ya doğru (alış sırası)
const EAST_ROUTE_ORDER = [
  "Kargıcak", "Mahmutlar", "Kestel", "Tosmur", "Oba",
  "Atatürk Anıtı", "Damlataş", "Kleopatra",
]

// Cikcilli → Tosmur ile aynı sırada
const REGION_ALIASES: Record<string, string> = {
  "Cikcilli": "Tosmur",
  "Alanya Merkez": "Kleopatra",
}

// Bölgenin hangi rotada olduğunu ve sırasını bul
function getRouteInfo(regionName: string): { route: "west" | "east" | "unknown"; order: number } {
  const resolved = REGION_ALIASES[regionName] || regionName

  const westIdx = WEST_ROUTE_ORDER.indexOf(resolved)
  if (westIdx !== -1) return { route: "west", order: westIdx }

  const eastIdx = EAST_ROUTE_ORDER.indexOf(resolved)
  if (eastIdx !== -1) return { route: "east", order: eastIdx }

  return { route: "unknown", order: 999 }
}

// Rota optimizasyonu: alış → uzaktan yakına, bırakış → yakından uzağa
function optimizeRouteByLocation(transfers: Transfer[], mode: "pickup" | "dropoff"): Transfer[] {
  if (transfers.length <= 1) return transfers

  // Bölge bilgisine göre transferleri grupla
  const withInfo = transfers.map(t => {
    const regionName = t.appointment.hotel?.region?.name || "Alanya Merkez"
    const info = getRouteInfo(regionName)
    return { transfer: t, ...info }
  })

  // Batı ve doğu rotalarını ayır
  const west = withInfo.filter(t => t.route === "west")
  const east = withInfo.filter(t => t.route === "east")
  const unknown = withInfo.filter(t => t.route === "unknown")

  // Alış: uzaktan yakına (index 0 en uzak → düz sıra)
  // Bırakış: yakından uzağa (ters sıra)
  const sortFn = mode === "pickup"
    ? (a: { order: number }, b: { order: number }) => a.order - b.order
    : (a: { order: number }, b: { order: number }) => b.order - a.order

  west.sort(sortFn)
  east.sort(sortFn)

  // Batı ve doğuyu birleştir: hangi grupta daha fazla transfer varsa onu önce koy
  const sorted = west.length >= east.length
    ? [...west, ...east, ...unknown]
    : [...east, ...west, ...unknown]

  return sorted.map(t => t.transfer)
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
  const [showWhatsappDialog, setShowWhatsappDialog] = useState(false)
  const [whatsappText, setWhatsappText] = useState("")
  const [copied, setCopied] = useState(false)

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
    const optimized = optimizeRouteByLocation(selectedTransfers, mode)
    setSelectedTransfers(optimized)
    toast.success(
      mode === "pickup"
        ? "Rota sıralandı: en uzaktan yakına (alış)"
        : "Rota sıralandı: en yakından uzağa (bırakış)"
    )
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

    // WhatsApp kopyalama metni oluştur
    const driverName = selectedDriver?.user.name || "Şoför"
    const lines = selectedTransfers.map((t, idx) => {
      const time = format(new Date(t.appointment.startTime), "HH:mm")
      const hotel = t.appointment.hotel?.name || "-"
      const name = t.appointment.customerName || "Misafir"
      const pax = (t.appointment.pax || 1) + (t.appointment.childCount || 0)
      const agency = t.appointment.agency ? (t.appointment.agency.companyName || t.appointment.agency.name) : "-"
      return `${idx + 1}. ${time} | ${hotel} | ${name} | ${pax} kişi | ${agency}`
    })
    const text = `🚐 ${driverName}\n\n${lines.join("\n")}`
    setWhatsappText(text)
    setCopied(false)

    onAssignRoute(
      selectedTransfers.map((t) => t.id),
      selectedDriverId
    )

    setShowConfirmDialog(false)
    setShowWhatsappDialog(true)
  }

  const handleWhatsappClose = () => {
    setShowWhatsappDialog(false)
    setSelectedTransfers([])
    setSelectedDriverId(null)
    setShowMapPreview(false)
    onOpenChange(false)
  }

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(whatsappText)
    setCopied(true)
    toast.success("Kopyalandı!")
    setTimeout(() => setCopied(false), 2000)
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
        className="!w-[96vw] !h-[94vh] !max-w-[1800px] !max-h-[95vh] !m-0 !p-4 md:!p-6 !rounded-lg !top-[50%] !left-[50%] !-translate-x-1/2 !-translate-y-1/2 overflow-hidden flex flex-col"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Route className="h-5 w-5" />
            {mode === "pickup" ? "Alış Rotası Oluştur" : "Bırakış Rotası Oluştur"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 overflow-hidden md:min-h-[500px]">
          {/* Sol: Mevcut Transferler */}
          <div className="flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <h3 className="font-semibold text-sm">Mevcut Transferler</h3>
              <Badge variant="secondary" className="text-xs">{sortedAvailable.length} transfer</Badge>
            </div>
            <div className="flex-1 overflow-y-auto border rounded-lg p-2 md:p-3 bg-gray-50 space-y-2">
              {sortedAvailable.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8 md:py-12">
                  Tüm transferler rotaya eklendi
                </p>
              ) : (
                sortedAvailable.map((transfer) => {
                  const isRest = transfer.appointment.notes?.includes("REST")
                  return (
                    <div
                      key={transfer.id}
                      className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-white border rounded-lg hover:bg-blue-50 cursor-pointer group transition-colors"
                      onClick={() => addToRoute(transfer)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-1.5 md:px-2 py-0.5 rounded shrink-0">
                            <Clock className="h-3 w-3" />
                            {format(new Date(transfer.appointment.startTime), "HH:mm")}
                          </span>
                          <span className="font-semibold text-sm break-words leading-tight">
                            {transfer.appointment.hotel?.name || "Otel"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                            {transfer.appointment.hotel?.region?.name}
                          </Badge>
                          {isRest && (
                            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5 shrink-0">
                              <Banknote className="h-3 w-3 mr-0.5" />
                              REST
                            </Badge>
                          )}
                          <span className="text-xs text-slate-500 truncate">
                            {transfer.appointment.customerName || "Misafir"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-0.5" />
                          {transfer.appointment.pax || 1}{transfer.appointment.childCount ? `+${transfer.appointment.childCount}` : ""}
                        </Badge>
                        <Plus className="h-4 w-4 text-blue-600 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Sağ: Rota veya Harita */}
          <div className="flex flex-col overflow-hidden min-h-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 md:mb-3 gap-2">
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
                    <span className="hidden md:inline">Konuma Göre Sırala</span>
                    <span className="md:hidden">Sırala</span>
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
                    {showMapPreview ? "Liste" : "Harita"}
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
                              "flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-white border rounded-lg cursor-move transition-all",
                              draggedIndex === index && "opacity-50 border-blue-500 shadow-lg"
                            )}
                          >
                            <GripVertical className="h-4 w-4 text-slate-400 flex-shrink-0 hidden md:block" />
                            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-1.5 md:px-2 py-0.5 rounded shrink-0">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(transfer.appointment.startTime), "HH:mm")}
                                </span>
                                <span className="font-semibold text-sm break-words leading-tight">
                                  {transfer.appointment.hotel?.name || "Otel"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                  {transfer.appointment.hotel?.region?.name}
                                </Badge>
                                {isRest && (
                                  <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5">
                                    REST
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
                                  <Users className="h-3 w-3 mr-0.5" />
                                  {transfer.appointment.pax || 1}{transfer.appointment.childCount ? `+${transfer.appointment.childCount}` : ""}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs text-slate-500 truncate">
                                  {transfer.appointment.customerName || "Misafir"}
                                </span>
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

        <DialogFooter className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 pt-4 border-t mt-4">
          <div className="flex-1 md:max-w-xs">
            <label className="text-sm font-medium mb-1 md:mb-2 block">Şoför Seç</label>
            <DriverSelector
              drivers={drivers}
              value={selectedDriverId}
              onValueChange={setSelectedDriverId}
              busyDriverIds={busyDriverIds}
              currentDriverId={null}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <Button variant="outline" onClick={handleClose} className="px-4 md:px-6 flex-1 md:flex-none">
              İptal
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowMapPreview(true)}
              disabled={selectedTransfers.length === 0}
              className="px-4 md:px-6 hidden md:flex"
            >
              <Map className="h-4 w-4 mr-2" />
              Rotayı Görüntüle
            </Button>
            <Button
              onClick={handleAssignClick}
              disabled={!selectedDriverId || selectedTransfers.length === 0}
              className="bg-blue-600 hover:bg-blue-700 px-4 md:px-6 flex-1 md:flex-none"
            >
              <Route className="h-4 w-4 mr-2" />
              Rotayı Ata ({selectedTransfers.length})
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

      {/* WhatsApp Kopyalama Dialog */}
      <Dialog open={showWhatsappDialog} onOpenChange={(v) => { if (!v) handleWhatsappClose() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Copy className="h-4 w-4 text-green-600" />
              Şoför Bilgi Listesi
            </DialogTitle>
          </DialogHeader>
          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap select-all">
            {whatsappText}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleWhatsappClose}>
              Kapat
            </Button>
            <Button onClick={handleCopyText} className="bg-green-600 hover:bg-green-700 gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Kopyalandı!" : "Kopyala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
