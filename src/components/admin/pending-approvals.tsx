"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle, XCircle, Building2, Hotel, Users, Clock, MapPin, Banknote } from "lucide-react"
import { getCurrencySymbol } from "@/lib/currency-utils"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"
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
import { useSession } from "next-auth/react"

interface PendingAppointment {
  id: string
  startTime: string
  endTime: string
  pax: number | null
  childCount?: number | null
  customerName: string | null
  roomNumber: string | null
  notes: string | null
  restAmount: number | null
  restCurrency: string | null
  approvalStatus: string
  agency: {
    id: string
    companyName: string | null
    name: string
  } | null
  service: {
    id: string
    name: string
    price: number
    currency?: string
  }
  services?: { service: { id: string; name: string; price: number; currency?: string }; price: number }[]
  hotel: {
    id: string
    name: string
    region: {
      name: string
    }
  } | null
}

export function PendingApprovals() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "STAFF"
  const queryClient = useQueryClient()
  const [selectedAppointment, setSelectedAppointment] = useState<PendingAppointment | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)

  const { data: pendingAppointments = [], isLoading } = useQuery<PendingAppointment[]>({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/appointments?approvalStatus=PENDING_APPROVAL")
      if (!res.ok) throw new Error("Failed to fetch pending appointments")
      return res.json()
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await fetch(`/api/appointments/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("İşlem başarısız")
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["appointments", "today"] })
      toast.success(
        variables.action === "approve"
          ? "Rezervasyon onaylandı"
          : "Rezervasyon reddedildi"
      )
      setSelectedAppointment(null)
      setActionType(null)
    },
    onError: () => {
      toast.error("İşlem gerçekleştirilemedi")
    },
  })

  const handleAction = (appointment: PendingAppointment, action: "approve" | "reject") => {
    setSelectedAppointment(appointment)
    setActionType(action)
  }

  const confirmAction = () => {
    if (selectedAppointment && actionType) {
      approveMutation.mutate({ id: selectedAppointment.id, action: actionType })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Onay Bekleyen Rezervasyonlar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        </CardContent>
      </Card>
    )
  }

  if (pendingAppointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Onay Bekleyen Rezervasyonlar
            <Badge variant="secondary">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Onay bekleyen rezervasyon yok
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Onay Bekleyen Rezervasyonlar
            <Badge className="bg-orange-500">{pendingAppointments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Acenta</TableHead>}
                <TableHead>Tarih & Saat</TableHead>
                <TableHead>Misafir</TableHead>
                <TableHead>Otel</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>PAX</TableHead>
                {isAdmin && <TableHead className="text-right">İşlemler</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingAppointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">
                          {appointment.agency?.companyName || appointment.agency?.name || "-"}
                        </span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium">
                          {format(new Date(appointment.startTime), "d MMM yyyy", { locale: tr })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(appointment.startTime), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{appointment.customerName || "-"}</div>
                      {appointment.roomNumber && (
                        <div className="text-xs text-gray-500">Oda: {appointment.roomNumber}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium text-sm">{appointment.hotel?.name || "-"}</div>
                        {appointment.hotel?.region && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {appointment.hotel.region.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {appointment.services && appointment.services.length > 0 ? (
                        appointment.services.map((s, idx) => (
                          <div key={idx}>
                            <div className="font-medium text-sm">{s.service.name}</div>
                            <div className="text-xs text-gray-500">
                              {getCurrencySymbol(s.service.currency || "EUR")} {s.price}
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="font-medium text-sm">{appointment.service.name}</div>
                          <div className="text-xs text-gray-500">
                            {getCurrencySymbol(appointment.service.currency || "EUR")} {appointment.service.price}
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Users className="h-3 w-3" />
                      {appointment.pax || 1}{appointment.childCount ? `+${appointment.childCount}` : ""}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleAction(appointment, "approve")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(appointment, "reject")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reddet
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {pendingAppointments.map((appointment) => (
              <div key={appointment.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">
                      {format(new Date(appointment.startTime), "d MMM yyyy", { locale: tr })}
                    </span>
                    <span className="text-sm text-gray-500">
                      {format(new Date(appointment.startTime), "HH:mm")}
                    </span>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {appointment.pax || 1}{appointment.childCount ? `+${appointment.childCount}` : ""}
                  </Badge>
                </div>
                <div className="text-sm">
                  <span className="font-medium">{appointment.customerName || "-"}</span>
                  {appointment.hotel && (
                    <span className="text-gray-500"> · {appointment.hotel.name}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">
                      {appointment.services && appointment.services.length > 0
                        ? appointment.services.map(s => s.service.name).join(", ")
                        : appointment.service.name}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {appointment.services && appointment.services.length > 0
                        ? appointment.services.map(s => `${getCurrencySymbol(s.service.currency || "EUR")} ${s.price}`).join(", ")
                        : `${getCurrencySymbol(appointment.service.currency || "EUR")} ${appointment.service.price}`}
                    </span>
                  </div>
                </div>
                {isAdmin && appointment.agency && (
                  <div className="flex items-center gap-1 text-sm text-blue-600">
                    <Building2 className="h-3 w-3" />
                    {appointment.agency.companyName || appointment.agency.name}
                  </div>
                )}
                {appointment.restAmount && appointment.restCurrency && (
                  <div className="flex items-center gap-1 text-sm text-red-600 font-medium">
                    <Banknote className="h-3 w-3" />
                    REST: {appointment.restAmount} {appointment.restCurrency}
                  </div>
                )}
                {isAdmin && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAction(appointment, "approve")}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAction(appointment, "reject")}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reddet
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedAppointment} onOpenChange={() => {
        setSelectedAppointment(null)
        setActionType(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" ? "Rezervasyonu Onayla" : "Rezervasyonu Reddet"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {selectedAppointment && (
                <div className="space-y-2 text-foreground text-sm">
                  <div className="font-medium">
                    <strong>Acenta:</strong> {selectedAppointment.agency?.companyName || selectedAppointment.agency?.name}
                  </div>
                  <div>
                    <strong>Misafir:</strong> {selectedAppointment.customerName}
                  </div>
                  <div>
                    <strong>Otel:</strong> {selectedAppointment.hotel?.name}
                  </div>
                  <div>
                    <strong>Paketler:</strong>
                    {selectedAppointment.services && selectedAppointment.services.length > 0 ? (
                      <span> {selectedAppointment.services.map(s => s.service.name).join(", ")}</span>
                    ) : (
                      <span> {selectedAppointment.service.name}</span>
                    )}
                  </div>
                  <div>
                    <strong>Tarih:</strong> {format(new Date(selectedAppointment.startTime), "d MMMM yyyy, HH:mm", { locale: tr })}
                  </div>
                  <div>
                    <strong>PAX:</strong> {selectedAppointment.pax || 1}{selectedAppointment.childCount ? `+${selectedAppointment.childCount}` : ""} kişi
                  </div>
                  {selectedAppointment.notes && selectedAppointment.notes !== "REST" && !selectedAppointment.notes.startsWith("[DEMO]") && (
                    <div className="text-sm bg-muted p-2 rounded mt-2">
                      <strong>Not:</strong> {selectedAppointment.notes}
                    </div>
                  )}
                  {selectedAppointment.restAmount && selectedAppointment.restCurrency && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                      <Banknote className="h-5 w-5 text-red-600 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-red-500 uppercase tracking-wide">REST - Ödeme Kapıda</div>
                        <div className="text-lg font-bold text-red-700">
                          {selectedAppointment.restAmount} {selectedAppointment.restCurrency}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="text-sm mt-4 text-muted-foreground">
                    {actionType === "approve"
                      ? "Bu rezervasyonu onaylamak istediğinizden emin misiniz?"
                      : "Bu rezervasyonu reddetmek istediğinizden emin misiniz?"}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {actionType === "approve" ? "Onayla" : "Reddet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
