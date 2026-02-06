"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from "date-fns"
import { tr } from "date-fns/locale"
import { Plus, Building2, CalendarDays, Calendar as CalendarIcon, Banknote, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar"
import { AppointmentForm } from "@/components/forms/appointment-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button as Btn } from "@/components/ui/button"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "next-auth/react"

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  approvalStatus: string
  notes?: string
  pax?: number
  customerName?: string
  customerPhone?: string
  customer: { id: string; name: string; email: string; phone?: string } | null
  service: { name: string; duration: number; price: number }
  staff: { user: { name: string } } | null
  agency?: { id: string; companyName: string } | null
  hotel?: {
    id: string
    name: string
    googleMapsUrl?: string | null
    distanceToMarina: number | null
    region: { name: string }
  } | null
}

export default function AppointmentsPage() {
  const { data: session } = useSession()
  const isAgency = session?.user?.role === "AGENCY"
  const queryClient = useQueryClient()
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [currentWeek, setCurrentWeek] = useState(new Date())
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

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update appointment")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      toast.success("Randevu durumu güncellendi")
      setSelectedAppointment(null)
    },
    onError: () => {
      toast.error("Randevu güncellenemedi")
    },
  })

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge className="bg-green-100 text-green-800">Onaylı</Badge>
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Bekliyor</Badge>
      case "COMPLETED":
        return <Badge className="bg-blue-100 text-blue-800">Tamamlandı</Badge>
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
                      className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-semibold">
                              {format(new Date(appointment.startTime), "HH:mm")} - {format(new Date(appointment.endTime), "HH:mm")}
                            </span>
                            {getStatusBadge(appointment.status)}
                            {isAgency && getApprovalBadge(appointment.approvalStatus)}
                            {appointment.notes === "REST" && (
                              <Badge className="bg-red-500 text-white flex items-center gap-1">
                                <Banknote className="h-3 w-3" />
                                ÖDEME KAPIDA
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
                                    {appointment.pax} PAX
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
                                <span className="text-gray-500">Personel:</span>
                                <p className="font-medium">{appointment.staff?.user?.name || "-"}</p>
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
                              PAX: {appointment.pax} kişi
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
                  <span className="font-medium">{selectedAppointment.pax}</span>
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
                  {(selectedAppointment.customerPhone || selectedAppointment.customer?.phone) && (
                    <p className="text-sm text-gray-500">
                      {selectedAppointment.customerPhone || selectedAppointment.customer?.phone}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-sm text-gray-500">Personel</span>
                  <p className="font-medium">{selectedAppointment.staff?.user?.name || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Hizmet</span>
                  <p className="font-medium">{selectedAppointment.service.name}</p>
                  <p className="text-sm text-gray-500">
                    {selectedAppointment.service.duration} dk - {selectedAppointment.service.price}₺
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

              {selectedAppointment.notes && (
                <div>
                  <span className="text-sm text-gray-500">Notlar</span>
                  <p>{selectedAppointment.notes}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <span className="text-sm text-gray-500 block mb-2">Durumu Güncelle</span>
                <div className="flex gap-2 flex-wrap">
                  {selectedAppointment.status !== "CONFIRMED" && (
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus.mutate({
                          id: selectedAppointment.id,
                          status: "CONFIRMED",
                        })
                      }
                    >
                      Onayla
                    </Btn>
                  )}
                  {selectedAppointment.status !== "COMPLETED" && (
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatus.mutate({
                          id: selectedAppointment.id,
                          status: "COMPLETED",
                        })
                      }
                    >
                      Tamamlandı
                    </Btn>
                  )}
                  {selectedAppointment.status !== "CANCELLED" && (
                    <Btn
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        updateStatus.mutate({
                          id: selectedAppointment.id,
                          status: "CANCELLED",
                        })
                      }
                    >
                      İptal Et
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
