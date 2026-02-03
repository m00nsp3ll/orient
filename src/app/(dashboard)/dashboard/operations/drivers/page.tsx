"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Driver {
  id: string
  phone: string
  isActive: boolean
  user: {
    id: string
    name: string
    email: string
  }
  _count?: {
    transfers: number
  }
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  })

  useEffect(() => {
    fetchDrivers()
  }, [])

  const fetchDrivers = async () => {
    try {
      const res = await fetch("/api/drivers")
      if (res.ok) {
        const data = await res.json()
        setDrivers(data)
      }
    } catch (error) {
      console.error("Şoförler yüklenirken hata:", error)
      toast.error("Şoförler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingDriver) {
        const res = await fetch(`/api/drivers/${editingDriver.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
          }),
        })

        if (res.ok) {
          toast.success("Şoför güncellendi")
          fetchDrivers()
          setDialogOpen(false)
          resetForm()
        } else {
          const error = await res.json()
          toast.error(error.error || "Şoför güncellenemedi")
        }
      } else {
        const res = await fetch("/api/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })

        if (res.ok) {
          toast.success("Şoför oluşturuldu")
          fetchDrivers()
          setDialogOpen(false)
          resetForm()
        } else {
          const error = await res.json()
          toast.error(error.error || "Şoför oluşturulamadı")
        }
      }
    } catch (error) {
      console.error("Form gönderilirken hata:", error)
      toast.error("Bir hata oluştu")
    }
  }

  const handleToggleActive = async (driver: Driver) => {
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !driver.isActive }),
      })

      if (res.ok) {
        toast.success(driver.isActive ? "Şoför pasif yapıldı" : "Şoför aktif yapıldı")
        fetchDrivers()
      } else {
        toast.error("Durum güncellenemedi")
      }
    } catch (error) {
      console.error("Durum güncelleme hatası:", error)
      toast.error("Durum güncellenemedi")
    }
  }

  const handleDelete = async (driver: Driver) => {
    if (!confirm(`${driver.user.name} adlı şoförü silmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Şoför silindi")
        fetchDrivers()
      } else {
        toast.error("Şoför silinemedi")
      }
    } catch (error) {
      console.error("Silme hatası:", error)
      toast.error("Şoför silinemedi")
    }
  }

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", phone: "" })
    setEditingDriver(null)
  }

  const openEditDialog = (driver: Driver) => {
    setEditingDriver(driver)
    setFormData({
      name: driver.user.name,
      email: driver.user.email,
      password: "",
      phone: driver.phone,
    })
    setDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Şoför Yönetimi</h1>
          <p className="text-muted-foreground">
            Transfer şoförlerini yönetin
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Şoför
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDriver ? "Şoför Düzenle" : "Yeni Şoför Ekle"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              {!editingDriver && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Şifre</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit">
                  {editingDriver ? "Güncelle" : "Oluştur"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[200px]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
          <p>Henüz şoför eklenmemiş</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Transfer Sayısı</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">{driver.user.name}</TableCell>
                  <TableCell>{driver.user.email}</TableCell>
                  <TableCell>{driver.phone}</TableCell>
                  <TableCell>{driver._count?.transfers || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={driver.isActive}
                        onCheckedChange={() => handleToggleActive(driver)}
                      />
                      <Badge variant={driver.isActive ? "default" : "secondary"}>
                        {driver.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(driver)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(driver)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
