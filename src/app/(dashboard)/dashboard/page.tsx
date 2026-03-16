"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Calendar,
  Clock,
  CheckCircle,
  Users,
  Plus,
  Banknote,
  Building2,
  Phone,
  Mail,
  Navigation,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
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
import { PendingApprovals } from "@/components/admin/pending-approvals"
import { useSession } from "next-auth/react"
import { getCurrencySymbol } from "@/lib/currency-utils"
import { toast } from "sonner"

interface DashboardStats {
  todayAppointments: number
  pendingAppointments: number
  completedToday: number
  totalPax: number
  totalChildCount: number
}

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  notes?: string
  pax?: number
  childCount?: number
  customerName?: string
  roomNumber?: string
  voucherNo?: string | null
  restAmount?: number | null
  restCurrency?: string | null
  customer?: { name: string; email?: string; phone?: string } | null
  service: { name: string; price: number; currency?: string }
  services?: { service: { id: string; name: string; price: number; currency?: string }; price: number }[]
  staff?: { user: { name: string } } | null
  agency?: {
    id: string
    companyName: string
    address?: string
    user?: {
      name: string
      email: string
      phone?: string
    }
  } | null
  hotel?: {
    name: string
    distanceToMarina?: number | null
    region?: { name: string }
  } | null
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "STAFF"
  const isAgency = session?.user?.role === "AGENCY"
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedAgency, setSelectedAgency] = useState<Appointment["agency"] | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  const today = new Date()
  const { data: todayAppointments } = useQuery<Appointment[]>({
    queryKey: ["appointments", "today"],
    queryFn: async () => {
      const startDate = format(today, "yyyy-MM-dd")
      const endDate = format(today, "yyyy-MM-dd")
      const res = await fetch(
        `/api/appointments?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`
      )
      if (!res.ok) throw new Error("Failed to fetch appointments")
      return res.json()
    },
  })

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
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

  const isRest = (appointment: Appointment) => !!(appointment.restAmount && appointment.restAmount > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">
            {format(today, "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
        </div>
        <Button onClick={() => setShowAppointmentForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Randevu
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Bugünün Randevuları
            </CardTitle>
            <Calendar className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.todayAppointments || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pendingAppointments || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Bugün Tamamlanan
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.completedToday || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Bugünkü Toplam PAX
            </CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalPax || 0}{(stats?.totalChildCount ?? 0) > 0 ? `+${stats?.totalChildCount}` : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Onay Bekleyenler + Onaylananlar + İptal Edilenler */}
      <Tabs defaultValue="pending">
        <TabsList className="h-auto p-1">
          <TabsTrigger
            value="pending"
            className="gap-2 !text-orange-600 data-[state=active]:!bg-orange-100 data-[state=active]:!text-orange-700 data-[state=active]:!shadow-none data-[state=inactive]:!bg-orange-50/50"
          >
            <Clock className="h-4 w-4" />
            Onay Bekleyenler
            {(stats?.pendingAppointments ?? 0) > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-xs bg-orange-500 text-white hover:bg-orange-500">
                {stats?.pendingAppointments}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="approved"
            className="gap-2 !text-green-600 data-[state=active]:!bg-green-100 data-[state=active]:!text-green-700 data-[state=active]:!shadow-none data-[state=inactive]:!bg-green-50/50"
          >
            <CheckCircle className="h-4 w-4" />
            Onaylananlar
            {(todayAppointments?.filter(a => a.status !== "CANCELLED").length ?? 0) > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-xs bg-green-500 text-white hover:bg-green-500">
                {todayAppointments?.filter(a => a.status !== "CANCELLED").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="cancelled"
            className="gap-2 !text-red-600 data-[state=active]:!bg-red-100 data-[state=active]:!text-red-700 data-[state=active]:!shadow-none data-[state=inactive]:!bg-red-50/50"
          >
            <XCircle className="h-4 w-4" />
            İptal Edilenler
            {(todayAppointments?.filter(a => a.status === "CANCELLED").length ?? 0) > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-xs bg-red-500 text-white hover:bg-red-500">
                {todayAppointments?.filter(a => a.status === "CANCELLED").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingApprovals />
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Onaylanan Randevular
              </CardTitle>
            </CardHeader>
            <CardContent>
          {(() => {
            const approved = todayAppointments?.filter(a => a.status !== "CANCELLED") ?? []
            return approved.length > 0 ? (
            <div className="space-y-3">
              {approved
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedAppointment(appointment)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-bold">
                        {format(new Date(appointment.startTime), "HH:mm")}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {appointment.customerName || appointment.customer?.name || "-"}
                        </span>
                        {appointment.pax && appointment.pax > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""} kişi
                          </Badge>
                        )}
                        {isRest(appointment) && (
                          <Badge className="bg-red-500 text-white flex items-center gap-1">
                            <Banknote className="h-3 w-3" />
                            ÖDEME KAPIDA
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {appointment.services && appointment.services.length > 0
                          ? appointment.services.map(s => s.service.name).join(", ")
                          : appointment.service.name}
                      </div>
                      {appointment.agency && (
                        <button
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAgency(appointment.agency)
                          }}
                        >
                          <Building2 className="h-3 w-3" />
                          {appointment.agency.companyName}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(appointment.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Onaylanan randevu bulunmuyor
            </div>
          )
          })()}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="cancelled">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                İptal Edilen Randevular
              </CardTitle>
            </CardHeader>
            <CardContent>
          {(() => {
            const cancelled = todayAppointments?.filter(a => a.status === "CANCELLED") ?? []
            return cancelled.length > 0 ? (
            <div className="space-y-3">
              {cancelled
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 border border-red-100 rounded-lg hover:bg-red-50/50 cursor-pointer transition-colors opacity-75"
                  onClick={() => setSelectedAppointment(appointment)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-bold text-gray-400 line-through">
                        {format(new Date(appointment.startTime), "HH:mm")}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-500">
                          {appointment.customerName || appointment.customer?.name || "-"}
                        </span>
                        {appointment.pax && appointment.pax > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {appointment.pax}{appointment.childCount ? `+${appointment.childCount}` : ""} kişi
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {appointment.services && appointment.services.length > 0
                          ? appointment.services.map(s => s.service.name).join(", ")
                          : appointment.service.name}
                      </div>
                      {appointment.agency && (
                        <button
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAgency(appointment.agency)
                          }}
                        >
                          <Building2 className="h-3 w-3" />
                          {appointment.agency.companyName}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(appointment.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              İptal edilen randevu bulunmuyor
            </div>
          )
          })()}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

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
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedAppointment.status)}
                  {isRest(selectedAppointment) && (
                    <Badge className="bg-red-500 text-white flex items-center gap-1">
                      <Banknote className="h-3 w-3" />
                      ÖDEME KAPIDA
                    </Badge>
                  )}
                </div>
              </div>

              {selectedAppointment.agency && (
                <div
                  className="bg-blue-50 p-3 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    setSelectedAgency(selectedAppointment.agency)
                  }}
                >
                  <div className="flex items-center gap-2 text-blue-700 font-medium">
                    <Building2 className="h-4 w-4" />
                    {selectedAppointment.agency.companyName}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">Detaylar için tıklayın</div>
                </div>
              )}

              {selectedAppointment.hotel && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-medium text-green-800">
                    {selectedAppointment.hotel.name}
                  </div>
                  {selectedAppointment.hotel.region && (
                    <div className="text-sm text-green-700">
                      {selectedAppointment.hotel.region.name}
                    </div>
                  )}
                  {selectedAppointment.hotel.distanceToMarina && (
                    <div className="flex items-center gap-4 text-sm mt-1">
                      <div className="flex items-center gap-1 text-green-700">
                        <Navigation className="h-3 w-3" />
                        <span>{selectedAppointment.hotel.distanceToMarina} km</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-700">
                        <Clock className="h-3 w-3" />
                        <span>~{Math.round(selectedAppointment.hotel.distanceToMarina * 2)} dk</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  {selectedAppointment.roomNumber && (
                    <p className="text-sm text-gray-500">Oda: {selectedAppointment.roomNumber}</p>
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
                      {selectedAppointment.services.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.service.name}</span>
                          <span className="text-gray-500">
                            {getCurrencySymbol(s.service.currency || "EUR")} {s.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{selectedAppointment.service.name}</p>
                      <p className="text-sm text-gray-500">
                        {getCurrencySymbol(selectedAppointment.service.currency || "EUR")} {selectedAppointment.service.price}
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

              {selectedAppointment.notes && selectedAppointment.notes !== "REST" && (
                <div>
                  <span className="text-sm text-gray-500">Notlar</span>
                  <p>{selectedAppointment.notes}</p>
                </div>
              )}

              {/* İptal Butonu */}
              {(selectedAppointment.status === "CONFIRMED" || selectedAppointment.status === "PENDING") && (
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

      {/* Agency Detail Dialog */}
      <Dialog
        open={!!selectedAgency}
        onOpenChange={() => setSelectedAgency(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Acenta Bilgileri
            </DialogTitle>
          </DialogHeader>

          {selectedAgency && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-blue-800">
                  {selectedAgency.companyName}
                </h3>
                {selectedAgency.address && (
                  <p className="text-sm text-blue-700 mt-1">{selectedAgency.address}</p>
                )}
              </div>

              {selectedAgency.user && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700">Yetkili Bilgileri</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>{selectedAgency.user.name}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <a href={`mailto:${selectedAgency.user.email}`} className="text-blue-600 hover:underline">
                        {selectedAgency.user.email}
                      </a>
                    </div>
                    {selectedAgency.user.phone && (
                      <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <a href={`tel:${selectedAgency.user.phone}`} className="text-blue-600 hover:underline">
                          {selectedAgency.user.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
