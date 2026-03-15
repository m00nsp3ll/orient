"use client"

import { useState } from "react"
import { TransferCard } from "./transfer-card"
import { RoutePlannerModal } from "./route-planner-modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MapPin, Car, Clock, Route, Banknote } from "lucide-react"
import { format } from "date-fns"

interface Transfer {
  id: string
  status: string
  driverId: string | null
  arrivalTime: string | null
  dropoffTime: string | null
  pickupTime: string | null
  departureTime: string | null
  appointment: {
    id: string
    startTime: string
    endTime: string
    pax: number | null
    childCount: number | null
    customerName: string | null
    notes: string | null
    restAmount: number | null
    restCurrency: string | null
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
      code: string
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

interface TransferBoardProps {
  transfers: Transfer[]
  drivers: Driver[]
  onStatusChange: (transferId: string, newStatus: string) => void
  onDriverChange: (transferId: string, driverId: string | null) => void
  onStartDropoff: (transferId: string) => void
  onCancelAppointment?: (appointmentId: string) => void
}

const columns = [
  { key: "PENDING", label: "Bekliyor", color: "bg-gray-100", emptyText: "Transfer yok", groupBy: "region", hasRoute: true },
  { key: "PICKING_UP", label: "Alınıyor", color: "bg-blue-50", emptyText: "Transfer yok", groupBy: "driver", hasRoute: false },
  { key: "IN_SERVICE", label: "Hizmette", color: "bg-green-50", emptyText: "Müşteri yok", groupBy: "none", hasRoute: false },
  { key: "DROPPING_OFF", label: "Transfer Bekliyor", color: "bg-orange-50", emptyText: "Transfer yok", groupBy: "region", hasRoute: true },
]

// Saate göre sırala
function sortByTime(transfers: Transfer[]): Transfer[] {
  return [...transfers].sort((a, b) =>
    new Date(a.appointment.startTime).getTime() - new Date(b.appointment.startTime).getTime()
  )
}

// Bölgeye göre grupla
function groupByRegion(transfers: Transfer[]): Map<string, Transfer[]> {
  const groups = new Map<string, Transfer[]>()

  for (const transfer of transfers) {
    const regionName = transfer.appointment.hotel?.region?.name || "Bölge Belirtilmemiş"
    if (!groups.has(regionName)) {
      groups.set(regionName, [])
    }
    groups.get(regionName)!.push(transfer)
  }

  // Alfabetik sırala
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr')))
}

// Şoföre göre grupla
function groupByDriver(transfers: Transfer[]): Map<string, Transfer[]> {
  const groups = new Map<string, Transfer[]>()

  for (const transfer of transfers) {
    const driverName = transfer.driver?.user?.name || "Şoför Atanmamış"
    if (!groups.has(driverName)) {
      groups.set(driverName, [])
    }
    groups.get(driverName)!.push(transfer)
  }

  // Alfabetik sırala, "Şoför Atanmamış" en sona
  return new Map([...groups.entries()].sort((a, b) => {
    if (a[0] === "Şoför Atanmamış") return 1
    if (b[0] === "Şoför Atanmamış") return -1
    return a[0].localeCompare(b[0], 'tr')
  }))
}

export function TransferBoard({
  transfers,
  drivers,
  onStatusChange,
  onDriverChange,
  onStartDropoff,
  onCancelAppointment,
}: TransferBoardProps) {
  const [sortMode, setSortMode] = useState<Record<string, "region" | "time">>({
    PENDING: "region",
    DROPPING_OFF: "region",
  })
  const [routeModalOpen, setRouteModalOpen] = useState(false)
  const [routeMode, setRouteMode] = useState<"pickup" | "dropoff">("pickup")
  const [showCompletedModal, setShowCompletedModal] = useState(false)

  const getTransfersByStatus = (status: string) => {
    const filtered = transfers.filter((t) => t.status === status)

    // PENDING: Şoför atanmamış olanları göster
    // "Almaya Git" butonu şoför atayıp durumu PENDING'de tutar
    // Ama kolondan kaybolması için şoförü olmayanları gösteriyoruz
    if (status === "PENDING") {
      return filtered.filter((t) => !t.driverId)
    }

    // DROPPING_OFF: Şoför atanmamış olanları göster
    // "Bırakmaya Gönder" butonu şoför atayıp kolondan kaldırır
    if (status === "DROPPING_OFF") {
      return filtered.filter((t) => !t.driverId)
    }

    return filtered
  }

  // Yolda olan şoförlerin ID'lerini bul (PICKING_UP veya DROPPING_OFF - arrivalTime olan)
  // Bu şoförlere yeni atama yapılamaz
  const busyDriverIds = transfers
    .filter((t) =>
      t.status === "PICKING_UP" ||
      (t.status === "DROPPING_OFF" && t.arrivalTime !== null)
    )
    .map((t) => t.driverId)
    .filter((id): id is string => id !== null)

  const handleOpenRouteModal = (mode: "pickup" | "dropoff") => {
    setRouteMode(mode)
    setRouteModalOpen(true)
  }

  const handleAssignRoute = async (transferIds: string[], driverId: string) => {
    // Rota planlayıcıdan atama yapıldığında:
    // - Şoför ataması yapılır
    // - Durum değişmez (PENDING veya DROPPING_OFF kalır)
    // - arrivalTime null kalır (henüz yola çıkmadı)
    // Böylece transferler üst bardaki "Araç Hazırlık" bölümünde toplanır
    for (const transferId of transferIds) {
      await onDriverChange(transferId, driverId)
    }
  }

  const completedTransfers = transfers.filter(t => t.status === "COMPLETED")

  return (
    <div className="space-y-4">
      {/* Tamamlananlar Butonu */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowCompletedModal(true)}
          className="gap-2"
        >
          <Badge variant="secondary">{completedTransfers.length}</Badge>
          Tamamlananlar
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
      {columns.map((column) => {
        const columnTransfers = getTransfersByStatus(column.key)
        const currentSortMode = sortMode[column.key] || column.groupBy

        // Sıralama moduna göre grupla veya sırala
        let groupedByRegion: Map<string, Transfer[]> | null = null
        let groupedByDriver: Map<string, Transfer[]> | null = null
        let sortedByTime: Transfer[] | null = null

        if (column.key === "PENDING" || column.key === "DROPPING_OFF") {
          if (currentSortMode === "region") {
            groupedByRegion = groupByRegion(columnTransfers)
          } else {
            sortedByTime = sortByTime(columnTransfers)
          }
        } else if (column.groupBy === "driver") {
          groupedByDriver = groupByDriver(columnTransfers)
        } else if (column.groupBy === "region") {
          groupedByRegion = groupByRegion(columnTransfers)
        }

        return (
          <div
            key={column.key}
            className={cn(
              "min-w-0 rounded-lg",
              column.color
            )}
          >
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{column.label}</h3>
                <span className="text-xs text-muted-foreground bg-white px-2 py-0.5 rounded-full">
                  {columnTransfers.length}
                </span>
              </div>
              {/* Sıralama ve Rota butonları */}
              {column.hasRoute && columnTransfers.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex rounded-md overflow-hidden border text-[10px]">
                    <button
                      onClick={() => setSortMode({ ...sortMode, [column.key]: "region" })}
                      className={cn(
                        "px-2 py-1 flex items-center gap-0.5",
                        currentSortMode === "region" ? "bg-slate-200" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <MapPin className="h-3 w-3" />
                      Bölge
                    </button>
                    <button
                      onClick={() => setSortMode({ ...sortMode, [column.key]: "time" })}
                      className={cn(
                        "px-2 py-1 flex items-center gap-0.5 border-l",
                        currentSortMode === "time" ? "bg-slate-200" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      Saat
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 ml-auto"
                    onClick={() => handleOpenRouteModal(column.key === "PENDING" ? "pickup" : "dropoff")}
                  >
                    <Route className="h-3 w-3 mr-1" />
                    Rota
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-2">
                {columnTransfers.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    {column.emptyText}
                  </div>
                ) : groupedByRegion ? (
                  // Bölgeye göre gruplandırılmış görünüm
                  Array.from(groupedByRegion.entries()).map(([regionName, regionTransfers]) => (
                    <div key={regionName} className="mb-4">
                      <div className="flex items-center gap-1.5 mb-2 px-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-600" />
                        <span className="text-xs font-bold text-slate-700">{regionName}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
                          {regionTransfers.length}
                        </Badge>
                      </div>
                      <div className="space-y-2 pl-1 border-l-2 border-slate-300">
                        {regionTransfers.map((transfer) => (
                          <TransferCard
                            key={transfer.id}
                            transfer={transfer}
                            drivers={drivers}
                            busyDriverIds={busyDriverIds}
                            onStatusChange={onStatusChange}
                            onDriverChange={onDriverChange}
                            onStartDropoff={onStartDropoff}
                            onCancelAppointment={onCancelAppointment}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : sortedByTime ? (
                  // Saate göre sıralı görünüm
                  sortedByTime.map((transfer) => (
                    <div key={transfer.id} className="mb-2">
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span className="text-[10px] font-medium text-slate-600">
                          {format(new Date(transfer.appointment.startTime), "HH:mm")}
                        </span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {transfer.appointment.hotel?.region?.name}
                        </span>
                      </div>
                      <TransferCard
                        transfer={transfer}
                        drivers={drivers}
                        busyDriverIds={busyDriverIds}
                        onStatusChange={onStatusChange}
                        onDriverChange={onDriverChange}
                        onStartDropoff={onStartDropoff}
                        onCancelAppointment={onCancelAppointment}
                      />
                    </div>
                  ))
                ) : groupedByDriver ? (
                  // Şoföre göre gruplandırılmış görünüm
                  Array.from(groupedByDriver.entries()).map(([driverName, driverTransfers]) => (
                    <div key={driverName} className="mb-4">
                      <div className="flex items-center gap-1.5 mb-2 px-1 py-1 bg-blue-100 rounded">
                        <Car className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-blue-700">{driverName}</span>
                        <Badge className="text-[10px] px-1.5 py-0 h-4 ml-auto bg-blue-500">
                          {driverTransfers.length} müşteri
                        </Badge>
                      </div>
                      <div className="space-y-1 bg-white rounded-lg border shadow-sm overflow-hidden">
                        {driverTransfers.map((transfer, idx) => (
                          <div key={transfer.id} className={cn(idx > 0 && "border-t border-dashed")}>
                            <TransferCard
                              transfer={transfer}
                              drivers={drivers}
                              busyDriverIds={busyDriverIds}
                              onStatusChange={onStatusChange}
                              onDriverChange={onDriverChange}
                              onStartDropoff={onStartDropoff}
                              onCancelAppointment={onCancelAppointment}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  // Normal görünüm
                  columnTransfers.map((transfer) => (
                    <TransferCard
                      key={transfer.id}
                      transfer={transfer}
                      drivers={drivers}
                      busyDriverIds={busyDriverIds}
                      onStatusChange={onStatusChange}
                      onDriverChange={onDriverChange}
                      onStartDropoff={onStartDropoff}
                      onCancelAppointment={onCancelAppointment}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )
      })}

      </div>

      {/* Rota Planlama Modal */}
      <RoutePlannerModal
        open={routeModalOpen}
        onOpenChange={setRouteModalOpen}
        transfers={transfers.filter((t) =>
          routeMode === "pickup" ? t.status === "PENDING" : t.status === "DROPPING_OFF"
        )}
        drivers={drivers}
        busyDriverIds={busyDriverIds}
        mode={routeMode}
        onAssignRoute={handleAssignRoute}
      />

      {/* Tamamlananlar Modal */}
      <Dialog open={showCompletedModal} onOpenChange={setShowCompletedModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary">{completedTransfers.length}</Badge>
              Tamamlanan Transferler
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-3 p-4">
              {completedTransfers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Henüz tamamlanan transfer yok
                </div>
              ) : (
                completedTransfers.map((transfer) => (
                  <div key={transfer.id} className="bg-white rounded-lg border shadow-sm p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Sol Kolon */}
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Acenta</div>
                          <div className="font-semibold text-base">
                            {transfer.appointment.agency?.name || "Direkt Rezervasyon"}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Müşteri</div>
                          <div className="font-medium text-sm">
                            {transfer.appointment.customerName || "Misafir"}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Otel</div>
                          <div className="font-medium text-sm">
                            {transfer.appointment.hotel?.name || "Otel belirtilmedi"}
                          </div>
                          {transfer.appointment.hotel?.region && (
                            <div className="text-xs text-gray-500">
                              {transfer.appointment.hotel.region.name}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Paket</div>
                          <Badge variant="outline" className="text-sm">
                            {transfer.appointment.service.name}
                          </Badge>
                        </div>
                      </div>

                      {/* Sağ Kolon */}
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Acenta</div>
                          <div className="font-medium text-sm">
                            {transfer.appointment.agency?.name || "Direkt Rezervasyon"}
                          </div>
                          {transfer.appointment.agency?.code && (
                            <div className="text-xs text-gray-500">
                              {transfer.appointment.agency.code}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Randevu Saati</div>
                          <div className="font-medium text-sm">
                            {format(new Date(transfer.appointment.startTime), "HH:mm")}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Bırakılış Saati</div>
                          <div className="font-medium text-sm">
                            {transfer.dropoffTime
                              ? format(new Date(transfer.dropoffTime), "HH:mm")
                              : "-"}
                          </div>
                        </div>

                        {transfer.appointment.pax && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Kişi Sayısı</div>
                            <Badge variant="secondary">
                              {transfer.appointment.pax}{transfer.appointment.childCount ? `+${transfer.appointment.childCount}` : ""} kişi
                            </Badge>
                          </div>
                        )}

                        {transfer.appointment.notes?.includes("REST") && (
                          <div>
                            <Badge className="bg-red-500 text-white">
                              <Banknote className="h-3 w-3 mr-1" />
                              REST - Ödeme Kapıda
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
