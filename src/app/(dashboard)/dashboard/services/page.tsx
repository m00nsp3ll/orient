"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ServiceForm } from "@/components/forms/service-form"
import { toast } from "sonner"

interface Service {
  id: string
  name: string
  description?: string
  duration: number
  price: number
  isActive: boolean
  category?: { id: string; name: string }
}

interface Category {
  id: string
  name: string
}

export default function ServicesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services")
      if (!res.ok) throw new Error("Failed to fetch services")
      return res.json()
    },
  })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories")
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json()
    },
  })

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete service")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
      toast.success("Hizmet silindi")
      setDeletingId(null)
    },
    onError: () => {
      toast.error("Hizmet silinemedi")
    },
  })

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingService(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hizmetler</h1>
          <p className="text-gray-500">Sunduğunuz hizmetleri yönetin</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Hizmet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hizmet Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz hizmet eklenmemiş
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hizmet Adı</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{service.name}</div>
                        {service.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {service.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {service.category?.name || "-"}
                    </TableCell>
                    <TableCell>{service.duration} dk</TableCell>
                    <TableCell>{service.price}₺</TableCell>
                    <TableCell>
                      <Badge
                        variant={service.isActive ? "default" : "secondary"}
                      >
                        {service.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(service.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ServiceForm
        open={showForm}
        onOpenChange={handleCloseForm}
        initialData={editingService || undefined}
        categories={categories}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hizmeti Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu hizmeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteService.mutate(deletingId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
