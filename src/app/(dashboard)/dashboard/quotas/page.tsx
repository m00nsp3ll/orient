"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface Quota {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  maxQuota: number
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

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
]

export default function QuotasPage() {
  const queryClient = useQueryClient()
  const [newQuota, setNewQuota] = useState({
    dayOfWeek: "1",
    startTime: "09:00",
    maxQuota: "5",
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const { data: quotas = [], isLoading } = useQuery<Quota[]>({
    queryKey: ["quotas"],
    queryFn: async () => {
      const res = await fetch("/api/quotas")
      if (!res.ok) throw new Error("Failed to fetch quotas")
      return res.json()
    },
  })

  const createQuota = useMutation({
    mutationFn: async (data: { dayOfWeek: number; startTime: string; endTime: string; maxQuota: number }) => {
      const res = await fetch("/api/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Kota kaydedilemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotas"] })
      toast.success("Kota kaydedildi")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteQuota = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotas/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Kota silinemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotas"] })
      toast.success("Kota silindi")
    },
    onError: () => {
      toast.error("Kota silinemedi")
    },
  })

  const updateQuota = useMutation({
    mutationFn: async ({ id, maxQuota }: { id: string; maxQuota: string }) => {
      const res = await fetch(`/api/quotas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxQuota }),
      })
      if (!res.ok) throw new Error("Kota güncellenemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotas"] })
      setEditingId(null)
      toast.success("Kota güncellendi")
    },
    onError: () => {
      toast.error("Kota güncellenemedi")
    },
  })

  const handleStartEdit = (quota: Quota) => {
    setEditingId(quota.id)
    setEditingValue(quota.maxQuota.toString())
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingValue("")
  }

  const handleSaveEdit = (id: string) => {
    updateQuota.mutate({ id, maxQuota: editingValue })
  }

  const handleAddQuota = () => {
    const startHour = parseInt(newQuota.startTime.split(":")[0])
    const startMin = parseInt(newQuota.startTime.split(":")[1])
    const endHour = startMin === 30 ? startHour + 1 : startHour
    const endMin = startMin === 30 ? "00" : "30"
    const endTime = `${endHour.toString().padStart(2, "0")}:${endMin}`

    createQuota.mutate({
      dayOfWeek: parseInt(newQuota.dayOfWeek),
      startTime: newQuota.startTime,
      endTime,
      maxQuota: parseInt(newQuota.maxQuota),
    })
  }

  // Group quotas by day
  const quotasByDay = quotas.reduce((acc, quota) => {
    if (!acc[quota.dayOfWeek]) acc[quota.dayOfWeek] = []
    acc[quota.dayOfWeek].push(quota)
    return acc
  }, {} as Record<number, Quota[]>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kota Yönetimi</h1>
        <p className="text-gray-500">Saat bazlı randevu kotalarını ayarlayın</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Kota Ekle</CardTitle>
          <CardDescription>
            Belirli saat dilimleri için maksimum randevu sayısı belirleyin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Gün</label>
              <Select
                value={newQuota.dayOfWeek}
                onValueChange={(v) => setNewQuota({ ...newQuota, dayOfWeek: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Saat</label>
              <Select
                value={newQuota.startTime}
                onValueChange={(v) => setNewQuota({ ...newQuota, startTime: v })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Randevu</label>
              <Input
                type="number"
                min="1"
                className="w-24"
                value={newQuota.maxQuota}
                onChange={(e) => setNewQuota({ ...newQuota, maxQuota: e.target.value })}
              />
            </div>
            <Button onClick={handleAddQuota} disabled={createQuota.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mevcut Kotalar</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : quotas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz kota tanımlanmamış. Kota olmadan tüm saatler sınırsız randevu alabilir.
            </div>
          ) : (
            <div className="space-y-6">
              {DAYS.map((day, dayIndex) => {
                const dayQuotas = quotasByDay[dayIndex] || []
                if (dayQuotas.length === 0) return null

                return (
                  <div key={dayIndex}>
                    <h3 className="font-semibold mb-2">{day}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Saat</TableHead>
                          <TableHead>Max Randevu</TableHead>
                          <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayQuotas
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((quota) => (
                            <TableRow key={quota.id}>
                              <TableCell>
                                {quota.startTime} - {quota.endTime}
                              </TableCell>
                              <TableCell>
                                {editingId === quota.id ? (
                                  <Input
                                    type="number"
                                    min="1"
                                    className="w-20"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                  />
                                ) : (
                                  quota.maxQuota
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {editingId === quota.id ? (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleSaveEdit(quota.id)}
                                      disabled={updateQuota.isPending}
                                    >
                                      <Check className="h-4 w-4 text-green-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleStartEdit(quota)}
                                    >
                                      <Pencil className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteQuota.mutate(quota.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
