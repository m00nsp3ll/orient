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
import { CheckCircle, XCircle, Building2, Hotel, Users, Clock, MapPin } from "lucide-react"
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
  customerName: string | null
  customerPhone: string | null
  notes: string | null
  approvalStatus: string
  agency: {
    id: string
    companyName: string | null
    name: string
  } | null
  service: {
    id: string
    name: string
    duration: number
    price: number
  }
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
                          {format(new Date(appointment.startTime), "HH:mm")} - {format(new Date(appointment.endTime), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{appointment.customerName || "-"}</div>
                      {appointment.customerPhone && (
                        <div className="text-xs text-gray-500">{appointment.customerPhone}</div>
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
                      <div className="font-medium text-sm">{appointment.service.name}</div>
                      <div className="text-xs text-gray-500">
                        {appointment.service.duration} dk • {appointment.service.price}₺
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Users className="h-3 w-3" />
                      {appointment.pax || 1}
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
            <AlertDialogDescription>
              {selectedAppointment && (
                <div className="space-y-2 text-foreground">
                  <p className="font-medium">
                    <strong>Acenta:</strong> {selectedAppointment.agency?.companyName || selectedAppointment.agency?.name}
                  </p>
                  <p>
                    <strong>Misafir:</strong> {selectedAppointment.customerName}
                  </p>
                  <p>
                    <strong>Otel:</strong> {selectedAppointment.hotel?.name}
                  </p>
                  <p>
                    <strong>Program:</strong> {selectedAppointment.service.name}
                  </p>
                  <p>
                    <strong>Tarih:</strong> {format(new Date(selectedAppointment.startTime), "d MMMM yyyy, HH:mm", { locale: tr })}
                  </p>
                  <p>
                    <strong>PAX:</strong> {selectedAppointment.pax || 1} kişi
                  </p>
                  {selectedAppointment.notes && (
                    <p className="text-sm bg-muted p-2 rounded mt-2">
                      <strong>Not:</strong> {selectedAppointment.notes}
                    </p>
                  )}
                  <p className="text-sm mt-4 text-muted-foreground">
                    {actionType === "approve"
                      ? "Bu rezervasyonu onaylamak istediğinizden emin misiniz?"
                      : "Bu rezervasyonu reddetmek istediğinizden emin misiniz?"}
                  </p>
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
