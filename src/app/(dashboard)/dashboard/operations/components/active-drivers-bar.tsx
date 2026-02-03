"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Car, MapPin, ArrowRight, User, Hotel, Clock, Coffee } from "lucide-react"
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
}

type ActiveDriver = {
  driver: Driver
  activeTransfers: Transfer[]
  status: "PICKING_UP" | "DROPPING_OFF"
}

export function ActiveDriversBar({ transfers, drivers, onStatusChange }: ActiveDriversBarProps) {
  const [openDriverId, setOpenDriverId] = useState<string | null>(null)

  // Yolda olan şoförleri bul (PICKING_UP veya DROPPING_OFF)
  const activeDrivers: ActiveDriver[] = drivers
    .map((driver) => {
      const driverTransfers = transfers.filter(
        (t) =>
          t.driverId === driver.id &&
          (t.status === "PICKING_UP" || t.status === "DROPPING_OFF")
      )

      if (driverTransfers.length === 0) return null

      // Öncelikli durum: PICKING_UP > DROPPING_OFF
      const pickingUp = driverTransfers.filter((t) => t.status === "PICKING_UP")

      return {
        driver,
        activeTransfers: driverTransfers,
        status: pickingUp.length > 0 ? "PICKING_UP" : "DROPPING_OFF",
      } as ActiveDriver
    })
    .filter((d): d is ActiveDriver => d !== null)

  // Boşta olan şoförleri bul (aktif transferi olmayan)
  const busyDriverIds = activeDrivers.map((d) => d.driver.id)
  const idleDrivers = drivers.filter(
    (driver) => driver.isActive && !busyDriverIds.includes(driver.id)
  )

  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between gap-6">
        {/* Sol: Yolda Olan Şoförler */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Car className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-blue-900">Yolda</h3>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0">
              {activeDrivers.length}
            </Badge>
          </div>

          {activeDrivers.length === 0 ? (
            <p className="text-xs text-blue-600">Şu an yolda şoför yok</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeDrivers.map(({ driver, activeTransfers, status }) => (
                <Popover
                  key={driver.id}
                  open={openDriverId === driver.id}
                  onOpenChange={(open) => setOpenDriverId(open ? driver.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-7 py-0 px-2 gap-1.5 text-xs",
                        status === "PICKING_UP"
                          ? "border-blue-300 bg-blue-50 hover:bg-blue-100"
                          : "border-orange-300 bg-orange-50 hover:bg-orange-100"
                      )}
                    >
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full animate-pulse",
                          status === "PICKING_UP" ? "bg-blue-500" : "bg-orange-500"
                        )}
                      />
                      <span className="font-medium">{driver.user.name}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1 py-0 h-4",
                          status === "PICKING_UP"
                            ? "bg-blue-200 text-blue-800"
                            : "bg-orange-200 text-orange-800"
                        )}
                      >
                        {activeTransfers.length}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="start">
                    <div className="p-3 border-b bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          <span className="font-semibold">{driver.user.name}</span>
                        </div>
                        <Badge
                          className={cn(
                            status === "PICKING_UP"
                              ? "bg-blue-500"
                              : "bg-orange-500"
                          )}
                        >
                          {status === "PICKING_UP" ? "Müşteri Alıyor" : "Müşteri Bırakıyor"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tel: {driver.phone}
                      </p>
                    </div>

                    <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                      {activeTransfers.map((transfer) => (
                        <div
                          key={transfer.id}
                          className={cn(
                            "rounded-lg p-3 border",
                            transfer.status === "PICKING_UP"
                              ? "bg-blue-50 border-blue-200"
                              : "bg-orange-50 border-orange-200"
                          )}
                        >
                          {/* Müşteri Bilgisi */}
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-gray-600" />
                            <span className="font-medium">
                              {transfer.appointment.customerName || "Misafir"}
                            </span>
                            {transfer.appointment.pax && (
                              <Badge variant="outline" className="text-xs">
                                {transfer.appointment.pax} kişi
                              </Badge>
                            )}
                          </div>

                          {/* Nereden Nereye */}
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-green-700 truncate">
                              {transfer.status === "PICKING_UP"
                                ? transfer.appointment.hotel?.name || "Otel"
                                : "Orient SPA"}
                            </span>
                            <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <span className="text-red-700 truncate">
                              {transfer.status === "PICKING_UP"
                                ? "Orient SPA"
                                : transfer.appointment.hotel?.name || "Otel"}
                            </span>
                          </div>

                          {/* Otel Bölgesi */}
                          {transfer.appointment.hotel?.region && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                              <Hotel className="h-3 w-3" />
                              <span>{transfer.appointment.hotel.region.name}</span>
                            </div>
                          )}

                          {/* Randevu Saati */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              Randevu: {format(new Date(transfer.appointment.startTime), "HH:mm", { locale: tr })}
                            </span>
                          </div>

                          {/* Hizmet */}
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {transfer.appointment.service.name}
                            </Badge>
                          </div>

                          {/* Bırakıldı Butonu - Sadece DROPPING_OFF durumunda */}
                          {transfer.status === "DROPPING_OFF" && (
                            <Button
                              size="sm"
                              className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs"
                              onClick={() => onStatusChange(transfer.id, "COMPLETED")}
                            >
                              ✓ Bırakıldı
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
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
            <p className="text-xs text-green-600">Tüm şoförler yolda</p>
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
