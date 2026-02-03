"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface Agency {
  id: string
  companyName: string
  address?: string
  isActive: boolean
  user: { id: string; name: string; email: string; phone?: string }
  _count: { appointments: number }
}

export default function AgenciesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    companyName: "",
    address: "",
  })

  const { data: agencies = [], isLoading, error } = useQuery<Agency[]>({
    queryKey: ["agencies"],
    queryFn: async () => {
      const res = await fetch("/api/agencies")
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to fetch agencies")
      }
      return res.json()
    },
    retry: 1,
  })

  const createAgency = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Acenta oluşturulamadı")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success("Acenta oluşturuldu")
      setShowForm(false)
      setFormData({ name: "", email: "", password: "", phone: "", companyName: "", address: "" })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteAgency = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agencies/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Acenta silinemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success("Acenta silindi")
    },
    onError: () => {
      toast.error("Acenta silinemedi")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createAgency.mutate(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Acentalar</h1>
          <p className="text-gray-500">Acenta hesaplarını yönetin</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Acenta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acenta Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Yüklenirken hata oluştu. Sayfayı yenileyin.
            </div>
          ) : agencies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz acenta eklenmemiş
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şirket Adı</TableHead>
                  <TableHead>Yetkili</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Randevu Sayısı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((agency) => (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">
                      {agency.companyName}
                    </TableCell>
                    <TableCell>{agency.user.name}</TableCell>
                    <TableCell>{agency.user.email}</TableCell>
                    <TableCell>{agency.user.phone || "-"}</TableCell>
                    <TableCell>{agency._count.appointments}</TableCell>
                    <TableCell>
                      <Badge variant={agency.isActive ? "default" : "secondary"}>
                        {agency.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAgency.mutate(agency.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Acenta Ekle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Şirket Adı</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Yetkili Adı</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Şifre</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Adres</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={createAgency.isPending}>
                {createAgency.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
