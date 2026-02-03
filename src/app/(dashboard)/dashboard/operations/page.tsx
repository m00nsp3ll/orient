"use client"

import { useState, useEffect, useCallback } from "react"
import { TransferBoard } from "./components/transfer-board"
import { ActiveDriversBar } from "./components/active-drivers-bar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Transfer {
  id: string
  status: string
  driverId: string | null
  arrivalTime: string | null
  dropoffTime: string | null
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

export default function OperationsPage() {
  const [date, setDate] = useState<Date>(new Date())
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const dateStr = format(date, "yyyy-MM-dd")
      const [transfersRes, driversRes] = await Promise.all([
        fetch(`/api/transfers?date=${dateStr}`),
        fetch("/api/drivers"),
      ])

      console.log("Transfers response:", transfersRes.status)
      console.log("Drivers response:", driversRes.status)

      if (transfersRes.ok) {
        const transfersData = await transfersRes.json()
        console.log("Transfers data:", transfersData)
        setTransfers(transfersData)
      } else {
        const error = await transfersRes.json()
        console.error("Transfers error:", error)
      }

      if (driversRes.ok) {
        const driversData = await driversRes.json()
        console.log("Drivers data:", driversData)
        setDrivers(driversData)
      } else {
        const error = await driversRes.json()
        console.error("Drivers error:", error)
      }
    } catch (error) {
      console.error("Veri yüklenirken hata:", error)
      toast.error("Veriler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleStatusChange = async (transferId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const updatedTransfer = await res.json()
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? updatedTransfer : t))
        )
        toast.success("Durum güncellendi")
      } else {
        toast.error("Durum güncellenemedi")
      }
    } catch (error) {
      console.error("Durum güncelleme hatası:", error)
      toast.error("Durum güncellenemedi")
    }
  }

  const handleDriverChange = async (transferId: string, driverId: string | null) => {
    try {
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      })

      if (res.ok) {
        const updatedTransfer = await res.json()
        setTransfers((prev) =>
          prev.map((t) => (t.id === transferId ? updatedTransfer : t))
        )
        toast.success("Şoför atandı")
      } else {
        toast.error("Şoför atanamadı")
      }
    } catch (error) {
      console.error("Şoför atama hatası:", error)
      toast.error("Şoför atanamadı")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operasyon Paneli</h1>
          <p className="text-muted-foreground">
            Günlük transfer takibi ve şoför yönetimi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "d MMMM yyyy", { locale: tr }) : "Tarih seç"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                locale={tr}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Yolda Olan Şoförler */}
      {!loading && transfers.length > 0 && (
        <ActiveDriversBar transfers={transfers} drivers={drivers} onStatusChange={handleStatusChange} />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
          <p className="text-lg">Bu tarihte transfer bulunmuyor</p>
          <p className="text-sm">Randevular oluşturulduğunda transferler otomatik eklenir</p>
        </div>
      ) : (
        <TransferBoard
          transfers={transfers}
          drivers={drivers}
          onStatusChange={handleStatusChange}
          onDriverChange={handleDriverChange}
        />
      )}
    </div>
  )
}
