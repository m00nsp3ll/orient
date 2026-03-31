"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from "date-fns"
import { tr } from "date-fns/locale"
import { Plus, Building2, CalendarDays, Calendar as CalendarIcon, Banknote, Users, XCircle, BarChart3, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar"
import { AppointmentForm } from "@/components/forms/appointment-form"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  approvalStatus: string
  notes?: string
  pax?: number
  childCount?: number
  customerName?: string
  roomNumber?: string
  voucherNo?: string | null
  restAmount?: number | null
  restCurrency?: string | null
  customer: { id: string; name: string; email: string; phone?: string } | null
  service: { name: string; price: number; currency?: string }
  services?: { service: { id: string; name: string; price: number; currency?: string }; price: number }[]
  staff: { user: { name: string } } | null
  agency?: { id: string; name: string; companyName: string | null } | null
  hotel?: {
    id: string
    name: string
    googleMapsUrl?: string | null
    distanceToMarina: number | null
    region: { name: string }
  } | null
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const { has } = usePermissions()
  const isAgency = session?.user?.role === "AGENCY"
  const canEditOps = has("operasyon_duzenleme")
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [currentWeek] = useState(new Date())
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null)
  const [currentDay, setCurrentDay] = useState(new Date())
  const [viewMode, setViewMode] = useState<"weekly" | "daily">("daily")
  const [showDensity, setShowDensity] = useState(false)
  const [densityChart, setDensityChart] = useState<"vertical" | "horizontal">("vertical")

  const dayStart = startOfDay(currentDay)
  const dayEnd = endOfDay(currentDay)

  // Use weekRange from calendar, fallback to currentWeek
  const queryStart = viewMode === "weekly"
    ? (weekRange?.start || startOfWeek(currentWeek, { weekStartsOn: 1 }))
    : dayStart
  const queryEnd = viewMode === "weekly"
    ? (weekRange?.end || endOfWeek(currentWeek, { weekStartsOn: 1 }))
    : dayEnd

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["appointments", queryStart.toISOString(), queryEnd.toISOString(), viewMode],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments?startDate=${queryStart.toISOString()}&endDate=${queryEnd.toISOString()}`
      )
      if (!res.ok) throw new Error("Failed to fetch appointments")
      return res.json()
    },
  })

  // Session times — tüm bölgelerin saat dilimlerini çek (yoğunluk grafiği için)
  const { data: allSessionTimes = [] } = useQuery<string[]>({
    queryKey: ["session-times-slots"],
    queryFn: async () => {
      const res = await fetch("/api/regions/session-times")
      if (!res.ok) return []
      const regions = await res.json()
      const timeSet = new Set<string>()
      for (const r of regions) {
        for (const st of r.sessionTimes || []) {
          timeSet.add(st.time)
        }
      }
      return Array.from(timeSet).sort()
    },
    enabled: showDensity,
  })

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
  }

  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "İptal edilemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      toast.success("Randevu iptal edildi. Acenta carisi güncellendi.")
      setSelectedAppointment(null)
      setCancellingId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setCancellingId(null)
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge className="bg-blue-100 text-blue-800">Onaylı</Badge>
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Bekliyor</Badge>
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-800">Tamamlandı</Badge>
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800">İptal</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getApprovalBadge = (approvalStatus: string) => {
    switch (approvalStatus) {
      case "PENDING_APPROVAL":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">⏳ Onay Bekliyor</Badge>
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800 border-green-300">✓ Onaylandı</Badge>
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800 border-red-300">✗ Reddedildi</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Randevular</h1>
          <p className="text-gray-500">Randevu takvimini görüntüleyin ve yönetin</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Renk Kodları */}
          <div className="hidden md:flex items-center gap-3 text-xs border rounded-lg px-3 py-1.5 bg-white">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>Onaylı</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span>Bekliyor</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Tamamlandı</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>İptal</span>
            </div>
          </div>
          {/* Yoğunluk Butonu */}
          <Button
            variant={showDensity ? "default" : "outline"}
            className={cn("gap-1.5", showDensity && "bg-orange-500 hover:bg-orange-600")}
            onClick={() => setShowDensity(!showDensity)}
          >
            <BarChart3 className="h-4 w-4" />
            Yoğunluk
          </Button>
          {/* Datepicker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(currentDay, "dd MMM yyyy", { locale: tr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={currentDay}
                onSelect={(date) => {
                  if (date) {
                    setCurrentDay(date)
                    setViewMode("daily")
                  }
                }}
                locale={tr}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {/* View Mode Selector */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "weekly" | "daily")}>
            <TabsList>
              <TabsTrigger value="daily" className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Günlük
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                Haftalık
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canEditOps && (
          <Button className="w-full sm:w-auto" onClick={() => setShowAppointmentForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Randevu
          </Button>
          )}
        </div>
      </div>

      {/* Yoğunluk Paneli */}
      {showDensity && (() => {
        const activeAppointments = appointments.filter(a => a.status !== "CANCELLED")
        const byHour: Record<string, { count: number; pax: number }> = {}
        for (const a of activeAppointments) {
          const timeKey = format(new Date(a.startTime), "HH:mm")
          if (!byHour[timeKey]) byHour[timeKey] = { count: 0, pax: 0 }
          byHour[timeKey].count += 1
          byHour[timeKey].pax += (a.pax || 1) + (a.childCount || 0)
        }
        // Tüm session-times saatlerini kullan, randevu olmayan saatler 0
        const allTimes = allSessionTimes.length > 0 ? allSessionTimes : Object.keys(byHour).sort()
        const slots = allTimes.map(time => ({
          time,
          count: byHour[time]?.count || 0,
          pax: byHour[time]?.pax || 0,
        }))
        const maxPax = Math.max(...slots.map(s => s.pax), 1)
        const totalPax = slots.reduce((s, x) => s + x.pax, 0)

        const getBarColor = (pax: number) => {
          if (pax === 0) return "bg-gray-200"
          const intensity = pax / maxPax
          if (intensity >= 0.8) return "bg-red-400"
          if (intensity >= 0.5) return "bg-orange-400"
          if (intensity >= 0.3) return "bg-amber-300"
          return "bg-emerald-300"
        }

        return (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-orange-100 flex items-center justify-center">
                    <BarChart3 className="h-3.5 w-3.5 text-orange-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    Saatlik Yoğunluk
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {activeAppointments.length} randevu • {totalPax} PAX
                  </Badge>
                </div>
                <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-white">
                  <button
                    className={cn("px-2 py-1 text-xs rounded font-medium transition-colors",
                      densityChart === "vertical" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"
                    )}
                    onClick={() => setDensityChart("vertical")}
                  >
                    Dikey
                  </button>
                  <button
                    className={cn("px-2 py-1 text-xs rounded font-medium transition-colors",
                      densityChart === "horizontal" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"
                    )}
                    onClick={() => setDensityChart("horizontal")}
                  >
                    Yatay
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {slots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Seans saati tanımlı değil</p>
              ) : densityChart === "horizontal" ? (
                /* Yatay Bar Chart */
                <div className="space-y-2">
                  {slots.map(slot => {
                    const barWidth = slot.pax === 0 ? 0 : Math.max((slot.pax / maxPax) * 100, 3)
                    return (
                      <div key={slot.time} className="flex items-center gap-3">
                        <div className="w-14 shrink-0 text-right">
                          <span className={cn("text-sm font-bold", slot.pax > 0 ? "text-gray-700" : "text-gray-400")}>{slot.time}</span>
                        </div>
                        <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                          {barWidth > 0 && (
                            <div
                              className={cn("h-full rounded-lg transition-all duration-500", getBarColor(slot.pax))}
                              style={{ width: `${barWidth}%` }}
                            />
                          )}
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700">
                            {slot.pax > 0 ? `${slot.count} randevu • ${slot.pax} PAX` : ""}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Dikey Bar Chart */
                <div className="flex items-end gap-1 justify-around" style={{ minHeight: 200 }}>
                  {slots.map(slot => {
                    const barHeight = slot.pax === 0 ? 4 : Math.max((slot.pax / maxPax) * 180, 8)
                    return (
                      <div key={slot.time} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        {slot.pax > 0 && (
                          <span className="text-[10px] font-bold text-gray-600">{slot.pax}</span>
                        )}
                        <div
                          className={cn("w-full max-w-10 rounded-t-md transition-all duration-500", getBarColor(slot.pax))}
                          style={{ height: barHeight }}
                          title={`${slot.time} — ${slot.count} randevu, ${slot.pax} PAX`}
                        />
                        <span className={cn("text-[10px] font-medium", slot.pax > 0 ? "text-gray-700" : "text-gray-400")}>
                          {slot.time}
                        </span>
                        {slot.count > 0 && (
                          <span className="text-[9px] text-gray-400">{slot.count} rdv</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Renk Açıklaması */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-orange-200/50 justify-center">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-300" /><span className="text-[10px] text-gray-500">Düşük</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-300" /><span className="text-[10px] text-gray-500">Orta</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-400" /><span className="text-[10px] text-gray-500">Yüksek</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-400" /><span className="text-[10px] text-gray-500">Çok Yüksek</span></div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {viewMode === "weekly" ? (
        <WeeklyCalendar
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
          onWeekChange={(start, end) => setWeekRange({ start, end })}
        />
      ) : (
        /* Daily View */
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setCurrentDay(addDays(currentDay, -1))}>
                  Önceki Gün
                </Button>
                <CardTitle className="text-sm sm:text-base">{format(currentDay, "d MMMM yyyy, EEEE", { locale: tr })}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setCurrentDay(addDays(currentDay, 1))}>
                  Sonraki Gün
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDay(new Date())}>
                Bugün
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Bu gün için randevu bulunmuyor
              </div>
            ) : (
              <div className="space-y-3">
                {appointments
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map((appointment) => (
                    <div
                      key={appointment.id}
                      className={cn(
                        "p-4 border rounded-lg cursor-pointer transition-colors",
                        appointment.restAmount
                          ? "border-red-200 bg-red-50/40 hover:bg-red-50"
                          : "hover:bg-gray-50"
                      )}
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <span className="text-lg font-semibold">
                              {format(new Date(appointment.startTime), "HH:mm")}
                            </span>
                            {getStatusBadge(appointment.status)}
                            {appointment.voucherNo && (
                              <Badge variant="outline" className="text-xs font-mono">
                                Voucher No: {appointment.voucherNo}
                              </Badge>
                            )}
                            {isAgency && getApprovalBadge(appointment.approvalStatus)}
                            {appointment.restAmount && appointment.restAmount > 0 && (
                              <Badge className="bg-red-500 text-white flex items-center gap-1">
                                <Banknote className="h-3 w-3" />
                                REST
                                {appointment.restAmount && appointment.restCurrency && (
                                  <span className="font-bold ml-1">
                                    {appointment.restAmount} {appointment.restCurrency}
                                  </span>
                                )}
                              </Badge>
                            )}
                          </div>
                          <div className={`grid gap-4 text-sm ${isAgency ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                            <div>
                              <span className="text-gray-500">Misafir:</span>
                              <p className="font-medium">{appointment.customerName || appointment.customer?.name || "-"}</p>
                              {appointment.pax && appointment.pax > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    <Users className="h-3 w-3 mr-1" />
                                    {appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""} PAX
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500">Program:</span>
                              <p className="font-medium">{appointment.service?.name || "REST"}</p>
                            </div>
                            {!isAgency && (
                              <div>
                                <span className="text-gray-500">Acenta:</span>
                                <p className="font-medium">
                                  {appointment.agency?.companyName || appointment.agency?.name || "-"}
                                </p>
                              </div>
                            )}
                            {appointment.hotel && (
                              <div>
                                <span className="text-gray-500">Otel:</span>
                                <p
                                  className="font-medium text-blue-600 hover:underline cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (appointment.hotel?.googleMapsUrl) {
                                      window.open(appointment.hotel.googleMapsUrl, '_blank')
                                    }
                                  }}
                                >
                                  {appointment.hotel.name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-orange-200">
                                    {appointment.hotel.region.name}
                                  </span>
                                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-blue-200">
                                    <Clock className="h-2.5 w-2.5" />
                                    {format(new Date(appointment.startTime), "HH:mm")}
                                  </span>
                                  {appointment.pax && appointment.pax > 0 && (
                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200">
                                      <Users className="h-2.5 w-2.5" />
                                      {appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""} PAX
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AppointmentForm
        open={showAppointmentForm}
        onOpenChange={setShowAppointmentForm}
      />

      {/* Appointment Detail Dialog */}
      <Dialog
        open={!!selectedAppointment}
        onOpenChange={() => setSelectedAppointment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Randevu Detayı</DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Durum</span>
                {getStatusBadge(selectedAppointment.status)}
              </div>

              {/* Agency & Hotel Info */}
              {selectedAppointment.agency && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700 font-medium">
                    <Building2 className="h-4 w-4" />
                    {selectedAppointment.agency.companyName}
                  </div>
                </div>
              )}

              {selectedAppointment.hotel && (
                <div className="bg-green-50 p-3 rounded-lg space-y-2">
                  <div className="font-medium text-green-800">
                    {selectedAppointment.hotel.name}
                  </div>
                  <div className="text-sm text-green-700">
                    {selectedAppointment.hotel.region?.name}
                  </div>
                </div>
              )}

              {/* PAX Info */}
              {selectedAppointment.pax && selectedAppointment.pax > 0 && (
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Kişi Sayısı (PAX)</span>
                  <span className="font-medium">{selectedAppointment.pax}{selectedAppointment.childCount ? `+${selectedAppointment.childCount}` : ""}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Müşteri</span>
                  <p className="font-medium">
                    {selectedAppointment.customerName || selectedAppointment.customer?.name || "-"}
                  </p>
                  {selectedAppointment.customer?.email && (
                    <p className="text-sm text-gray-500">{selectedAppointment.customer.email}</p>
                  )}
                  {(selectedAppointment.roomNumber) && (
                    <p className="text-sm text-gray-500">
                      Oda: {selectedAppointment.roomNumber}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-sm text-gray-500">Voucher No</span>
                  <p className="font-medium">{selectedAppointment.voucherNo ? `#${selectedAppointment.voucherNo}` : "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Paketler</span>
                  {selectedAppointment.services && selectedAppointment.services.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {selectedAppointment.services.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.service.name}</span>
                          <span className="text-gray-500">
                            {s.service.currency === "TRY" ? "₺" : s.service.currency === "USD" ? "$" : s.service.currency === "GBP" ? "£" : "€"}{s.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{selectedAppointment.service.name}</p>
                      <p className="text-sm text-gray-500">
                        {selectedAppointment.service.currency === "TRY" ? "₺" : selectedAppointment.service.currency === "USD" ? "$" : selectedAppointment.service.currency === "GBP" ? "£" : "€"}{selectedAppointment.service.price}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tarih & Saat</span>
                  <p className="font-medium">
                    {format(new Date(selectedAppointment.startTime), "dd.MM.yyyy")}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(selectedAppointment.startTime), "HH:mm")}
                  </p>
                </div>
              </div>

              {selectedAppointment.restAmount && selectedAppointment.restAmount > 0 && (
                <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3">
                  <Banknote className="h-6 w-6 text-red-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">REST - Ödeme Kapıda</p>
                    {selectedAppointment.restCurrency ? (
                      <p className="text-xl font-bold text-red-700">
                        {selectedAppointment.restAmount} {selectedAppointment.restCurrency}
                      </p>
                    ) : (
                      <p className="text-sm text-red-600">Tutar belirtilmemiş</p>
                    )}
                  </div>
                </div>
              )}

              {selectedAppointment.notes && selectedAppointment.notes !== "REST" && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium mb-1">Not</p>
                  <p className="text-sm text-gray-700">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* İptal Butonu — sadece CONFIRMED veya PENDING durumundayken */}
              {canEditOps && !isAgency && (selectedAppointment.status === "CONFIRMED" || selectedAppointment.status === "PENDING") && (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setCancellingId(selectedAppointment.id)}
                >
                  <XCircle className="h-4 w-4" />
                  Randevuyu İptal Et
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog */}
      <AlertDialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevuyu İptal Et</AlertDialogTitle>
            <AlertDialogDescription>
              Bu randevuyu iptal etmek istediğinizden emin misiniz?
              {selectedAppointment?.agency && (
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
              onClick={() => cancellingId && cancelMutation.mutate(cancellingId)}
            >
              {cancelMutation.isPending ? "İptal ediliyor..." : "Evet, İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
