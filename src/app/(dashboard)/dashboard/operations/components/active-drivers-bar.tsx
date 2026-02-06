"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Car, MapPin, ArrowRight, User, Hotel, Clock, Coffee, Send, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"

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

interface ActiveDriversBarProps {
  transfers: Transfer[]
  drivers: Driver[]
  onStatusChange: (transferId: string, newStatus: string) => void
  onDriverChange: (transferId: string, driverId: string | null) => void
  onStartRoute: (driverTransfers: Transfer[]) => void
}

type DriverGroup = {
  driver: Driver
  pickupTransfers: Transfer[]
  dropoffTransfers: Transfer[]
  onRoute: boolean
}

export function ActiveDriversBar({
  transfers,
  drivers,
  onStatusChange,
  onDriverChange,
  onStartRoute
}: ActiveDriversBarProps) {
  const [openDriverId, setOpenDriverId] = useState<string | null>(null)

  // Şoför gruplarını oluştur
  const driverGroups: DriverGroup[] = drivers
    .map((driver) => {
      // Alınacak müşteriler (PENDING + şoför atanmış + arrivalTime null)
      const pickupTransfers = transfers.filter(
        (t) => t.driverId === driver.id && t.status === "PENDING" && !t.arrivalTime
      )

      // Bırakılacak müşteriler (DROPPING_OFF + şoför atanmış + arrivalTime null)
      const dropoffTransfers = transfers.filter(
        (t) => t.driverId === driver.id && t.status === "DROPPING_OFF" && !t.arrivalTime
      )

      // Yolda olan transferler (arrivalTime var)
      const onRoutePickups = transfers.filter(
        (t) => t.driverId === driver.id && t.status === "PICKING_UP" && t.arrivalTime
      )
      const onRouteDropoffs = transfers.filter(
        (t) => t.driverId === driver.id && t.status === "DROPPING_OFF" && t.arrivalTime
      )

      const hasTransfers = pickupTransfers.length > 0 || dropoffTransfers.length > 0
      const onRoute = onRoutePickups.length > 0 || onRouteDropoffs.length > 0

      if (!hasTransfers && !onRoute) return null

      return {
        driver,
        pickupTransfers,
        dropoffTransfers,
        onRoute,
      } as DriverGroup
    })
    .filter((g): g is DriverGroup => g !== null)

  // Yolda olan şoförleri bul
  const onRouteDrivers = transfers
    .filter((t) =>
      (t.status === "PICKING_UP" || t.status === "DROPPING_OFF") &&
      t.arrivalTime !== null &&
      t.driverId !== null
    )
    .reduce((acc, transfer) => {
      const driverId = transfer.driverId!
      if (!acc.has(driverId)) {
        const driver = drivers.find(d => d.id === driverId)
        if (driver) {
          acc.set(driverId, {
            driver,
            transfers: [],
          })
        }
      }
      acc.get(driverId)?.transfers.push(transfer)
      return acc
    }, new Map<string, { driver: Driver; transfers: Transfer[] }>())

  // Boşta olan şoförler
  const busyDriverIds = new Set([
    ...driverGroups.map(g => g.driver.id),
    ...Array.from(onRouteDrivers.keys())
  ])
  const idleDrivers = drivers.filter(
    (driver) => driver.isActive && !busyDriverIds.has(driver.id)
  )

  const handleSendDriver = (driverGroup: DriverGroup) => {
    const allTransfers = [...driverGroup.pickupTransfers, ...driverGroup.dropoffTransfers]
    onStartRoute(allTransfers)
  }

  const handleRemoveTransfer = (transferId: string) => {
    onDriverChange(transferId, null)
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between gap-6">
        {/* Sol: Araç Hazırlık - Şoför Bazlı Gruplar */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Car className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-blue-900">Araç Hazırlık</h3>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0">
              {driverGroups.length}
            </Badge>
          </div>

          {driverGroups.length === 0 ? (
            <p className="text-xs text-blue-600">Hazırlanan araç yok</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {driverGroups.filter(g => !g.onRoute).map(({ driver, pickupTransfers, dropoffTransfers }) => {
                const totalPax = [...pickupTransfers, ...dropoffTransfers].reduce(
                  (sum, t) => sum + (t.appointment.pax || 0), 0
                )

                return (
                <Popover
                  key={driver.id}
                  open={openDriverId === driver.id}
                  onOpenChange={(open) => setOpenDriverId(open ? driver.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-1.5 px-2 flex-col items-start gap-1 border-blue-300 bg-white hover:bg-blue-50"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <Car className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-medium text-xs">{driver.user.name}</span>
                        <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[9px] px-1 py-0 h-3.5 ml-auto">
                          {totalPax} PAX
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        {pickupTransfers.length > 0 && (
                          <Badge className="bg-blue-500 text-white text-[9px] px-1 py-0 h-3.5">
                            Alınış: {pickupTransfers.length}
                          </Badge>
                        )}
                        {dropoffTransfers.length > 0 && (
                          <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0 h-3.5">
                            Bırakılış: {dropoffTransfers.length}
                          </Badge>
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="start">
                    <div className="p-3 border-b bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          <span className="font-semibold">{driver.user.name}</span>
                        </div>
                        <Badge className="bg-blue-500">Hazırlanıyor</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tel: {driver.phone}
                      </p>
                    </div>

                    <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                      {/* Alınacak Müşteriler */}
                      {pickupTransfers.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-blue-700 mb-2">Alınacaklar</h4>
                          {pickupTransfers.map((transfer) => (
                            <div
                              key={transfer.id}
                              className="rounded-lg p-2 border bg-blue-50 border-blue-200 mb-2"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">
                                  {transfer.appointment.customerName || "Misafir"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 hover:bg-red-100"
                                  onClick={() => handleRemoveTransfer(transfer.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transfer.appointment.hotel?.name} • {format(new Date(transfer.appointment.startTime), "HH:mm")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bırakılacak Müşteriler */}
                      {dropoffTransfers.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-orange-700 mb-2">Bırakılacaklar</h4>
                          {dropoffTransfers.map((transfer) => (
                            <div
                              key={transfer.id}
                              className="rounded-lg p-2 border bg-orange-50 border-orange-200 mb-2"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">
                                  {transfer.appointment.customerName || "Misafir"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 hover:bg-red-100"
                                  onClick={() => handleRemoveTransfer(transfer.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transfer.appointment.hotel?.name} • {format(new Date(transfer.appointment.startTime), "HH:mm")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t bg-muted/30">
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          handleSendDriver({ driver, pickupTransfers, dropoffTransfers, onRoute: false })
                          setOpenDriverId(null)
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Aracı Gönder ({pickupTransfers.length + dropoffTransfers.length} Müşteri)
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                )
              })}
            </div>
          )}
        </div>

        {/* Orta: Yolda Olan Şoförler */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-purple-600" />
            <h3 className="font-semibold text-sm text-purple-900">Yolda</h3>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0">
              {onRouteDrivers.size}
            </Badge>
          </div>

          {onRouteDrivers.size === 0 ? (
            <p className="text-xs text-purple-600">Yolda şoför yok</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(onRouteDrivers.values()).map(({ driver, transfers: driverTransfers }) => {
                const pickupTransfers = driverTransfers.filter(t => t.status === "PICKING_UP")
                const dropoffTransfers = driverTransfers.filter(t => t.status === "DROPPING_OFF")
                const totalPax = driverTransfers.reduce((sum, t) => sum + (t.appointment.pax || 0), 0)

                return (
                  <Popover key={driver.id}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-7 py-0 px-2 gap-1.5 text-xs",
                          pickupTransfers.length > 0
                            ? "border-blue-300 bg-blue-50 hover:bg-blue-100"
                            : "border-orange-300 bg-orange-50 hover:bg-orange-100"
                        )}
                      >
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            pickupTransfers.length > 0 ? "bg-blue-500" : "bg-orange-500"
                          )}
                        />
                        <span className="font-medium">{driver.user.name}</span>

                        {/* Hem alınış hem bırakılış varsa ikisini de göster */}
                        {pickupTransfers.length > 0 && dropoffTransfers.length > 0 ? (
                          <div className="flex items-center gap-0.5">
                            <Badge className="bg-blue-500 text-white text-[9px] px-1 py-0 h-3.5">
                              A:{pickupTransfers.length}
                            </Badge>
                            <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0 h-3.5">
                              B:{dropoffTransfers.length}
                            </Badge>
                          </div>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-medium",
                            pickupTransfers.length > 0 ? "text-blue-700" : "text-orange-700"
                          )}>
                            {pickupTransfers.length > 0 ? "Alınış" : "Bırakılış"}
                          </span>
                        )}

                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1 py-0 h-4",
                            pickupTransfers.length > 0
                              ? "bg-blue-200 text-blue-800"
                              : "bg-orange-200 text-orange-800"
                          )}
                        >
                          {totalPax} PAX
                        </Badge>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-3">
                      <div className="space-y-3">
                        {/* Alınış İşlemleri */}
                        {pickupTransfers.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Alınacaklar ({pickupTransfers.length})
                            </h4>
                            <div className="space-y-2">
                              {pickupTransfers.map((transfer) => (
                                <div key={transfer.id} className="p-2 border rounded bg-blue-50 border-blue-200">
                                  <div className="font-medium text-sm">
                                    {transfer.appointment.customerName || "Misafir"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {transfer.appointment.hotel?.name}
                                    {transfer.appointment.pax && ` • ${transfer.appointment.pax} kişi`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bırakılış İşlemleri */}
                        {dropoffTransfers.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                              Bırakılacaklar ({dropoffTransfers.length})
                            </h4>
                            <div className="space-y-2">
                              {dropoffTransfers.map((transfer) => (
                                <div key={transfer.id} className="p-2 border rounded bg-orange-50 border-orange-200">
                                  <div className="font-medium text-sm">
                                    {transfer.appointment.customerName || "Misafir"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {transfer.appointment.hotel?.name}
                                    {transfer.appointment.pax && ` • ${transfer.appointment.pax} kişi`}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs"
                                    onClick={() => onStatusChange(transfer.id, "COMPLETED")}
                                  >
                                    ✓ Bırakıldı
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              })}
            </div>
          )}
        </div>

        {/* Sağ: Boşta Olan Şoförler */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm text-green-900">Boşta</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-1.5 py-0">
              {idleDrivers.length}
            </Badge>
          </div>

          {idleDrivers.length === 0 ? (
            <p className="text-xs text-green-600">Tüm şoförler meşgul</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {idleDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-1.5 py-1 px-2 bg-white border border-green-200 rounded text-xs"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="font-medium">{driver.user.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
