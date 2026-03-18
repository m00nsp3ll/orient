"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { CountdownTimer } from "./countdown-timer"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Car,
  Banknote,
  MoreHorizontal,
  AlertTriangle,
  Send
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
    restAmount: number | null
    restCurrency: string | null
    service: {
      id: string
      name: string
    }
    hotel: {
      id: string
      name: string
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

interface TransferCardProps {
  transfer: Transfer
  drivers: Driver[]
  busyDriverIds: string[]
  onStatusChange: (transferId: string, newStatus: string) => void
  onDriverChange: (transferId: string, driverId: string | null) => void
  onStartDropoff?: (transferId: string) => void
  onCancelAppointment?: (appointmentId: string) => void
}

const statusFlow: Record<string, string> = {
  PENDING: "PICKING_UP",
  PICKING_UP: "IN_SERVICE",
  IN_SERVICE: "DROPPING_OFF",
  DROPPING_OFF: "COMPLETED",
}

const nextStatusLabels: Record<string, string> = {
  PENDING: "Almaya Git",
  PICKING_UP: "Geldi",
  IN_SERVICE: "Hizmeti Bitir",
  DROPPING_OFF: "Bırakmaya Gönder",
}

const nextStatusColors: Record<string, string> = {
  PENDING: "bg-blue-500 hover:bg-blue-600 text-white",
  PICKING_UP: "bg-green-500 hover:bg-green-600 text-white",
  IN_SERVICE: "bg-orange-500 hover:bg-orange-600 text-white",
  DROPPING_OFF: "bg-emerald-500 hover:bg-emerald-600 text-white",
}

export function TransferCard({
  transfer,
  drivers,
  busyDriverIds,
  onStatusChange,
  onDriverChange,
  onStartDropoff,
  onCancelAppointment,
}: TransferCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showRestWarning, setShowRestWarning] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [restWarningAction, setRestWarningAction] = useState<"complete" | "dropoff">("complete")
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(transfer.driverId)

  const { appointment } = transfer
  const isRest = appointment.notes?.includes("REST")
  const restLabel = isRest && appointment.restAmount && appointment.restCurrency
    ? `${appointment.restAmount} ${appointment.restCurrency}`
    : null
  const nextStatus = statusFlow[transfer.status]
  const canAdvance = nextStatus && transfer.status !== "COMPLETED" && transfer.status !== "CANCELLED"

  const handleStatusChange = () => {
    // PENDING -> "Almaya Git" sadece şoför ata
    if (transfer.status === "PENDING") {
      if (!selectedDriverId) {
        toast.error("Lütfen önce şoför seçin!")
        return
      }
      onDriverChange(transfer.id, selectedDriverId)
      return
    }

    // DROPPING_OFF -> "Bırakmaya Gönder" - REST ise önce uyarı, sonra şoför ata
    if (transfer.status === "DROPPING_OFF") {
      if (!selectedDriverId) {
        toast.error("Lütfen önce şoför seçin!")
        return
      }
      if (isRest) {
        setRestWarningAction("dropoff")
        setShowRestWarning(true)
      } else {
        onDriverChange(transfer.id, selectedDriverId)
      }
      return
    }

    // REST uyarısı: IN_SERVICE -> DROPPING_OFF (Hizmeti Bitir)
    if (isRest && transfer.status === "IN_SERVICE") {
      setRestWarningAction("complete")
      setShowRestWarning(true)
    } else {
      onStatusChange(transfer.id, nextStatus)
    }
  }

  const handleRestConfirm = () => {
    setShowRestWarning(false)
    if (restWarningAction === "dropoff") {
      onDriverChange(transfer.id, selectedDriverId)
    } else {
      onStatusChange(transfer.id, nextStatus)
    }
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm mb-2 overflow-hidden">
      {/* Header - Saat ve PAX */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-slate-500" />
          <span className="font-semibold text-xs">
            {format(new Date(appointment.startTime), "HH:mm")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isRest && (
            <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 h-4 flex items-center gap-0.5">
              <Banknote className="h-2.5 w-2.5" />
              {restLabel ? `REST ${restLabel}` : "REST"}
            </Badge>
          )}
          {appointment.pax && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
              <Users className="h-2.5 w-2.5 mr-0.5" />
              {appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-2">
        {/* Otel / Müşteri Adı */}
        <Popover open={showDetails} onOpenChange={setShowDetails}>
          <PopoverTrigger asChild>
            <button className="w-full text-left group">
              <div className="font-semibold text-sm truncate group-hover:text-blue-600 transition-colors">
                {appointment.hotel?.name || "Otel"}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {appointment.customerName || "Misafir"}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-3 border-b bg-slate-50">
              <div className="font-semibold">{appointment.customerName || "Misafir"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(appointment.startTime), "d MMMM yyyy, HH:mm", { locale: tr })}
              </div>
            </div>
            <div className="p-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">{appointment.hotel?.name || "Otel belirtilmedi"}</div>
                  {appointment.hotel?.region && (
                    <div className="text-xs text-muted-foreground">{appointment.hotel.region.name}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.service.name}</span>
              </div>
              {appointment.pax && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""} kişi</span>
                </div>
              )}
              {transfer.driver && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span>{transfer.driver.user.name}</span>
                </div>
              )}
              {appointment.notes && (
                <div className="bg-muted/50 p-2 rounded text-xs mt-2">
                  {appointment.notes}
                </div>
              )}
              {/* İptal Butonu */}
              {onCancelAppointment && transfer.status !== "COMPLETED" && transfer.status !== "CANCELLED" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full mt-2 gap-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDetails(false)
                    setShowCancelConfirm(true)
                  }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Randevuyu İptal Et
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Bölge */}
        {appointment.hotel?.region && (
          <div className="mt-1.5">
            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-orange-200">
              <MapPin className="h-2.5 w-2.5" />
              {appointment.hotel.region.name}
            </span>
          </div>
        )}

        {/* Program Adı - Hizmette durumunda göster */}
        {transfer.status === "IN_SERVICE" && (
          <div className="mt-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-white">
              {appointment.service.name}
            </Badge>
          </div>
        )}

        {/* Hizmet Süresi Sayacı */}
        {transfer.status === "IN_SERVICE" && transfer.arrivalTime && (
          <div className="mt-2">
            <CountdownTimer
              startTime={new Date(transfer.arrivalTime)}
              duration={60}
            />
          </div>
        )}

        {/* Şoför Seçici - Sadece PENDING ve DROPPING_OFF durumlarında göster */}
        {(transfer.status === "PENDING" || transfer.status === "DROPPING_OFF") && !transfer.driverId && (
          <div className="mt-2">
            <DriverSelector
              drivers={drivers}
              value={selectedDriverId}
              onValueChange={(driverId) => setSelectedDriverId(driverId)}
              disabled={false}
              busyDriverIds={busyDriverIds}
              currentDriverId={selectedDriverId}
              compact
            />
          </div>
        )}

        {/* Şoför seçildiyse göster (local state) */}
        {(transfer.status === "PENDING" || transfer.status === "DROPPING_OFF") && !transfer.driverId && selectedDriverId && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
            <Car className="h-3 w-3 text-blue-600" />
            <span className="font-medium">{drivers.find(d => d.id === selectedDriverId)?.user.name}</span>
          </div>
        )}

        {/* PICKING_UP'da atanmış şoförü göster (değiştirilemez) */}
        {transfer.status === "PICKING_UP" && transfer.driver && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 bg-blue-50 px-2 py-1 rounded">
            <Car className="h-3 w-3" />
            <span className="font-medium">{transfer.driver.user.name}</span>
          </div>
        )}

        {/* Aksiyon Butonu */}
        {canAdvance && (
          <Button
            size="sm"
            className={cn(
              "w-full mt-2 h-7 text-xs font-medium",
              nextStatusColors[transfer.status]
            )}
            onClick={handleStatusChange}
          >
            {nextStatusLabels[transfer.status]}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>

      <AlertDialog open={showRestWarning} onOpenChange={setShowRestWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {restWarningAction === "dropoff" ? "Bırakmadan Önce Ödeme Kontrolü" : "Ödeme Hatırlatması"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="text-base font-medium text-foreground">
                Bu müşteri REST (Ödeme Kapıda) müşterisidir!
              </p>
              <p>
                <strong>{appointment.customerName || "Misafir"}</strong> - {appointment.service.name}
              </p>
              {restLabel && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                  <Banknote className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-xs text-red-500 font-medium">Tahsil Edilecek Tutar</p>
                    <p className="text-lg font-bold text-red-700">{restLabel}</p>
                  </div>
                </div>
              )}
              <p className="text-orange-600 font-medium">
                {restWarningAction === "dropoff"
                  ? "Müşteriyi bırakmadan önce ödemenin alındığından emin olun."
                  : "Lütfen ödemenin alındığından emin olun."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestConfirm}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Banknote className="h-4 w-4 mr-2" />
              Ödeme Alındı, Devam Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Appointment Confirm */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevuyu İptal Et</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{appointment.customerName || "Misafir"}</strong> randevusunu iptal etmek istediğinizden emin misiniz?
              {appointment.agency && (
                <span className="block mt-2 text-amber-700 font-medium">
                  Acenta carisi otomatik olarak güncellenecektir.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => onCancelAppointment?.(appointment.id)}
            >
              Evet, İptal Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
