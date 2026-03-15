"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Car,
  MapPin,
  Clock,
  Users,
  FileText,
  RefreshCw,
  Navigation,
  CheckCircle,
  Banknote
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Transfer {
  id: string
  status: string
  driverId: string | null
  appointment: {
    id: string
    startTime: string
    endTime: string
    pax: number | null
    childCount: number | null
    customerName: string | null
    roomNumber: string | null
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
  }
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Bekliyor", color: "text-gray-700", bg: "bg-gray-100" },
  PICKING_UP: { label: "Alınıyor", color: "text-blue-700", bg: "bg-blue-100" },
  IN_SERVICE: { label: "Hizmette", color: "text-green-700", bg: "bg-green-100" },
  DROPPING_OFF: { label: "Bırakılıyor", color: "text-orange-700", bg: "bg-orange-100" },
  COMPLETED: { label: "Tamamlandı", color: "text-emerald-700", bg: "bg-emerald-100" },
}

const nextStatus: Record<string, string> = {
  PENDING: "PICKING_UP",
  PICKING_UP: "IN_SERVICE",
  IN_SERVICE: "DROPPING_OFF",
  DROPPING_OFF: "COMPLETED",
}

const nextStatusLabel: Record<string, { label: string; icon: string; color: string }> = {
  PENDING: { label: "Almaya Git", icon: "🚗", color: "bg-blue-500 hover:bg-blue-600" },
  PICKING_UP: { label: "Geldi - Hizmet Başladı", icon: "💆", color: "bg-green-500 hover:bg-green-600" },
  IN_SERVICE: { label: "Bırakmaya Git", icon: "🚗", color: "bg-orange-500 hover:bg-orange-600" },
  DROPPING_OFF: { label: "Tamamla", icon: "✅", color: "bg-emerald-500 hover:bg-emerald-600" },
}

export default function DriverPanelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTransfers = useCallback(async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd")
      const res = await fetch(`/api/transfers?date=${today}`)
      if (res.ok) {
        const data = await res.json()
        // Sadece bu şoföre atanmış transferleri filtrele
        const myTransfers = data.filter((t: Transfer) =>
          t.driverId === (session?.user as any)?.driverId
        )
        setTransfers(myTransfers)
      }
    } catch (error) {
      console.error("Transfer fetch error:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session])

  useEffect(() => {
    if (status === "loading") return
    if (!session || (session.user as any)?.role !== "DRIVER") {
      router.push("/login")
      return
    }
    fetchTransfers()
    // Her 30 saniyede yenile
    const interval = setInterval(fetchTransfers, 30000)
    return () => clearInterval(interval)
  }, [session, status, router, fetchTransfers])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchTransfers()
  }

  const handleStatusChange = async (transfer: Transfer) => {
    const next = nextStatus[transfer.status]
    if (!next) return

    try {
      const res = await fetch(`/api/transfers/${transfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })

      if (res.ok) {
        const updated = await res.json()
        setTransfers((prev) =>
          prev.map((t) => (t.id === transfer.id ? updated : t))
        )
        toast.success("Durum güncellendi")
      } else {
        toast.error("Durum güncellenemedi")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  const openNavigation = (transfer: Transfer) => {
    const hotel = transfer.appointment.hotel
    if (!hotel?.lat || !hotel?.lng) {
      toast.error("Otel koordinatları bulunamadı")
      return
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${hotel.lat},${hotel.lng}`
    window.open(url, "_blank")
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-400 mt-4">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Car className="h-6 w-6 text-blue-500" />
              Şoför Paneli
            </h1>
            <p className="text-slate-400 text-sm">
              {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="border-slate-600 text-slate-300"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Transfer List */}
      <div className="p-4 space-y-4 pb-20">
        {transfers.length === 0 ? (
          <div className="text-center py-16">
            <Car className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">Bugün transfer yok</p>
            <p className="text-slate-500 text-sm mt-2">
              Yeni transferler atandığında burada görünecek
            </p>
          </div>
        ) : (
          transfers.map((transfer) => {
            const status = statusConfig[transfer.status]
            const canAdvance = nextStatus[transfer.status]
            const nextAction = nextStatusLabel[transfer.status]
            const isRest = transfer.appointment.notes?.includes("REST")

            return (
              <Card key={transfer.id} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-400" />
                      <span className="text-2xl font-bold text-white">
                        {format(new Date(transfer.appointment.startTime), "HH:mm")}
                      </span>
                      {transfer.appointment.pax && (
                        <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                          <Users className="h-3 w-3 mr-1" />
                          {transfer.appointment.pax}{transfer.appointment.childCount ? `+${transfer.appointment.childCount}` : ""}
                        </Badge>
                      )}
                    </div>
                    <Badge className={cn(status.bg, status.color)}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Customer */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-semibold text-white">
                      {transfer.appointment.customerName || "Misafir"}
                    </span>
                    {isRest && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <Banknote className="h-3 w-3 mr-1" />
                        REST
                      </Badge>
                    )}
                  </div>

                  {/* Hotel */}
                  {transfer.appointment.hotel && (
                    <button
                      onClick={() => openNavigation(transfer)}
                      className="w-full flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg mb-3 hover:bg-slate-700 transition-colors"
                    >
                      <MapPin className="h-5 w-5 text-green-400 flex-shrink-0" />
                      <div className="flex-1 text-left">
                        <p className="text-white font-medium">
                          {transfer.appointment.hotel.name}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {transfer.appointment.hotel.region.name}
                        </p>
                      </div>
                      <Navigation className="h-6 w-6 text-blue-400" />
                    </button>
                  )}

                  {/* Service */}
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                    <span>💆</span>
                    <span>
                      {transfer.appointment.service.name}
                    </span>
                  </div>

                  {/* Room Number */}
                  {transfer.appointment.roomNumber && (
                    <div
                      className="w-full flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg mb-3"
                    >
                      <FileText className="h-5 w-5 text-slate-400" />
                      <span className="text-slate-300 font-medium">
                        Oda: {transfer.appointment.roomNumber}
                      </span>
                    </div>
                  )}

                  {/* Action Button */}
                  {canAdvance && nextAction && (
                    <Button
                      onClick={() => handleStatusChange(transfer)}
                      className={cn("w-full text-white font-bold py-6 text-lg", nextAction.color)}
                    >
                      <span className="mr-2">{nextAction.icon}</span>
                      {nextAction.label}
                    </Button>
                  )}

                  {transfer.status === "COMPLETED" && (
                    <div className="flex items-center justify-center gap-2 text-emerald-400 py-4">
                      <CheckCircle className="h-6 w-6" />
                      <span className="font-medium">Transfer Tamamlandı</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
