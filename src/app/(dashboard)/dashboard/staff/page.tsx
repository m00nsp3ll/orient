"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Plus, Pencil, Calendar, Trash2 } from "lucide-react"
import { useIsMobile } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { StaffPermissions } from "./components/staff-permissions"

const STAFF_POSITIONS = [
  { value: "Admin", label: "Admin" },
  { value: "Operasyon", label: "Operasyon" },
  { value: "Müdür", label: "Müdür" },
  { value: "Resepsiyon", label: "Resepsiyon" },
  { value: "İnfocu", label: "İnfocu" },
]

interface Staff {
  id: string
  userId: string
  specializations: string[]
  isActive: boolean
  position: string | null
  commissionRate: number | null
  user: { id: string; name: string; email: string; phone?: string; username?: string | null }
  workingHours: WorkingHours[]
}

interface WorkingHours {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]

export default function StaffPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isMobile = useIsMobile()
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [showHoursDialog, setShowHoursDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null)

  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff")
      if (!res.ok) throw new Error("Failed to fetch staff")
      return res.json()
    },
  })

  const updateWorkingHours = useMutation({
    mutationFn: async ({ staffId, dayOfWeek, startTime, endTime }: {
      staffId: string; dayOfWeek: number; startTime: string; endTime: string
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
    onError: () => toast.error("Çalışma saatleri güncellenemedi"),
  })

  const updateStaffMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; username: string; password: string; phone: string; position: string; commissionRate: number | null }) => {
      const res = await fetch(`/api/staff/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || undefined,
          username: data.username || undefined,
          password: data.password || undefined,
          phone: data.phone || null,
          position: data.position || null,
          commissionRate: data.commissionRate,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Güncellenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      toast.success("Personel güncellendi")
      setEditingStaff(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Silinemedi")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      toast.success("Personel silindi")
      setDeletingStaff(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSaveHours = (dayOfWeek: number, startTime: string, endTime: string) => {
    if (!selectedStaff) return
    updateWorkingHours.mutate({ staffId: selectedStaff.id, dayOfWeek, startTime, endTime })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personel</h1>
          <p className="text-gray-500">Personel ve çalışma saatlerini yönetin</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Personel Ekle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personel Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Henüz personel eklenmemiş</div>
          ) : isMobile ? (
            <div className="space-y-3">
              {staff.map((member) => (
                <div key={member.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{member.user.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{member.user.email}</div>
                      {member.user.phone && (
                        <div className="text-sm text-gray-500">{member.user.phone}</div>
                      )}
                    </div>
                    <Badge variant={member.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                      {member.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {member.position && <span>{member.position}</span>}
                      {member.commissionRate != null && (
                        <Badge variant="outline" className="text-xs">%{member.commissionRate}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingStaff(member)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedStaff(member); setShowHoursDialog(true) }}>
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingStaff(member)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Kullanıcı Adı</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead>Prim %</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.user.name}</TableCell>
                    <TableCell>{member.user.username ?? member.user.name}</TableCell>
                    <TableCell>{member.user.phone || "-"}</TableCell>
                    <TableCell>{member.position || "-"}</TableCell>
                    <TableCell>{member.commissionRate != null ? `%${member.commissionRate}` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingStaff(member)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedStaff(member); setShowHoursDialog(true) }}>
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingStaff(member)}>
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

      {/* Personel Rolleri — sadece ADMIN görür */}
      {session?.user?.role === "ADMIN" && <StaffPermissions />}

      {/* Add Dialog */}
      <AddStaffDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["staff"] })
          setShowAddDialog(false)
        }}
      />

      {/* Edit Dialog */}
      <EditStaffDialog
        open={!!editingStaff}
        onOpenChange={(v) => { if (!v) setEditingStaff(null) }}
        staff={editingStaff}
        onSave={(data) => {
          if (!editingStaff) return
          updateStaffMutation.mutate({ id: editingStaff.id, ...data })
        }}
        saving={updateStaffMutation.isPending}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingStaff} onOpenChange={(v) => { if (!v) setDeletingStaff(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Personeli Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingStaff?.user.name}</strong> adlı personeli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deletingStaff && deleteStaffMutation.mutate(deletingStaff.id)}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Working Hours Dialog */}
      <Dialog open={showHoursDialog} onOpenChange={setShowHoursDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Çalışma Saatleri - {selectedStaff?.user.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {DAYS.map((day, index) => {
              const hours = selectedStaff?.workingHours.find((h) => h.dayOfWeek === index)
              return (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24 font-medium">{day}</div>
                  <Input type="time" defaultValue={hours?.startTime || "09:00"} className="w-32" id={`start-${index}`} />
                  <span>-</span>
                  <Input type="time" defaultValue={hours?.endTime || "18:00"} className="w-32" id={`end-${index}`} />
                  <Button size="sm" variant="outline" onClick={() => {
                    const s = (document.getElementById(`start-${index}`) as HTMLInputElement).value
                    const e = (document.getElementById(`end-${index}`) as HTMLInputElement).value
                    handleSaveHours(index, s, e)
                  }}>
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

// ---- Add Staff Dialog ----
function AddStaffDialog({ open, onOpenChange, onSuccess }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [position, setPosition] = useState("")
  const [commissionRate, setCommissionRate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isInfocu = position === "İnfocu"

  const reset = () => { setName(""); setUsername(""); setPassword(""); setPhone(""); setPosition(""); setCommissionRate("") }

  const handleSubmit = async () => {
    if (!name || !username || !password) { toast.error("İsim, kullanıcı adı ve şifre zorunludur"); return }
    if (!position) { toast.error("Pozisyon seçiniz"); return }
    if (isInfocu && !commissionRate) { toast.error("İnfocu için prim oranı zorunludur"); return }
    setSubmitting(true)
    try {
      const userRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, password, phone: phone || undefined }),
      })
      if (!userRes.ok) { const err = await userRes.json(); throw new Error(err.error || "Kullanıcı oluşturulamadı") }
      const user = await userRes.json()

      const staffRes = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, position: position || null, commissionRate: commissionRate ? parseFloat(commissionRate) : null }),
      })
      if (!staffRes.ok) { const err = await staffRes.json(); throw new Error(err.error || "Personel oluşturulamadı") }
      const staffData = await staffRes.json()

      // Update display name (Ad Soyad) separately from login username
      if (name !== username) {
        await fetch(`/api/staff/${staffData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
      }

      toast.success("Personel eklendi")
      reset()
      onSuccess()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Hata oluştu")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="w-full !max-w-[450px]">
        <DialogHeader><DialogTitle>Personel Ekle</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Ad Soyad *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" /></div>
          <div className="space-y-2"><Label>Kullanıcı Adı *</Label><Input type="text" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="giris_yapilacak_ad" /></div>
          <div className="space-y-2"><Label>Şifre *</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" /></div>
          <div className="space-y-2"><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XXXX" /></div>
          <div className="space-y-2">
            <Label>Pozisyon *</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger><SelectValue placeholder="Pozisyon seçin" /></SelectTrigger>
              <SelectContent>
                {STAFF_POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isInfocu && (
            <div className="space-y-2">
              <Label>Prim % *</Label>
              <Input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="15" min={0} max={100} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Ekleniyor..." : "Personel Ekle"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Edit Staff Dialog ----
function EditStaffDialog({ open, onOpenChange, staff, onSave, saving }: {
  open: boolean; onOpenChange: (open: boolean) => void; staff: Staff | null
  onSave: (data: { name: string; username: string; password: string; phone: string; position: string; commissionRate: number | null }) => void
  saving: boolean
}) {
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [position, setPosition] = useState("")
  const [commissionRate, setCommissionRate] = useState("")
  const [lastStaffId, setLastStaffId] = useState<string | null>(null)

  if (open && staff && staff.id !== lastStaffId) {
    setName(staff.user.name || "")
    setUsername(staff.user.username ?? staff.user.name ?? "")
    setPhone(staff.user.phone || "")
    setPosition(staff.position || "")
    setCommissionRate(staff.commissionRate != null ? String(staff.commissionRate) : "")
    setPassword("")
    setLastStaffId(staff.id)
  }
  if (!open && lastStaffId) setLastStaffId(null)

  const isInfocu = position === "İnfocu"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full !max-w-[450px]">
        <DialogHeader><DialogTitle>Personel Düzenle</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Ad Soyad *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" /></div>
          <div className="space-y-2"><Label>Kullanıcı Adı</Label><Input type="text" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Giriş için kullanıcı adı" /></div>
          <div className="space-y-2"><Label>Yeni Şifre</Label><Input type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Değiştirmek için yeni şifre girin" /></div>
          <div className="space-y-2"><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XXXX" /></div>
          <div className="space-y-2">
            <Label>Pozisyon</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger><SelectValue placeholder="Pozisyon seçin" /></SelectTrigger>
              <SelectContent>
                {STAFF_POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isInfocu && (
            <div className="space-y-2">
              <Label>Prim % *</Label>
              <Input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="15" min={0} max={100} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button onClick={() => onSave({ name, username, password, phone, position, commissionRate: commissionRate ? parseFloat(commissionRate) : null })} disabled={saving || !name}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
