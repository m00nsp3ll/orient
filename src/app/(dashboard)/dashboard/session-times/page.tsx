"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Pencil, ArrowRight, Clock, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface SessionTime {
  id: string
  regionId: string
  time: string
  isActive: boolean
  maxQuota: number
}

interface RegionWithTimes {
  id: string
  name: string
  pickupTimeRegionId: string | null
  pickupTimeRegion: { id: string; name: string } | null
  sessionTimes: SessionTime[]
  _count: { hotels: number }
}

export default function SessionTimesPage() {
  const queryClient = useQueryClient()

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addRegionId, setAddRegionId] = useState("")
  const [addTime, setAddTime] = useState("")

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<{ id: string; time: string; regionName: string } | null>(null)
  const [editTime, setEditTime] = useState("")

  // Delete confirm dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSession, setDeletingSession] = useState<{ id: string; time: string; regionName: string } | null>(null)

  // Quota edit dialog
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [editingQuota, setEditingQuota] = useState<{ id: string; time: string; regionName: string; maxQuota: number } | null>(null)
  const [quotaValue, setQuotaValue] = useState("")

  // Quota enabled setting
  const { data: quotaSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["setting-quotaEnabled"],
    queryFn: async () => {
      const res = await fetch("/api/settings?key=quotaEnabled")
      if (!res.ok) throw new Error("Ayar yüklenemedi")
      return res.json()
    },
  })
  const quotaEnabled = quotaSetting?.value === "true"

  const quotaToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "quotaEnabled", value: String(enabled) }),
      })
      if (!res.ok) throw new Error("Ayar güncellenemedi")
      return res.json()
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["setting-quotaEnabled"] })
      toast.success(enabled ? "Kota sistemi açıldı" : "Kota sistemi kapatıldı")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const quotaEditMutation = useMutation({
    mutationFn: async ({ id, maxQuota }: { id: string; maxQuota: number }) => {
      const res = await fetch("/api/regions/session-times", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, maxQuota }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Kota güncellenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions-session-times"] })
      setQuotaDialogOpen(false)
      setEditingQuota(null)
      setQuotaValue("")
      toast.success("Kota güncellendi")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const { data, isLoading, isError } = useQuery<RegionWithTimes[]>({
    queryKey: ["regions-session-times"],
    queryFn: async () => {
      const res = await fetch("/api/regions/session-times")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    retry: 1,
  })

  const regions = data ?? []

  const addMutation = useMutation({
    mutationFn: async ({ regionId, time }: { regionId: string; time: string }) => {
      const res = await fetch("/api/regions/session-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId, time }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Eklenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions-session-times"] })
      setAddDialogOpen(false)
      setAddRegionId("")
      setAddTime("")
      toast.success("Seans saati eklendi")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, time }: { id: string; time: string }) => {
      const res = await fetch("/api/regions/session-times", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, time }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Güncellenemedi")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions-session-times"] })
      setEditDialogOpen(false)
      setEditingSession(null)
      setEditTime("")
      toast.success("Seans saati güncellendi")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/regions/session-times?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Silinemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions-session-times"] })
      setDeleteDialogOpen(false)
      setDeletingSession(null)
      toast.success("Seans saati silindi")
    },
    onError: () => toast.error("Seans saati silinemedi"),
  })

  const handleAdd = () => {
    if (!addRegionId || !addTime) return
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(addTime)) {
      toast.error("Geçersiz format. HH:mm şeklinde girin (örn: 09:30)")
      return
    }
    addMutation.mutate({ regionId: addRegionId, time: addTime })
  }

  const handleEditClick = (st: SessionTime, regionName: string) => {
    setEditingSession({ id: st.id, time: st.time, regionName })
    setEditTime(st.time)
    setEditDialogOpen(true)
  }

  const handleEditConfirm = () => {
    if (!editingSession || !editTime) return
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(editTime)) {
      toast.error("Geçersiz format. HH:mm şeklinde girin (örn: 09:30)")
      return
    }
    editMutation.mutate({ id: editingSession.id, time: editTime })
  }

  const handleDeleteClick = (st: SessionTime, regionName: string) => {
    setDeletingSession({ id: st.id, time: st.time, regionName })
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!deletingSession) return
    deleteMutation.mutate(deletingSession.id)
  }

  const handleQuotaClick = (st: SessionTime, regionName: string) => {
    setEditingQuota({ id: st.id, time: st.time, regionName, maxQuota: st.maxQuota })
    setQuotaValue(String(st.maxQuota))
    setQuotaDialogOpen(true)
  }

  const handleQuotaConfirm = () => {
    if (!editingQuota) return
    const parsed = parseInt(quotaValue)
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Geçerli bir sayı girin (0 = limitsiz)")
      return
    }
    quotaEditMutation.mutate({ id: editingQuota.id, maxQuota: parsed })
  }

  const ownTimeRegions = regions.filter((r) => !r.pickupTimeRegion)
  const delegatingRegions = regions.filter((r) => r.pickupTimeRegion)

  const maxSlots = ownTimeRegions.reduce((max, r) => Math.max(max, r.sessionTimes.length), 0)
  const columnCount = Math.max(maxSlots, 6)

  const regionOrder = [
    "Çenger", "Okurcalar", "İncekum", "Avsallar", "Türkler", "Konaklı",
    "Kargıcak", "Mahmutlar", "Kestel", "Tosmur", "Oba",
    "Atatürk Anıtı", "Damlataş", "Kleopatra",
  ]

  const sortedRegions = [...ownTimeRegions].sort((a, b) => {
    const ia = regionOrder.indexOf(a.name)
    const ib = regionOrder.indexOf(b.name)
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alınış Saatleri</h1>
          <p className="text-gray-500">Bölgelere göre alınış/randevu saatlerini yönetin</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 border rounded-lg">
            <Shield className="h-4 w-4 text-gray-500" />
            <Label htmlFor="quota-toggle" className="text-sm font-medium cursor-pointer">
              Kota Sistemi
            </Label>
            <Switch
              id="quota-toggle"
              checked={quotaEnabled}
              onCheckedChange={(checked) => quotaToggleMutation.mutate(checked)}
              disabled={quotaToggleMutation.isPending}
            />
            <Badge variant={quotaEnabled ? "default" : "secondary"} className="text-xs">
              {quotaEnabled ? "Açık" : "Kapalı"}
            </Badge>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Saat Ekle
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Yükleniyor...</div>}
      {isError && <div className="text-center py-12 text-red-500">Veriler yüklenemedi. Sayfayı yenileyin.</div>}

      {!isLoading && !isError && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Seans Saatleri Tablosu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[160px] font-bold bg-slate-700 text-white border-r border-slate-600 text-xs uppercase tracking-wider">Bölge</TableHead>
                    {Array.from({ length: columnCount }).map((_, i) => (
                      <TableHead key={i} className={`text-center font-bold min-w-[90px] text-xs uppercase tracking-wider text-white border-r border-slate-600 last:border-r-0 ${i % 2 === 0 ? "bg-slate-600" : "bg-slate-700"}`}>
                        {i + 1}. Seans
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRegions.map((region, rowIdx) => (
                    <TableRow key={region.id} className={`h-9 hover:brightness-95 transition-all ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                      <TableCell className="whitespace-nowrap py-0 px-3 bg-slate-100 border-r border-slate-200 text-slate-800 text-xs">
                        <span className="font-semibold">{region.name}</span>
                        <span className="text-slate-400 font-normal ml-1">({region._count.hotels})</span>
                      </TableCell>
                      {Array.from({ length: columnCount }).map((_, i) => {
                        const st = region.sessionTimes[i]
                        return (
                          <TableCell key={i} className={`text-center py-0 px-2 border-r border-slate-100 last:border-r-0 ${i % 2 === 0 ? "" : "bg-blue-50/40"}`}>
                            {st ? (
                              <div className="inline-flex items-center gap-1 group">
                                <button
                                  onClick={() => quotaEnabled ? handleQuotaClick(st, region.name) : undefined}
                                  className={quotaEnabled ? "cursor-pointer" : "cursor-default"}
                                  title={quotaEnabled ? "Kota düzenle" : undefined}
                                >
                                  <span className="font-mono text-sm font-semibold text-slate-700">{st.time}</span>
                                  {quotaEnabled && (
                                    <span className={`ml-1 text-[11px] font-normal ${st.maxQuota > 0 ? "text-orange-500" : "text-slate-400"}`}>
                                      ({st.maxQuota > 0 ? st.maxQuota : "∞"})
                                    </span>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleEditClick(st, region.name)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Düzenle"
                                >
                                  <Pencil className="h-3 w-3 text-blue-400 hover:text-blue-600" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(st, region.name)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Sil"
                                >
                                  <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-200 text-xs select-none">—</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {delegatingRegions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Yönlendirmeli Bölgeler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {delegatingRegions.map((region) => (
                    <div key={region.id} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <Badge variant="outline">{region.name}</Badge>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <Badge variant="secondary">{region.pickupTimeRegion?.name}</Badge>
                      <span className="text-xs text-gray-500">({region._count.hotels} otel)</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Bu bölgeler, yönlendirilen bölgenin saatlerini kullanır.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Saat Ekle Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seans Saati Ekle</DialogTitle>
            <DialogDescription>Bölge ve saat seçerek yeni seans saati ekleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bölge</label>
              <Select value={addRegionId} onValueChange={setAddRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Bölge seçin" />
                </SelectTrigger>
                <SelectContent>
                  {ownTimeRegions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Saat (HH:mm)</label>
              <Input placeholder="Örn: 09:30" value={addTime} onChange={(e) => setAddTime(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }} maxLength={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAdd} disabled={!addRegionId || !addTime || addMutation.isPending}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Düzenle Onay Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seans Saatini Düzenle</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{editingSession?.regionName}</span> bölgesinin{" "}
              <span className="font-semibold">{editingSession?.time}</span> saatini değiştirmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">Yeni Saat (HH:mm)</label>
            <Input value={editTime} onChange={(e) => setEditTime(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEditConfirm() }} maxLength={5} placeholder="Örn: 10:30" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>İptal</Button>
            <Button onClick={handleEditConfirm} disabled={!editTime || editTime === editingSession?.time || editMutation.isPending}>
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seans saatini silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deletingSession?.regionName}</span> bölgesinin{" "}
              <span className="font-semibold">{deletingSession?.time}</span> seans saati kalıcı olarak silinecektir.
              Bu bölgedeki oteller için artık bu saatte rezervasyon yapılamayacaktır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kota Düzenle Dialog */}
      <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kota Düzenle</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{editingQuota?.regionName}</span> bölgesinin{" "}
              <span className="font-semibold">{editingQuota?.time}</span> seansı için maksimum kota belirleyin.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">Maksimum Kota (0 = limitsiz)</label>
            <Input
              type="number"
              min={0}
              value={quotaValue}
              onChange={(e) => setQuotaValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuotaConfirm() }}
              placeholder="Örn: 5"
            />
            <p className="text-xs text-gray-500 mt-1">0 girerseniz bu seans için kota sınırı olmaz.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>İptal</Button>
            <Button onClick={handleQuotaConfirm} disabled={quotaEditMutation.isPending}>
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
