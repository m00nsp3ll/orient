"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface Staff {
  id: string
  userId: string
  specializations: string[]
  isActive: boolean
  user: { id: string; name: string; email: string; phone?: string }
  workingHours: WorkingHours[]
}

interface WorkingHours {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

const DAYS = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
]

export default function StaffPage() {
  const queryClient = useQueryClient()
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [showHoursDialog, setShowHoursDialog] = useState(false)

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff")
      if (!res.ok) throw new Error("Failed to fetch staff")
      return res.json()
    },
  })

  const updateWorkingHours = useMutation({
    mutationFn: async ({
      staffId,
      dayOfWeek,
      startTime,
      endTime,
    }: {
      staffId: string
      dayOfWeek: number
      startTime: string
      endTime: string
    }) => {
      const res = await fetch(`/api/staff/${staffId}/working-hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, startTime, endTime, isActive: true }),
      })
      if (!res.ok) throw new Error("Failed to update working hours")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      toast.success("Çalışma saatleri güncellendi")
    },
    onError: () => {
      toast.error("Çalışma saatleri güncellenemedi")
    },
  })

  const handleManageHours = (staffMember: Staff) => {
    setSelectedStaff(staffMember)
    setShowHoursDialog(true)
  }

  const handleSaveHours = (dayOfWeek: number, startTime: string, endTime: string) => {
    if (!selectedStaff) return
    updateWorkingHours.mutate({
      staffId: selectedStaff.id,
      dayOfWeek,
      startTime,
      endTime,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personel</h1>
          <p className="text-gray-500">Personel ve çalışma saatlerini yönetin</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personel Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz personel eklenmemiş
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Uzmanlık</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user.name}
                    </TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>{member.user.phone || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {member.specializations.length > 0 ? (
                          member.specializations.map((spec) => (
                            <Badge key={spec} variant="secondary">
                              {spec}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleManageHours(member)}
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Working Hours Dialog */}
      <Dialog open={showHoursDialog} onOpenChange={setShowHoursDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Çalışma Saatleri - {selectedStaff?.user.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {DAYS.map((day, index) => {
              const hours = selectedStaff?.workingHours.find(
                (h) => h.dayOfWeek === index
              )
              return (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24 font-medium">{day}</div>
                  <Input
                    type="time"
                    defaultValue={hours?.startTime || "09:00"}
                    className="w-32"
                    id={`start-${index}`}
                  />
                  <span>-</span>
                  <Input
                    type="time"
                    defaultValue={hours?.endTime || "18:00"}
                    className="w-32"
                    id={`end-${index}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const startInput = document.getElementById(
                        `start-${index}`
                      ) as HTMLInputElement
                      const endInput = document.getElementById(
                        `end-${index}`
                      ) as HTMLInputElement
                      handleSaveHours(index, startInput.value, endInput.value)
                    }}
                  >
                    Kaydet
                  </Button>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
