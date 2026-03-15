"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  companyName: string | null
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address?: string
  isActive: boolean
  currency: string
  user: { id: string; name: string; email: string; phone?: string } | null
  _count: { appointments: number }
}

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  currency?: string
  category: { name: string } | null
}

interface AgencyServiceWithPrice {
  id: string
  serviceId: string
  passPrice: number | null
}

export default function AgenciesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [servicePrices, setServicePrices] = useState<Record<string, number | null>>({})
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    companyName: "",
    address: "",
    currency: "EUR" as "EUR" | "USD" | "GBP" | "TRY",
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

  const { data: allServices = [] } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services")
      if (!res.ok) throw new Error("Hizmetler yüklenemedi")
      return res.json()
    },
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
      setFormData({ name: "", email: "", password: "", phone: "", companyName: "", address: "", currency: "EUR" })
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

  const updateAgencyCurrency = useMutation({
    mutationFn: async ({ agencyId, currency }: { agencyId: string; currency: string }) => {
      const res = await fetch(`/api/agencies/${agencyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      })
      if (!res.ok) throw new Error("Para birimi güncellenemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
    },
  })

  const updateAgencyServices = useMutation({
    mutationFn: async ({ agencyId, services }: { agencyId: string; services: { serviceId: string; passPrice: number | null }[] }) => {
      const res = await fetch(`/api/agencies/${agencyId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.details || error.error || "Hizmetler güncellenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-services"] })
      toast.success("Hizmetler güncellendi")
      setShowServiceModal(false)
      setSelectedAgency(null)
      setSelectedServices([])
      setServicePrices({})
    },
    onError: (error: Error) => {
      console.error("Update error:", error)
      toast.error(error.message || "Hizmetler güncellenemedi")
    },
  })

  const handleOpenServiceModal = async (agency: Agency) => {
    setSelectedAgency(agency)
    setShowServiceModal(true)

    // Acentanın mevcut hizmetlerini yükle
    try {
      const res = await fetch(`/api/agencies/${agency.id}/services`)
      if (res.ok) {
        const agencyServices = await res.json()
        if (agencyServices.length > 0) {
          setSelectedServices(agencyServices.map((s: any) => s.id))

          // Pass fiyatlarını yükle
          const prices: Record<string, number | null> = {}
          agencyServices.forEach((s: any) => {
            prices[s.id] = s.passPrice ?? s.price
          })
          setServicePrices(prices)
        } else {
          // Default: Tüm hizmetler seçili ve default fiyatlar
          setSelectedServices(allServices.map(s => s.id))
          const prices: Record<string, number | null> = {}
          allServices.forEach(s => {
            prices[s.id] = s.price
          })
          setServicePrices(prices)
        }
      }
    } catch (error) {
      // Hata durumunda tüm hizmetleri seç ve default fiyatlar
      setSelectedServices(allServices.map(s => s.id))
      const prices: Record<string, number | null> = {}
      allServices.forEach(s => {
        prices[s.id] = s.price
      })
      setServicePrices(prices)
    }
  }

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([...selectedServices, serviceId])
      // Varsayılan fiyatı ayarla
      if (!servicePrices[serviceId]) {
        const service = allServices.find(s => s.id === serviceId)
        if (service) {
          setServicePrices({ ...servicePrices, [serviceId]: service.price })
        }
      }
    } else {
      setSelectedServices(selectedServices.filter(id => id !== serviceId))
    }
  }

  const handlePriceChange = (serviceId: string, price: string) => {
    const numPrice = price === "" ? null : parseFloat(price)
    setServicePrices({ ...servicePrices, [serviceId]: numPrice })
  }

  const handleSaveServices = () => {
    if (!selectedAgency) return

    const services = selectedServices.map(serviceId => {
      const price = servicePrices[serviceId]
      const defaultPrice = allServices.find(s => s.id === serviceId)?.price ?? null

      return {
        serviceId,
        passPrice: price !== undefined && price !== null ? price : defaultPrice,
      }
    })

    updateAgencyServices.mutate({
      agencyId: selectedAgency.id,
      services,
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
                  <TableHead>Para Birimi</TableHead>
                  <TableHead>Randevu Sayısı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((agency) => (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">
                      {agency.name || agency.companyName || "-"}
                    </TableCell>
                    <TableCell>{agency.user?.name || agency.contactName || "-"}</TableCell>
                    <TableCell>{agency.user?.email || agency.email || "-"}</TableCell>
                    <TableCell>{agency.user?.phone || agency.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {agency.currency === "EUR" ? "€ EUR" : agency.currency === "USD" ? "$ USD" : agency.currency === "GBP" ? "£ GBP" : "₺ TRY"}
                      </Badge>
                    </TableCell>
                    <TableCell>{agency._count.appointments}</TableCell>
                    <TableCell>
                      <Badge variant={agency.isActive ? "default" : "secondary"}>
                        {agency.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenServiceModal(agency)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Hizmetler
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAgency.mutate(agency.id)}
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
            <div>
              <Label>Para Birimi</Label>
              <div className="flex gap-2 mt-1">
                {(["EUR", "USD", "GBP", "TRY"] as const).map((cur) => (
                  <Button
                    key={cur}
                    type="button"
                    variant={formData.currency === cur ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, currency: cur })}
                  >
                    {cur === "EUR" ? "€ EUR" : cur === "USD" ? "$ USD" : cur === "GBP" ? "£ GBP" : "₺ TRY"}
                  </Button>
                ))}
              </div>
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

      {/* Hizmet Atama Modal */}
      <Dialog open={showServiceModal} onOpenChange={(open) => {
        setShowServiceModal(open)
        if (!open) {
          setSelectedAgency(null)
          setSelectedServices([])
          setServicePrices({})
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Hizmetler - {selectedAgency?.companyName || selectedAgency?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Bu acentanın satış yapabileceği hizmetleri ve Pass fiyatlarını yönetin.
              </p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Para Birimi:</span>
                {(["EUR", "USD", "GBP", "TRY"] as const).map((cur) => (
                  <Button
                    key={cur}
                    type="button"
                    variant={selectedAgency?.currency === cur ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      if (selectedAgency && selectedAgency.currency !== cur) {
                        setSelectedAgency({ ...selectedAgency, currency: cur })
                        updateAgencyCurrency.mutate({ agencyId: selectedAgency.id, currency: cur })
                      }
                    }}
                  >
                    {cur === "EUR" ? "€ EUR" : cur === "USD" ? "$ USD" : cur === "GBP" ? "£ GBP" : "₺ TRY"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {allServices.map((service) => (
                <div key={service.id} className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex-1">
                    <label
                      htmlFor={service.id}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {service.name}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      {service.category && (
                        <Badge variant="outline" className="text-xs">
                          {service.category.name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Varsayılan: {service.currency === "TRY" ? "₺" : service.currency === "USD" ? "$" : service.currency === "GBP" ? "£" : "€"}{service.price}
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {service.description}
                      </p>
                    )}
                  </div>

                  {/* Pass Fiyatı */}
                  {selectedServices.includes(service.id) && (
                    <div className="flex flex-col gap-1 min-w-0">
                      <Label className="text-xs text-muted-foreground">Pass Fiyatı</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-blue-600">
                          {selectedAgency?.currency === "EUR" ? "€" : selectedAgency?.currency === "USD" ? "$" : selectedAgency?.currency === "GBP" ? "£" : "₺"}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="-"
                          value={servicePrices[service.id] ?? ""}
                          onChange={(e) => handlePriceChange(service.id, e.target.value)}
                          className="w-24 h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <Switch
                    id={service.id}
                    checked={selectedServices.includes(service.id)}
                    onCheckedChange={(checked) =>
                      handleServiceToggle(service.id, checked)
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedServices.length} / {allServices.length} hizmet seçili
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowServiceModal(false)
                    setSelectedAgency(null)
                    setSelectedServices([])
                  }}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleSaveServices}
                  disabled={updateAgencyServices.isPending}
                >
                  {updateAgencyServices.isPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
