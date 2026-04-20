"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from "date-fns"
import { tr } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { THERAPIST_SERVICE_TYPES, getServicePrim, getServiceLabel } from "@/lib/therapist-constants"
import { toast } from "sonner"
import {
  CalendarIcon, Save, Sparkles, TrendingUp, Users, Plus,
  ChevronLeft, ChevronRight, UserPlus, BarChart3, Zap,
  Table2, Minus, Check, Clock, Award, Star, Trash2,
} from "lucide-react"

type Therapist = { id: string; name: string; isActive: boolean }
type Entry = { id: string; therapistId: string; serviceType: string; count: number; primAmount: number; createdAt: string; createdByUser?: { name: string; email: string } }
type GridData = Record<string, Record<string, number>>

// ── Renk paleti terapistler için ──
const COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
]

const SERVICE_COLORS: Record<string, string> = {
  "20DK": "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100",
  "30DK": "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
  "45DK": "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100",
  "60DK": "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100",
  "75DK": "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100",
  "90DK": "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100",
  "60DK_PAKET": "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
  "90DK_PAKET": "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100",
  "CILT_BAKIMI": "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
  "KESE_KOPUK": "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
}

// ── Animasyonlu sayı ──
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value)
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    if (value !== display) {
      setAnimate(true)
      setDisplay(value)
      const t = setTimeout(() => setAnimate(false), 300)
      return () => clearTimeout(t)
    }
  }, [value])
  return (
    <span className={cn("inline-block transition-transform duration-300", animate && "scale-125", className)}>
      {display.toFixed(2)}
    </span>
  )
}

// ── Pulse efektli buton ──
function PulseButton({
  count, label, primEur, onClick, onDecrement, color,
}: {
  count: number; label: string; primEur: number; onClick: () => void; onDecrement: () => void; color: string
}) {
  const [pulse, setPulse] = useState(false)

  const handleClick = () => {
    setPulse(true)
    onClick()
    setTimeout(() => setPulse(false), 200)
  }

  return (
    <div className={cn("relative rounded-xl border-2 p-3 transition-all duration-200 cursor-pointer select-none", color, pulse && "scale-95")}
      onClick={handleClick}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-sm">{label}</span>
        <span className="text-[11px] font-medium opacity-70">{primEur} €</span>
      </div>
      <div className="flex items-center justify-between">
        <div className={cn(
          "text-3xl font-black tabular-nums transition-all duration-200",
          count > 0 ? "opacity-100" : "opacity-20"
        )}>
          {count}
        </div>
        {count > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onDecrement() }}
            className="h-7 w-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {count > 0 && (
        <div className="text-[11px] font-semibold mt-1 opacity-80">
          = {(count * primEur).toFixed(2)} €
        </div>
      )}
    </div>
  )
}

