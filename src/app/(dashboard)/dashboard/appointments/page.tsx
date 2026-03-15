"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from "date-fns"
import { tr } from "date-fns/locale"
import { Plus, Building2, CalendarDays, Calendar as CalendarIcon, Banknote, Users, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar"
import { AppointmentForm } from "@/components/forms/appointment-form"
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
  const isAgency = session?.user?.role === "AGENCY"
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [currentWeek] = useState(new Date())
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null)
  const [currentDay, setCurrentDay] = useState(new Date())
  const [viewMode, setViewMode] = useState<"weekly" | "daily">("weekly")

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Randevular</h1>
          <p className="text-gray-500">Randevu takvimini görüntüleyin ve yönetin</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Renk Kodları */}
          <div className="flex items-center gap-3 text-xs border rounded-lg px-3 py-1.5 bg-white">
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
          {/* View Mode Selector */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "weekly" | "daily")}>
            <TabsList>
              <TabsTrigger value="weekly" className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                Haftalık
              </TabsTrigger>
              <TabsTrigger value="daily" className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Günlük
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setShowAppointmentForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Randevu
          </Button>
        </div>
      </div>

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setCurrentDay(addDays(currentDay, -1))}>
                  Önceki Gün
                </Button>
                <CardTitle>{format(currentDay, "d MMMM yyyy, EEEE", { locale: tr })}</CardTitle>
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
                        appointment.notes === "REST"
                          ? "border-red-200 bg-red-50/40 hover:bg-red-50"
                          : "hover:bg-gray-50"
                      )}
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
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
                            {appointment.notes === "REST" && (
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
                                <p className="text-xs text-gray-500 mt-0.5">{appointment.hotel.region.name}</p>
                              </div>
                            )}
                          </div>
                          {appointment.agency && (
                            <div className="mt-2 flex items-center gap-1 text-sm text-blue-600">
                              <Building2 className="h-3 w-3" />
                              {appointment.agency.companyName}
                            </div>
                          )}
                          {appointment.pax && appointment.pax > 1 && (
                            <div className="mt-1 text-sm text-gray-500">
                              PAX: {appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""} kişi
                            </div>
                          )}
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
                  <span className="text-sm text-gray-500">Hizmet</span>
                  <p className="font-medium">{selectedAppointment.service.name}</p>
                  <p className="text-sm text-gray-500">
                    {selectedAppointment.service.currency === "TRY" ? "₺" : selectedAppointment.service.currency === "USD" ? "$" : selectedAppointment.service.currency === "GBP" ? "£" : "€"}{selectedAppointment.service.price}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Tarih & Saat</span>
                  <p className="font-medium">
                    {format(new Date(selectedAppointment.startTime), "dd.MM.yyyy")}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(selectedAppointment.startTime), "HH:mm")} -{" "}
                    {format(new Date(selectedAppointment.endTime), "HH:mm")}
                  </p>
                </div>
              </div>

              {selectedAppointment.notes === "REST" && (
                <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3">
                  <Banknote className="h-6 w-6 text-red-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">REST - Ödeme Kapıda</p>
                    {selectedAppointment.restAmount && selectedAppointment.restCurrency ? (
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
              {!isAgency && (selectedAppointment.status === "CONFIRMED" || selectedAppointment.status === "PENDING") && (
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
