"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Settings, KeyRound, Eye, EyeOff, Pencil, Check, X } from "lucide-react"
import { useIsMobile } from "@/hooks/use-media-query"
import { usePermissions } from "@/hooks/use-permissions"
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
  plainPassword: string | null
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
  const isMobile = useIsMobile()
  const { isAdmin, has } = usePermissions()
  const canManage = isAdmin || has("operasyon_duzenleme")
  const [showForm, setShowForm] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null)
  const [editFormData, setEditFormData] = useState({ name: "", companyName: "", phone: "", address: "" })
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteAgencyTarget, setDeleteAgencyTarget] = useState<Agency | null>(null)
  const [settingsAgency, setSettingsAgency] = useState<Agency | null>(null)
  const [settingsPassword, setSettingsPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [editingUsername, setEditingUsername] = useState(false)
  const [editUsernameValue, setEditUsernameValue] = useState("")
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

  const updateAgencyPassword = useMutation({
    mutationFn: async ({ agencyId, password }: { agencyId: string; password: string }) => {
      const res = await fetch(`/api/agencies/${agencyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Şifre güncellenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success("Şifre güncellendi")
      setSettingsPassword("")
      setShowNewPassword(false)
      // settingsAgency'yi güncellenmiş halinden al
      const updated = agencies.find(a => a.id === settingsAgency?.id)
      if (updated) {
        setSettingsAgency({ ...updated, plainPassword: settingsPassword })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateAgencyUsername = useMutation({
    mutationFn: async ({ agencyId, username }: { agencyId: string; username: string }) => {
      const res = await fetch(`/api/agencies/${agencyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Kullanıcı adı güncellenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success("Kullanıcı adı güncellendi")
      setEditingUsername(false)
      if (settingsAgency) {
        setSettingsAgency({
          ...settingsAgency,
          user: settingsAgency.user ? { ...settingsAgency.user, email: editUsernameValue } : null,
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleOpenSettingsModal = (agency: Agency) => {
    setSettingsAgency(agency)
    setSettingsPassword("")
    setShowNewPassword(false)
    setEditingUsername(false)
    setShowSettingsModal(true)
  }

  const handleOpenEditModal = (agency: Agency) => {
    setEditingAgency(agency)
    setEditFormData({
      name: agency.name || "",
      companyName: agency.companyName || "",
      phone: agency.phone || agency.user?.phone || "",
      address: agency.address || "",
    })
    setShowEditModal(true)
  }

  const updateAgencyInfo = useMutation({
    mutationFn: async ({ agencyId, data }: { agencyId: string; data: typeof editFormData }) => {
      const res = await fetch(`/api/agencies/${agencyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Güncellenemedi") }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success("Acenta bilgileri güncellendi")
      setShowEditModal(false)
      setEditingAgency(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSaveSettings = () => {
    if (!settingsAgency) return
    if (!settingsPassword) {
      toast.error("Yeni şifre giriniz")
      return
    }
    if (settingsPassword.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır")
      return
    }
    setShowPasswordConfirm(true)
  }

  const handleConfirmPasswordChange = () => {
    if (!settingsAgency) return
    setShowPasswordConfirm(false)
    updateAgencyPassword.mutate({
      agencyId: settingsAgency.id,
      password: settingsPassword,
    })
  }

  const handleStartEditUsername = () => {
    setEditUsernameValue(settingsAgency?.user?.email || settingsAgency?.email || "")
    setEditingUsername(true)
  }

  const handleSaveUsername = () => {
    if (!settingsAgency || !editUsernameValue.trim()) return
    updateAgencyUsername.mutate({
      agencyId: settingsAgency.id,
      username: editUsernameValue.trim(),
    })
  }

  const handleOpenServiceModal = async (agency: Agency) => {
    setSelectedAgency(agency)
    setShowServiceModal(true)

    try {
      const res = await fetch(`/api/agencies/${agency.id}/services`)
      if (res.ok) {
        const agencyServices = await res.json()
        if (agencyServices.length > 0) {
          setSelectedServices(agencyServices.map((s: any) => s.id))
          const prices: Record<string, number | null> = {}
          agencyServices.forEach((s: any) => {
            prices[s.id] = s.passPrice ?? s.price
          })
          setServicePrices(prices)
        } else {
          setSelectedServices(allServices.map(s => s.id))
          const prices: Record<string, number | null> = {}
          allServices.forEach(s => {
            prices[s.id] = s.price
          })
          setServicePrices(prices)
        }
      }
    } catch (error) {
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
        {canManage && (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Acenta
        </Button>
        )}
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
          ) : isMobile ? (
            <div className="space-y-3">
              {agencies.map((agency) => (
                <div key={agency.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{agency.name || agency.companyName || "-"}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {agency.user?.name || agency.contactName || "-"}
                      </div>
                      {(agency.user?.phone || agency.phone) && (
                        <div className="text-sm text-gray-500">{agency.user?.phone || agency.phone}</div>
                      )}
                    </div>
                    <Badge variant={agency.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                      {agency.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {agency.currency === "EUR" ? "€ EUR" : agency.currency === "USD" ? "$ USD" : agency.currency === "GBP" ? "£ GBP" : "₺ TRY"}
                      </Badge>
                      <span className="text-xs text-gray-500">{agency._count.appointments} randevu</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => handleOpenServiceModal(agency)}>
                        <Settings className="h-3.5 w-3.5 mr-1" />
                        Hizmetler
                      </Button>
                      {canManage && (
                      <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal(agency)}>
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenSettingsModal(agency)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteAgencyTarget(agency); setShowDeleteConfirm(true) }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                      </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şirket Adı</TableHead>
                  <TableHead>Yetkili</TableHead>
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
                        {canManage && (
                        <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Düzenle"
                          onClick={() => handleOpenEditModal(agency)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Kullanıcı Bilgileri"
                          onClick={() => handleOpenSettingsModal(agency)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteAgencyTarget(agency)
                            setShowDeleteConfirm(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Yeni Acenta Ekle */}
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
              <Label>Kullanıcı Adı</Label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="Giriş için kullanılacak kullanıcı adı"
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
                    disabled={!canManage}
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
                  disabled={updateAgencyServices.isPending || !canManage}
                >
                  {updateAgencyServices.isPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kullanıcı Bilgileri Modal */}
      <Dialog open={showSettingsModal} onOpenChange={(open) => {
        setShowSettingsModal(open)
        if (!open) {
          setSettingsAgency(null)
          setSettingsPassword("")
          setShowNewPassword(false)
          setEditingUsername(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Kullanıcı Bilgileri - {settingsAgency?.companyName || settingsAgency?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mevcut bilgiler */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Kullanıcı Adı</Label>
                {editingUsername ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editUsernameValue}
                      onChange={(e) => setEditUsernameValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleSaveUsername}
                      disabled={updateAgencyUsername.isPending}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingUsername(false)}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-medium">
                      {settingsAgency?.user?.email || settingsAgency?.email || "-"}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleStartEditUsername}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mevcut Şifre</Label>
                <p className="text-sm font-medium mt-0.5">
                  {settingsAgency?.plainPassword || "-"}
                </p>
              </div>
            </div>

            {/* Şifre değiştirme bölümü */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">Şifre Değiştir</Label>
              <div>
                <Label className="text-xs text-muted-foreground">Yeni Şifre</Label>
                <div className="relative mt-1">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={settingsPassword}
                    onChange={(e) => setSettingsPassword(e.target.value)}
                    placeholder="Yeni şifre giriniz"
                    minLength={6}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">En az 6 karakter</p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateAgencyPassword.isPending || !settingsPassword}
                  size="sm"
                >
                  {updateAgencyPassword.isPending ? "Kaydediliyor..." : "Şifreyi Değiştir"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Şifre Değiştirme Onay */}
      <AlertDialog open={showPasswordConfirm} onOpenChange={setShowPasswordConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şifre Değişikliği</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <span className="font-semibold">{settingsAgency?.companyName || settingsAgency?.name}</span> acentasının şifresini{" "}
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{settingsPassword}</span>{" "}
                ile değiştirmek istiyor musunuz?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPasswordChange}>
              Değiştir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Acenta Düzenle Modal */}
      <Dialog open={showEditModal} onOpenChange={(v) => { if (!v) { setShowEditModal(false); setEditingAgency(null) } }}>
        <DialogContent className="w-full !max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Acenta Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Acenta Adı (Yetkili) *</Label>
              <Input value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Acenta adı" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Şirket Adı</Label>
              <Input value={editFormData.companyName} onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })} placeholder="Şirket adı" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Telefon</Label>
              <Input value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} placeholder="Telefon" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Adres</Label>
              <Input value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} placeholder="Adres" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingAgency(null) }}>İptal</Button>
              <Button
                disabled={updateAgencyInfo.isPending || !editFormData.name.trim()}
                onClick={() => editingAgency && updateAgencyInfo.mutate({ agencyId: editingAgency.id, data: editFormData })}
              >
                {updateAgencyInfo.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Acenta Silme Onay */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acenta Silme</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <span className="font-semibold">{deleteAgencyTarget?.companyName || deleteAgencyTarget?.name}</span> acentasını silmek istiyor musunuz?
                <br />
                <span className="text-red-500 font-medium">Bu işlem geri alınamaz! Acentaya ait cari bilgileri ve randevu geçmişi kaybolabilir.</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteAgencyTarget) {
                  deleteAgency.mutate(deleteAgencyTarget.id)
                }
                setShowDeleteConfirm(false)
                setDeleteAgencyTarget(null)
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