export default function TerapistlerPage() {
  const queryClient = useQueryClient()
  const today = format(new Date(), "yyyy-MM-dd")
  const [mode, setMode] = useState<"quick" | "table">("quick")

  // ── Quick mode state ──
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null)
  const [quickDate, setQuickDate] = useState(today)
  const [quickCalOpen, setQuickCalOpen] = useState(false)
  const [quickData, setQuickData] = useState<GridData>({})
  const [quickDirty, setQuickDirty] = useState(false)

  // ── Table mode state ──
  const [tableDate, setTableDate] = useState(today)
  const [tableCalOpen, setTableCalOpen] = useState(false)
  const [gridData, setGridData] = useState<GridData>({})
  const [tableDirty, setTableDirty] = useState(false)

  // ── Log mode state ──
  const [logDate, setLogDate] = useState(today)
  const [logCalOpen, setLogCalOpen] = useState(false)

  // ── Common ──
  const [addDialog, setAddDialog] = useState(false)
  const [newName, setNewName] = useState("")

  // ── Stats ──
  const [statsPreset, setStatsPreset] = useState<"today" | "week" | "month" | "prevMonth" | "custom">("month")
  const [statsCustomStart, setStatsCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [statsCustomEnd, setStatsCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"))

  const statsRange = useMemo(() => {
    const n = new Date()
    switch (statsPreset) {
      case "today": return { start: format(n, "yyyy-MM-dd"), end: format(n, "yyyy-MM-dd") }
      case "week": return { start: format(startOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(n, { weekStartsOn: 1 }), "yyyy-MM-dd") }
      case "month": return { start: format(startOfMonth(n), "yyyy-MM-dd"), end: format(endOfMonth(n), "yyyy-MM-dd") }
      case "prevMonth": { const pm = subMonths(n, 1); return { start: format(startOfMonth(pm), "yyyy-MM-dd"), end: format(endOfMonth(pm), "yyyy-MM-dd") } }
      case "custom": return { start: statsCustomStart, end: statsCustomEnd }
    }
  }, [statsPreset, statsCustomStart, statsCustomEnd])

  // ── Queries ──
  const { data: therapists = [], isLoading: tLoading } = useQuery<Therapist[]>({
    queryKey: ["therapists"],
    queryFn: () => fetch("/api/terapistler").then(r => r.json()),
  })

  const activeTherapists = useMemo(() => therapists.filter(t => t.isActive), [therapists])

  // Quick mode entries
  const { data: quickEntries = [], isLoading: qeLoading } = useQuery<Entry[]>({
    queryKey: ["therapist-entries", quickDate],
    queryFn: () => fetch(`/api/terapistler/entries?date=${quickDate}`).then(r => r.json()),
  })

  // Table mode entries
  const { data: tableEntries = [], isLoading: teLoading } = useQuery<Entry[]>({
    queryKey: ["therapist-entries", tableDate],
    queryFn: () => fetch(`/api/terapistler/entries?date=${tableDate}`).then(r => r.json()),
  })

  // Log mode entries
  const { data: logEntries = [], isLoading: logLoading } = useQuery<Entry[]>({
    queryKey: ["therapist-entries", logDate],
    queryFn: () => fetch(`/api/terapistler/entries?date=${logDate}`).then(r => r.json()),
  })

  const { data: statsData } = useQuery({
    queryKey: ["therapist-stats", statsRange.start, statsRange.end],
    queryFn: () => fetch(`/api/terapistler/stats?startDate=${statsRange.start}&endDate=${statsRange.end}`).then(r => r.json()),
  })

  // ── Initialize quick data ──
  useEffect(() => {
    if (qeLoading) return
    const g: GridData = {}
    for (const t of activeTherapists) {
      g[t.id] = {}
      for (const st of THERAPIST_SERVICE_TYPES) {
        const entry = quickEntries.find(e => e.therapistId === t.id && e.serviceType === st.code)
        g[t.id][st.code] = entry?.count ?? 0
      }
    }
    setQuickData(g)
    setQuickDirty(false)
  }, [quickEntries, activeTherapists, qeLoading])

  // ── Initialize table data ──
  useEffect(() => {
    if (teLoading) return
    const g: GridData = {}
    for (const t of activeTherapists) {
      g[t.id] = {}
      for (const st of THERAPIST_SERVICE_TYPES) {
        const entry = tableEntries.find(e => e.therapistId === t.id && e.serviceType === st.code)
        g[t.id][st.code] = entry?.count ?? 0
      }
    }
    setGridData(g)
    setTableDirty(false)
  }, [tableEntries, activeTherapists, teLoading])

  // Auto-select first therapist
  useEffect(() => {
    if (!selectedTherapist && activeTherapists.length > 0) {
      setSelectedTherapist(activeTherapists[0].id)
    }
  }, [activeTherapists, selectedTherapist])

  // ── Save mutation factory ──
  const createSaveMutation = (dateVal: string, data: GridData, setDirtyFn: (v: boolean) => void) => ({
    mutationFn: async () => {
      const allEntries: { therapistId: string; serviceType: string; count: number }[] = []
      for (const [tid, services] of Object.entries(data)) {
        for (const [stype, count] of Object.entries(services)) {
          allEntries.push({ therapistId: tid, serviceType: stype, count })
        }
      }
      const res = await fetch("/api/terapistler/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateVal, entries: allEntries }),
      })
      if (!res.ok) throw new Error()
    },
    onSuccess: () => {
      toast.success("Kaydedildi!")
      setDirtyFn(false)
      queryClient.invalidateQueries({ queryKey: ["therapist-entries"] })
      queryClient.invalidateQueries({ queryKey: ["therapist-stats"] })
    },
    onError: () => toast.error("Kayıt başarısız"),
  })

  const quickSaveMutation = useMutation(createSaveMutation(quickDate, quickData, setQuickDirty))
  const tableSaveMutation = useMutation(createSaveMutation(tableDate, gridData, setTableDirty))

  const addTherapistMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/terapistler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error()
    },
    onSuccess: () => {
      toast.success("Terapist eklendi")
      setNewName("")
      setAddDialog(false)
      queryClient.invalidateQueries({ queryKey: ["therapists"] })
    },
    onError: () => toast.error("Ekleme başarısız"),
  })

  const deleteDayMutation = useMutation({
    mutationFn: async ({ date, therapistId }: { date: string; therapistId?: string }) => {
      const res = await fetch("/api/terapistler/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, therapistId }),
      })
      if (!res.ok) throw new Error()
    },
    onSuccess: (_, vars) => {
      toast.success(vars.therapistId ? "Terapist girişleri silindi" : "Günün girişleri silindi")
      queryClient.invalidateQueries({ queryKey: ["therapist-entries"] })
      queryClient.invalidateQueries({ queryKey: ["therapist-stats"] })
    },
    onError: () => toast.error("Silme başarısız"),
  })

  // ── Quick mode handlers ──
  const quickIncrement = (therapistId: string, serviceType: string) => {
    setQuickData(prev => ({
      ...prev,
      [therapistId]: { ...prev[therapistId], [serviceType]: (prev[therapistId]?.[serviceType] ?? 0) + 1 },
    }))
    setQuickDirty(true)
  }

  const quickDecrement = (therapistId: string, serviceType: string) => {
    setQuickData(prev => ({
      ...prev,
      [therapistId]: { ...prev[therapistId], [serviceType]: Math.max(0, (prev[therapistId]?.[serviceType] ?? 0) - 1) },
    }))
    setQuickDirty(true)
  }

  // ── Table mode handlers ──
  const updateCell = useCallback((therapistId: string, serviceType: string, value: number) => {
    setGridData(prev => ({
      ...prev,
      [therapistId]: { ...prev[therapistId], [serviceType]: Math.max(0, value) },
    }))
    setTableDirty(true)
  }, [])

  // ── Computed values ──
  const getTotal = (data: GridData, therapistId: string) => {
    const services = data[therapistId] ?? {}
    return Object.entries(services).reduce((sum, [code, count]) => sum + count * getServicePrim(code), 0)
  }
  const getCount = (data: GridData, therapistId: string) => {
    const services = data[therapistId] ?? {}
    return Object.values(services).reduce((sum, count) => sum + count, 0)
  }

  const quickGrandTotal = useMemo(() => activeTherapists.reduce((s, t) => s + getTotal(quickData, t.id), 0), [activeTherapists, quickData])
  const quickGrandCount = useMemo(() => activeTherapists.reduce((s, t) => s + getCount(quickData, t.id), 0), [activeTherapists, quickData])

  const tableGrandTotal = useMemo(() => activeTherapists.reduce((s, t) => s + getTotal(gridData, t.id), 0), [activeTherapists, gridData])
  const tableGrandCount = useMemo(() => activeTherapists.reduce((s, t) => s + getCount(gridData, t.id), 0), [activeTherapists, gridData])

  const navigateDate = (current: string, dir: -1 | 1, setter: (v: string) => void) => {
    const d = new Date(current)
    d.setDate(d.getDate() + dir)
    setter(format(d, "yyyy-MM-dd"))
  }

  if (tLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
        <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Yükleniyor...</span>
      </div>
    )
  }

  const selectedT = activeTherapists.find(t => t.id === selectedTherapist)
  const selectedTotal = selectedTherapist ? getTotal(quickData, selectedTherapist) : 0
  const selectedCount = selectedTherapist ? getCount(quickData, selectedTherapist) : 0

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Terapistler</h1>
            <p className="text-xs text-gray-500">{activeTherapists.length} aktif terapist</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddDialog(true)}>
            <UserPlus className="h-4 w-4" /> Terapist Ekle
          </Button>
        </div>
      </div>

      {/* ═══ MAIN TABS ════════════════════════════════════════════════════════ */}
      <Tabs defaultValue="quick" onValueChange={v => setMode(v as any)} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 h-11">
          <TabsTrigger value="quick" className="gap-1.5 text-sm">
            <Zap className="h-4 w-4" /> Anlık Giriş
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5 text-sm">
            <Table2 className="h-4 w-4" /> Toplu Giriş Yap
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-sm">
            <Clock className="h-4 w-4" /> Giriş Listesi
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 text-sm">
            <BarChart3 className="h-4 w-4" /> İstatistikler
          </TabsTrigger>
        </TabsList>

        {/* ══ TAB 1: ANLIK GİRİŞ ═══════════════════════════════════════════ */}
        <TabsContent value="quick" className="space-y-4 mt-0">
          {/* Date + Save bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(quickDate, -1, setQuickDate)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={quickCalOpen} onOpenChange={setQuickCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 text-sm font-medium min-w-[200px]">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(quickDate + "T12:00:00"), "d MMMM yyyy, EEEE", { locale: tr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={new Date(quickDate + "T12:00:00")}
                    onSelect={d => { if (d) { setQuickDate(format(d, "yyyy-MM-dd")); setQuickCalOpen(false) } }} locale={tr} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(quickDate, 1, setQuickDate)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3 sm:ml-auto">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500"><span className="font-semibold text-gray-900">{quickGrandCount}</span> hizmet</span>
                <span className="text-lg font-black text-purple-600"><AnimatedNumber value={quickGrandTotal} /> €</span>
              </div>
              <Button variant="destructive" size="sm" className="gap-1.5"
                disabled={deleteDayMutation.isPending || quickGrandCount === 0}
                onClick={() => { if (confirm("Bu günün tüm girişleri silinecek. Emin misiniz?")) deleteDayMutation.mutate({ date: quickDate }) }}>
                <Trash2 className="h-4 w-4" /> Günü Sil
              </Button>
              <Button className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-200"
                disabled={!quickDirty || quickSaveMutation.isPending}
                onClick={() => quickSaveMutation.mutate()}>
                {quickSaveMutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : <Save className="h-4 w-4" />}
                {quickSaveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Therapist picker */}
            <div className="lg:col-span-3 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Terapist Seç</h3>
              <div className="space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                {activeTherapists.map((t, i) => {
                  const isSelected = selectedTherapist === t.id
                  const total = getTotal(quickData, t.id)
                  const count = getCount(quickData, t.id)
                  const gradient = COLORS[i % COLORS.length]
                  return (
                    <button key={t.id} onClick={() => setSelectedTherapist(t.id)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl p-3 transition-all duration-200 text-left",
                        isSelected
                          ? "bg-gradient-to-r " + gradient + " text-white shadow-lg scale-[1.02]"
                          : "bg-white hover:bg-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-sm"
                      )}>
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
                        isSelected ? "bg-white/20" : "bg-gradient-to-br " + gradient + " text-white"
                      )}>
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-semibold text-sm truncate", !isSelected && "text-gray-900")}>{t.name}</div>
                        {count > 0 && (
                          <div className={cn("text-xs", isSelected ? "text-white/80" : "text-gray-500")}>
                            {count} hizmet · {total.toFixed(2)} €
                          </div>
                        )}
                      </div>
                      {count > 0 && (
                        <div className={cn(
                          "h-6 min-w-[24px] px-1.5 rounded-full flex items-center justify-center text-xs font-bold",
                          isSelected ? "bg-white/25" : "bg-purple-100 text-purple-700"
                        )}>
                          {count}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Service buttons */}
            <div className="lg:col-span-9 space-y-4">
              {selectedT && (
                <>
                  {/* Selected therapist header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-lg",
                        COLORS[activeTherapists.findIndex(t => t.id === selectedTherapist) % COLORS.length]
                      )}>
                        {selectedT.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedT.name}</h2>
                        <p className="text-xs text-gray-500">
                          {selectedCount > 0
                            ? `${selectedCount} hizmet yapıldı`
                            : "Henüz hizmet girilmedi"
                          }
                        </p>
                      </div>
                    </div>
                    {selectedCount > 0 && (
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          disabled={deleteDayMutation.isPending}
                          onClick={() => {
                            if (confirm(`${selectedT.name} — bu güne ait tüm girişler silinecek. Emin misiniz?`)) {
                              deleteDayMutation.mutate({ date: quickDate, therapistId: selectedTherapist! })
                            }
                          }}>
                          <Trash2 className="h-3.5 w-3.5" /> Temizle
                        </Button>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Toplam Prim</div>
                          <div className="text-2xl font-black text-purple-600">
                            <AnimatedNumber value={selectedTotal} /> €
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Service grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {THERAPIST_SERVICE_TYPES.map(st => (
                      <PulseButton
                        key={st.code}
                        count={quickData[selectedTherapist!]?.[st.code] ?? 0}
                        label={st.label}
                        primEur={st.primEur}
                        color={SERVICE_COLORS[st.code]}
                        onClick={() => quickIncrement(selectedTherapist!, st.code)}
                        onDecrement={() => quickDecrement(selectedTherapist!, st.code)}
                      />
                    ))}
                  </div>

                  {/* Quick summary for selected */}
                  {selectedCount > 0 && (
                    <Card className="border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex flex-wrap gap-2">
                          {THERAPIST_SERVICE_TYPES.filter(st => (quickData[selectedTherapist!]?.[st.code] ?? 0) > 0).map(st => {
                            const c = quickData[selectedTherapist!][st.code]
                            return (
                              <div key={st.code} className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1.5 shadow-sm text-xs">
                                <span className="font-semibold text-gray-700">{st.label}</span>
                                <span className="text-gray-400">×</span>
                                <span className="font-bold text-gray-900">{c}</span>
                                <span className="text-purple-600 font-semibold">= {(c * st.primEur).toFixed(2)} €</span>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══ TAB 2: GÜNLÜK TABLO ═══════════════════════════════════════════ */}
        <TabsContent value="table" className="space-y-4 mt-0">
          {/* Date + Save bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(tableDate, -1, setTableDate)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={tableCalOpen} onOpenChange={setTableCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 text-sm font-medium min-w-[200px]">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(tableDate + "T12:00:00"), "d MMMM yyyy, EEEE", { locale: tr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={new Date(tableDate + "T12:00:00")}
                    onSelect={d => { if (d) { setTableDate(format(d, "yyyy-MM-dd")); setTableCalOpen(false) } }} locale={tr} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(tableDate, 1, setTableDate)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3 sm:ml-auto">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500"><span className="font-semibold text-gray-900">{tableGrandCount}</span> hizmet</span>
                <span className="text-lg font-black text-purple-600">{tableGrandTotal.toFixed(2)} €</span>
              </div>
              <Button variant="destructive" size="sm" className="gap-1.5"
                disabled={deleteDayMutation.isPending || tableGrandCount === 0}
                onClick={() => { if (confirm("Bu günün tüm girişleri silinecek. Emin misiniz?")) deleteDayMutation.mutate({ date: tableDate }) }}>
                <Trash2 className="h-4 w-4" /> Günü Sil
              </Button>
              <Button className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-200"
                disabled={!tableDirty || tableSaveMutation.isPending}
                onClick={() => tableSaveMutation.mutate()}>
                {tableSaveMutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : <Save className="h-4 w-4" />}
                {tableSaveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>

          {/* Grid table */}
          {teLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-gray-50 to-slate-50">
                        <th className="text-left p-3 font-semibold text-gray-700 sticky left-0 bg-gradient-to-r from-gray-50 to-slate-50 min-w-[140px] z-10">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-purple-500" /> Terapist
                          </div>
                        </th>
                        {THERAPIST_SERVICE_TYPES.map(st => (
                          <th key={st.code} className="text-center p-2 font-medium text-gray-600 min-w-[72px]">
                            <div className="text-xs">{st.label}</div>
                            <div className="text-[10px] text-purple-500 font-normal mt-0.5">{st.primEur} €</div>
                          </th>
                        ))}
                        <th className="text-center p-2 font-semibold text-gray-700 min-w-[56px]">
                          <div className="text-xs">Adet</div>
                        </th>
                        <th className="text-center p-2 font-semibold text-purple-700 min-w-[80px]">
                          <div className="text-xs flex items-center justify-center gap-1"><Award className="h-3 w-3" /> Prim</div>
                        </th>
                        <th className="text-center p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTherapists.map((t, i) => {
                        const total = getTotal(gridData, t.id)
                        const count = getCount(gridData, t.id)
                        const gradient = COLORS[i % COLORS.length]
                        return (
                          <tr key={t.id} className={cn(
                            "border-b transition-colors",
                            count > 0 ? "bg-purple-50/30" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                          )}>
                            <td className="p-3 sticky left-0 bg-inherit z-10">
                              <div className="flex items-center gap-2">
                                <div className={cn("h-7 w-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold", gradient)}>
                                  {t.name.charAt(0)}
                                </div>
                                <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                              </div>
                            </td>
                            {THERAPIST_SERVICE_TYPES.map(st => (
                              <td key={st.code} className="p-1 text-center">
                                <Input type="number" min={0}
                                  className={cn(
                                    "h-8 w-14 mx-auto text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors",
                                    (gridData[t.id]?.[st.code] ?? 0) > 0 && "bg-purple-50 border-purple-200 font-semibold text-purple-700"
                                  )}
                                  value={gridData[t.id]?.[st.code] ?? 0}
                                  onChange={e => updateCell(t.id, st.code, parseInt(e.target.value) || 0)} />
                              </td>
                            ))}
                            <td className="p-2 text-center">
                              <span className={cn("font-medium", count > 0 ? "text-gray-900" : "text-gray-300")}>{count}</span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={cn("font-bold", total > 0 ? "text-purple-600" : "text-gray-300")}>{total.toFixed(2)} €</span>
                            </td>
                            <td className="p-1 text-center">
                              {count > 0 && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    if (confirm(`${t.name} — bu güne ait girişler silinecek. Emin misiniz?`)) {
                                      deleteDayMutation.mutate({ date: tableDate, therapistId: t.id })
                                    }
                                  }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-purple-50 to-indigo-50 border-t-2 border-purple-200">
                        <td className="p-3 font-bold text-gray-900 sticky left-0 bg-gradient-to-r from-purple-50 to-indigo-50 z-10">
                          <div className="flex items-center gap-1.5">
                            <Star className="h-4 w-4 text-purple-500" /> Toplam
                          </div>
                        </td>
                        {THERAPIST_SERVICE_TYPES.map(st => {
                          const colTotal = activeTherapists.reduce((s, t) => s + (gridData[t.id]?.[st.code] ?? 0), 0)
                          return (
                            <td key={st.code} className="p-2 text-center font-semibold text-gray-700">
                              {colTotal > 0 ? colTotal : <span className="text-gray-300">-</span>}
                            </td>
                          )
                        })}
                        <td className="p-2 text-center font-bold text-gray-900">{tableGrandCount}</td>
                        <td className="p-2 text-center font-black text-purple-700 text-base">{tableGrandTotal.toFixed(2)} €</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ TAB 3: GİRİŞ LİSTESİ ═══════════════════════════════════════ */}
        <TabsContent value="logs" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(logDate, -1, setLogDate)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={logCalOpen} onOpenChange={setLogCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 text-sm font-medium min-w-[200px]">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(logDate + "T12:00:00"), "d MMMM yyyy, EEEE", { locale: tr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={new Date(logDate + "T12:00:00")}
                    onSelect={d => { if (d) { setLogDate(format(d, "yyyy-MM-dd")); setLogCalOpen(false) } }} locale={tr} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(logDate, 1, setLogDate)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="sm:ml-auto text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{logEntries.filter(e => e.count > 0).length}</span> kayıt
            </div>
          </div>

          {logLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logEntries.filter(e => e.count > 0).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Clock className="h-10 w-10 mb-3 text-gray-300" />
                <p className="text-sm font-medium">Bu tarihte giriş bulunamadı</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-gray-50 to-slate-50">
                        <th className="text-left p-3 font-semibold text-gray-700">Terapist</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Hizmet</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Adet</th>
                        <th className="text-center p-3 font-semibold text-purple-700">Prim</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Giren Kullanıcı</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Saat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logEntries
                        .filter(e => e.count > 0)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((entry, i) => {
                          const t = activeTherapists.find(t => t.id === entry.therapistId)
                          const gradient = COLORS[activeTherapists.findIndex(t => t.id === entry.therapistId) % COLORS.length]
                          return (
                            <tr key={entry.id} className={cn("border-b transition-colors hover:bg-purple-50/30", i % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className={cn("h-7 w-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold", gradient)}>
                                    {t?.name.charAt(0) ?? "?"}
                                  </div>
                                  <span className="font-medium text-gray-900">{t?.name ?? "—"}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", SERVICE_COLORS[entry.serviceType] || "bg-gray-50 border-gray-200 text-gray-700")}>
                                  {getServiceLabel(entry.serviceType)}
                                </span>
                              </td>
                              <td className="p-3 text-center font-semibold text-gray-900">{entry.count}</td>
                              <td className="p-3 text-center font-bold text-purple-600">{entry.primAmount.toFixed(2)} €</td>
                              <td className="p-3">
                                <div>
                                  <div className="font-medium text-gray-900 text-xs">{entry.createdByUser?.name ?? "—"}</div>
                                  <div className="text-[10px] text-gray-400">{entry.createdByUser?.email ?? ""}</div>
                                </div>
                              </td>
                              <td className="p-3 text-xs text-gray-500">
                                {format(new Date(entry.createdAt), "HH:mm", { locale: tr })}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ TAB 4: İSTATİSTİKLER ══════════════════════════════════════════ */}
        <TabsContent value="stats" className="space-y-4 mt-0">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "today", label: "Bugün" },
              { key: "week", label: "Bu Hafta" },
              { key: "month", label: "Bu Ay" },
              { key: "prevMonth", label: "Geçen Ay" },
              { key: "custom", label: "Özel" },
            ] as const).map(b => (
              <Button key={b.key} size="sm" variant={statsPreset === b.key ? "default" : "outline"}
                className={cn("h-8 text-xs", statsPreset === b.key && "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700")}
                onClick={() => setStatsPreset(b.key)}>
                {b.label}
              </Button>
            ))}
            {statsPreset === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" className="h-8 text-xs w-36" value={statsCustomStart} onChange={e => setStatsCustomStart(e.target.value)} />
                <span className="text-xs text-gray-400">—</span>
                <Input type="date" className="h-8 text-xs w-36" value={statsCustomEnd} onChange={e => setStatsCustomEnd(e.target.value)} />
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur"><Users className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs text-white/70">Aktif Terapist</p>
                    <p className="text-3xl font-black">{activeTherapists.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur"><BarChart3 className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs text-white/70">Toplam Hizmet</p>
                    <p className="text-3xl font-black">{statsData?.grandTotalCount ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur"><TrendingUp className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs text-white/70">Toplam Prim</p>
                    <p className="text-3xl font-black">{(statsData?.grandTotalPrim ?? 0).toFixed(2)} €</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard style stats */}
          {statsData?.byTherapist && Object.keys(statsData.byTherapist).length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" /> Terapist Prim Sıralaması
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-gray-50 to-slate-50">
                        <th className="text-center p-3 font-medium text-gray-500 w-10">#</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Terapist</th>
                        {THERAPIST_SERVICE_TYPES.map(st => (
                          <th key={st.code} className="text-center p-2 font-medium text-gray-600 text-xs">{st.label}</th>
                        ))}
                        <th className="text-center p-2 font-semibold text-gray-700">Toplam</th>
                        <th className="text-center p-2 font-semibold text-purple-700 min-w-[90px]">Prim (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(statsData.byTherapist)
                        .sort(([, a]: any, [, b]: any) => b.totalPrim - a.totalPrim)
                        .map(([tid, t]: any, i: number) => {
                          const gradient = COLORS[i % COLORS.length]
                          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null
                          return (
                            <tr key={tid} className={cn("border-b transition-colors hover:bg-purple-50/30", i < 3 && "bg-amber-50/20")}>
                              <td className="p-3 text-center">
                                {medal ? <span className="text-lg">{medal}</span> : <span className="text-xs text-gray-400 font-medium">{i + 1}</span>}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className={cn("h-7 w-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold", gradient)}>
                                    {t.name.charAt(0)}
                                  </div>
                                  <span className="font-medium text-gray-900">{t.name}</span>
                                </div>
                              </td>
                              {THERAPIST_SERVICE_TYPES.map(st => (
                                <td key={st.code} className="p-2 text-center text-gray-600">
                                  {t.byService[st.code]?.count || <span className="text-gray-200">-</span>}
                                </td>
                              ))}
                              <td className="p-2 text-center font-semibold text-gray-700">{t.totalCount}</td>
                              <td className="p-2 text-center">
                                <span className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold",
                                  i === 0 ? "bg-amber-100 text-amber-700" :
                                  i < 3 ? "bg-purple-100 text-purple-700" :
                                  "text-purple-600"
                                )}>
                                  {t.totalPrim.toFixed(2)} €
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-purple-50 to-indigo-50 border-t-2 border-purple-200">
                        <td className="p-3" />
                        <td className="p-3 font-bold text-gray-900 flex items-center gap-1.5">
                          <Star className="h-4 w-4 text-purple-500" /> Genel Toplam
                        </td>
                        {THERAPIST_SERVICE_TYPES.map(st => {
                          const colTotal = Object.values(statsData.byTherapist as any).reduce((s: number, t: any) => s + (t.byService[st.code]?.count ?? 0), 0) as number
                          return <td key={st.code} className="p-2 text-center font-semibold text-gray-700">{colTotal || ""}</td>
                        })}
                        <td className="p-2 text-center font-bold text-gray-900">{statsData.grandTotalCount}</td>
                        <td className="p-2 text-center font-black text-purple-700 text-lg">{statsData.grandTotalPrim.toFixed(2)} €</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BarChart3 className="h-10 w-10 mb-3 text-gray-300" />
                <p className="text-sm font-medium">Bu dönemde kayıt bulunamadı</p>
                <p className="text-xs mt-1">Farklı bir tarih aralığı deneyin</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ ADD THERAPIST DIALOG ═══════════════════════════════════════════ */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-purple-600" /> Yeni Terapist Ekle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Terapist adı" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && newName.trim() && addTherapistMutation.mutate()} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialog(false)}>İptal</Button>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                disabled={!newName.trim() || addTherapistMutation.isPending}
                onClick={() => addTherapistMutation.mutate()}>
                <Plus className="h-4 w-4 mr-1" /> Ekle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
