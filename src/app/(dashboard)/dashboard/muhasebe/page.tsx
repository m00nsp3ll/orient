"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { tr } from "date-fns/locale"
import {
  TrendingUp, TrendingDown, ArrowLeftRight, BarChart3,
  CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, Plus, PenLine, Trash2,
  FileDown, Users, Building2, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getCurrencySymbol } from "@/lib/currency-utils"
import { EXPENSE_CATEGORIES, INCOME_SUB_CATEGORIES } from "@/lib/accounting-constants"

// ── Sabitler ──────────────────────────────────────────────────────────────────
const CURRENCIES = ["TRY", "EUR", "USD", "GBP"]
const CUR_META: Record<string, { symbol: string; bg: string; light: string }> = {
  TRY: { symbol: "₺", bg: "bg-orange-500",  light: "bg-orange-50 text-orange-700 border-orange-200" },
  EUR: { symbol: "€", bg: "bg-blue-600",    light: "bg-blue-50 text-blue-700 border-blue-200" },
  USD: { symbol: "$", bg: "bg-emerald-600", light: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  GBP: { symbol: "£", bg: "bg-purple-600",  light: "bg-purple-50 text-purple-700 border-purple-200" },
}

type SortDir = "asc" | "desc" | null

// ── Tipler ────────────────────────────────────────────────────────────────────
type OzetData = {
  totalIncome:  Record<string, number>
  totalExpense: Record<string, number>
  byCategory:   Array<{
    accountCode: string; label: string; type: string
    totals: Record<string, { debit: number; credit: number }>
  }>
}
type CariAccount = {
  accountCode: string; label: string; type: string
  balances: Record<string, { debit: number; credit: number; bakiye: number }>
  agencyId?: string
  agencyCurrency?: string
}
type DetailEntry = {
  id: string; date: string; debit: number; credit: number; currency: string
  description: string | null; runningBalance: number; transferGroupId: string | null
  cashEntry: { voucherNo: number; date: string } | null
  staff: { name: string } | null
  agency: { name: string } | null
}
type DetailData = {
  accountCode: string; label: string
  entries: DetailEntry[]
  summary: Record<string, { totalDebit: number; totalCredit: number; bakiye: number }>
}
type StaffItem = { id: string; commissionRate: number | null; user: { name: string } }
type AgencyItem = { id: string; companyName: string; name: string; currency: string }

type AcentaDetayPreset = "today" | "week" | "month" | "all" | "custom"

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function fmtAmt(amount: number, currency: string) {
  const sym = getCurrencySymbol(currency)
  return `${sym}${Math.abs(amount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCur(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amount)
}

function localDateRange(preset: string, customStart: string, customEnd: string) {
  const now = new Date()
  if (preset === "all") {
    return { startStr: "2020-01-01", endStr: format(new Date(now.getFullYear() + 2, 11, 31), "yyyy-MM-dd") }
  }
  if (preset === "today") { const d = format(now, "yyyy-MM-dd"); return { startStr: d, endStr: d } }
  if (preset === "week") {
    return { startStr: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), endStr: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") }
  }
  if (preset === "month") {
    return { startStr: format(startOfMonth(now), "yyyy-MM-dd"), endStr: format(endOfMonth(now), "yyyy-MM-dd") }
  }
  return { startStr: customStart, endStr: customEnd }
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-1">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc")  return <ArrowUp className="h-3 w-3 text-blue-600 inline ml-1" />
  if (dir === "desc") return <ArrowDown className="h-3 w-3 text-blue-600 inline ml-1" />
  return <ArrowUpDown className="h-3 w-3 text-gray-400 inline ml-1" />
}

// ── DatePicker mini ───────────────────────────────────────────────────────────
function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-9 justify-start gap-2 text-sm">
          <CalendarIcon className="h-3.5 w-3.5" />
          {format(new Date(value + "T12:00:00"), "dd.MM.yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={new Date(value + "T12:00:00")} locale={tr}
          onSelect={d => { if (d) { onChange(format(d, "yyyy-MM-dd")); setOpen(false) } }} />
      </PopoverContent>
    </Popover>
  )
}

// ── Acenta Cari Detay Dialog ──────────────────────────────────────────────────
function AcentaCariDialog({
  open, onClose, agencyId, agencyName, agencyCurrency, balance, onRefresh,
}: {
  open: boolean; onClose: () => void
  agencyId: string; agencyName: string; agencyCurrency: string
  balance: Record<string, { debit: number; credit: number; bakiye: number }>
  onRefresh?: () => void
}) {
  const queryClient = useQueryClient()
  const now = new Date()
  const [preset, setPreset]       = useState<AcentaDetayPreset>("all")
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"))
  const [customEnd,   setCustomEnd]   = useState(format(now, "yyyy-MM-dd"))
  const [startOpen,   setStartOpen]   = useState(false)
  const [endOpen,     setEndOpen]     = useState(false)
  const [search, setSearch] = useState("")
  const printRef = useRef<HTMLDivElement>(null)

  const { startStr, endStr } = localDateRange(preset, customStart, customEnd)

  const { data: stats, isLoading } = useQuery({
    queryKey: ["acenta-cari-detay", agencyId, startStr, endStr],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: "custom",
        startDate: startStr,
        endDate: endStr,
        agencyId,
      })
      const res = await fetch(`/api/statistics?${params}`)
      if (!res.ok) throw new Error("Yüklenemedi")
      return res.json()
    },
    enabled: open,
  })

  const { data: odemeler, refetch: refetchOdemeler } = useQuery<any[]>({
    queryKey: ["acenta-odemeler", agencyId],
    queryFn: async () => {
      const params = new URLSearchParams({ agencyId })
      const res = await fetch(`/api/muhasebe/acenta-odemeler?${params}`)
      if (!res.ok) throw new Error("Yüklenemedi")
      return res.json()
    },
    enabled: open,
    staleTime: 0,
  })

  useEffect(() => {
    if (open) refetchOdemeler()
  }, [open])

  const customers: any[] = stats?.customers ?? []
  const filtered = customers.filter(c =>
    !search ||
    c.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    c.voucherNo?.toLowerCase().includes(search.toLowerCase()) ||
    c.hotelName?.toLowerCase().includes(search.toLowerCase())
  )
  // Tarihe göre sırala
  const sorted = [...filtered].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  const totalPax = sorted.reduce((s, c) => s + (c.pax || 0), 0)
  const totalChild = sorted.reduce((s, c) => s + (c.childCount || 0), 0)
  const totalRevenue = sorted.reduce((s, c) => s + (c.price || 0), 0)

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>${agencyName} — Cari Hesap Ekstresi</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
            h1 { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .subtitle { font-size: 11px; color: #555; margin-bottom: 16px; }
            .summary { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
            .summary-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 14px; min-width: 120px; }
            .summary-card .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
            .summary-card .value { font-size: 14px; font-weight: bold; color: #111; margin-top: 2px; }
            .balance-section { margin-bottom: 16px; }
            .balance-row { display: flex; gap: 24px; }
            .balance-item { font-size: 11px; }
            .balance-item .cur { font-weight: bold; color: #333; }
            .balance-item .bak { font-weight: bold; }
            .bak-red { color: #dc2626; }
            .bak-green { color: #059669; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #f5f5f5; border: 1px solid #ddd; padding: 5px 7px; text-align: left; font-weight: 600; }
            td { border: 1px solid #eee; padding: 5px 7px; vertical-align: top; }
            tr:nth-child(even) td { background: #fafafa; }
            .rest-badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; padding: 1px 5px; font-size: 9px; }
            .ok-badge { display: inline-block; background: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; border-radius: 4px; padding: 1px 5px; font-size: 9px; }
            .footer { margin-top: 20px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>${agencyName}</h1>
          <div class="subtitle">Cari Hesap Ekstresi · ${format(new Date(startStr + "T12:00:00"), "dd.MM.yyyy")} – ${format(new Date(endStr + "T12:00:00"), "dd.MM.yyyy")}</div>

          <div class="summary">
            <div class="summary-card"><div class="label">Toplam Randevu</div><div class="value">${sorted.length}</div></div>
            <div class="summary-card"><div class="label">Toplam PAX</div><div class="value">${totalPax}${totalChild > 0 ? `+${totalChild}` : ""}</div></div>
            <div class="summary-card"><div class="label">Dönem Cirosu</div><div class="value">${fmtCur(totalRevenue, agencyCurrency)}</div></div>
          </div>

          ${Object.entries(balance).length > 0 ? `
          <div class="balance-section">
            <div style="font-size:10px;font-weight:600;margin-bottom:6px;color:#555;">CARİ BAKİYE</div>
            <div class="balance-row">
              ${Object.entries(balance).map(([cur, v]) => `
                <div class="balance-item">
                  <span class="cur">${cur}:</span>
                  <span class="bak ${v.bakiye > 0 ? "bak-red" : "bak-green"}">
                    ${v.bakiye > 0 ? `${fmtAmt(v.bakiye, cur)} borç` : v.bakiye < 0 ? `${fmtAmt(Math.abs(v.bakiye), cur)} alacak` : "Sıfır"}
                  </span>
                </div>
              `).join("")}
            </div>
          </div>` : ""}

          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Saat</th>
                <th>Müşteri</th>
                <th>PAX</th>
                <th>Otel</th>
                <th>Program</th>
                <th>Tutar</th>
                <th>Voucher</th>
                <th>Ödeme</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(c => `
                <tr>
                  <td>${format(new Date(c.time), "dd.MM.yyyy")}</td>
                  <td>${new Date(c.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>${c.customerName || "-"}</td>
                  <td>${c.pax || 0}${c.childCount > 0 ? `+${c.childCount}` : ""}</td>
                  <td>${c.hotelName || "-"}</td>
                  <td>${c.serviceName || "-"}</td>
                  <td>${fmtCur(c.price || 0, c.currency || agencyCurrency)}</td>
                  <td>${c.voucherNo || "-"}</td>
                  <td>${c.restAmount ? `<span class="rest-badge">REST ${c.restAmount} ${c.restCurrency}</span>` : `<span class="ok-badge">Acenta</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">Orient SPA · ${format(new Date(), "dd.MM.yyyy HH:mm")} tarihinde oluşturuldu</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print() }, 400)
  }

  const presetLabel =
    preset === "today" ? "Bugün" :
    preset === "week"  ? "Bu Hafta" :
    preset === "month" ? "Bu Ay" :
    preset === "all"   ? "Tüm Zamanlar" :
    `${format(new Date(startStr + "T12:00:00"), "dd.MM.yyyy")} – ${format(new Date(endStr + "T12:00:00"), "dd.MM.yyyy")}`

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-full !max-w-[960px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-10">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                {agencyName} — Cari Ekstresi
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">{presetLabel}</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 shrink-0" onClick={handlePrint}>
              <FileDown className="h-3.5 w-3.5" /> PDF Aktar
            </Button>
          </div>
        </DialogHeader>

        <div ref={printRef} className="space-y-4">
          {/* Tarih Filtresi */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-3">
            <Button size="sm" variant={preset === "all" ? "default" : "outline"}
              className={cn("h-7 text-xs", preset === "all" && "bg-blue-600 hover:bg-blue-700")}
              onClick={() => setPreset("all")}>
              Tümü
            </Button>
            <div className="w-px h-4 bg-gray-300" />
            {(["today", "week", "month"] as const).map(p => (
              <Button key={p} size="sm" variant={preset === p ? "default" : "outline"}
                className={cn("h-7 text-xs", preset === p && "bg-blue-600 hover:bg-blue-700")}
                onClick={() => setPreset(p)}>
                {p === "today" ? "Bugün" : p === "week" ? "Bu Hafta" : "Bu Ay"}
              </Button>
            ))}
            <div className="w-px h-4 bg-gray-300" />
            <Button size="sm" variant={preset === "custom" ? "default" : "outline"}
              className={cn("h-7 text-xs", preset === "custom" && "bg-blue-600 hover:bg-blue-700")}
              onClick={() => setPreset("custom")}>
              Özel
            </Button>
            {preset === "custom" && (
              <div className="flex items-center gap-2">
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(customStart + "T12:00:00"), "dd MMM yyyy", { locale: tr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" locale={tr} selected={new Date(customStart + "T12:00:00")}
                      onSelect={d => { if (d) { setCustomStart(format(d, "yyyy-MM-dd")); setStartOpen(false) } }} />
                  </PopoverContent>
                </Popover>
                <span className="text-gray-400 text-xs">—</span>
                <Popover open={endOpen} onOpenChange={setEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(customEnd + "T12:00:00"), "dd MMM yyyy", { locale: tr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" locale={tr} selected={new Date(customEnd + "T12:00:00")}
                      onSelect={d => { if (d) { setCustomEnd(format(d, "yyyy-MM-dd")); setEndOpen(false) } }} />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* Özet Kartlar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Randevu</p>
                    <p className="text-xl font-bold text-gray-800 mt-1">{sorted.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Toplam PAX</p>
                    <p className="text-xl font-bold text-gray-800 mt-1">
                      {totalPax}{totalChild > 0 && <span className="text-sm text-gray-500">+{totalChild}</span>}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-medium">Dönem Cirosu</p>
                    <p className="text-lg font-bold text-emerald-700 mt-1">{fmtCur(totalRevenue, agencyCurrency)}</p>
                  </CardContent>
                </Card>
                <Card className={cn("border-slate-200", Object.values(balance).some(v => v.bakiye > 0) ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase tracking-wide font-medium text-gray-500">Cari Bakiye</p>
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(balance).length === 0
                        ? <p className="text-sm font-bold text-gray-400">—</p>
                        : Object.entries(balance).map(([cur, v]) => (
                          <p key={cur} className={cn("text-sm font-bold", v.bakiye > 0 ? "text-red-600" : "text-emerald-700")}>
                            {v.bakiye > 0 ? `${fmtAmt(v.bakiye, cur)} borç` : v.bakiye < 0 ? `${fmtAmt(Math.abs(v.bakiye), cur)} alacak` : "Sıfır"}
                          </p>
                        ))
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Arama */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Müşteri adı, voucher veya otel ara..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 text-xs max-w-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <span className="text-xs text-gray-400">{sorted.length} kayıt</span>
              </div>

              {/* Müşteri Tablosu */}
              {sorted.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Bu dönemde kayıt bulunamadı</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs font-semibold">Tarih</TableHead>
                        <TableHead className="text-xs font-semibold">Saat</TableHead>
                        <TableHead className="text-xs font-semibold">Müşteri</TableHead>
                        <TableHead className="text-xs font-semibold">PAX</TableHead>
                        <TableHead className="text-xs font-semibold">Otel</TableHead>
                        <TableHead className="text-xs font-semibold">Program</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Tutar</TableHead>
                        <TableHead className="text-xs font-semibold">Voucher</TableHead>
                        <TableHead className="text-xs font-semibold">Ödeme</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((c: any) => (
                        <TableRow key={c.id} className="hover:bg-slate-50/60">
                          <TableCell className="text-xs text-gray-600">
                            {format(new Date(c.time), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {new Date(c.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-gray-800">
                            {c.customerName || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium">{c.pax || 0}</span>
                            {c.childCount > 0 && <span className="text-gray-400">+{c.childCount}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 max-w-[140px] truncate">
                            {c.hotelName || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              {c.serviceName || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-gray-800">
                            {fmtCur(c.price || 0, c.currency || agencyCurrency)}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {c.voucherNo || "—"}
                          </TableCell>
                          <TableCell>
                            {c.restAmount ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                                REST {c.restAmount} {c.restCurrency}
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                Acenta
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {/* Ödemeler Bölümü — her zaman göster */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Tahsilat / Ödeme Hareketleri
                  <span className="text-gray-400 font-normal">({odemeler?.length ?? 0} kayıt)</span>
                </p>
                {!odemeler || odemeler.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center">Tahsilat kaydı yok</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-blue-100">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50">
                          <TableHead className="text-xs font-semibold">Tarih / Saat</TableHead>
                          <TableHead className="text-xs font-semibold">Açıklama</TableHead>
                          <TableHead className="text-right text-xs font-semibold text-emerald-700">Tahsilat</TableHead>
                          <TableHead className="text-xs font-semibold">Kaynak</TableHead>
                          <TableHead className="text-xs font-semibold">Kullanıcı</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {odemeler.map((e: any) => (
                          <TableRow key={e.id} className="hover:bg-blue-50/40">
                            <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                              <div>{format(new Date(e.createdAt || e.date), "dd.MM.yyyy")}</div>
                              <div className="text-[10px] text-gray-400">{format(new Date(e.createdAt || e.date), "HH:mm")}</div>
                            </TableCell>
                            <TableCell className="text-xs text-gray-700">
                              {e.description || "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-emerald-700">
                              {fmtCur(e.credit || 0, e.currency)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.cashEntry?.info === "MUHASEBE" ? (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                  Muhasebe
                                </Badge>
                              ) : e.cashEntry ? (
                                <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">
                                  Kasa #{e.cashEntry.voucherNo}
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                  Muhasebe
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {e.createdByName || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Kategori Ekle Dialog ──────────────────────────────────────────────────────
function KategoriEkleDialog({
  open, onClose, onSuccess,
}: {
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [label,   setLabel]   = useState("")
  const [type,    setType]    = useState<"expense" | "income">("expense")
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (!label.trim()) { toast.error("Kategori adı boş olamaz"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/muhasebe/kategori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), type }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success("Kategori eklendi")
      setLabel("")
      onSuccess()
      onClose()
    } catch (error: any) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Kategori Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Kategori Türü</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={type === "expense" ? "default" : "outline"}
                className={cn("h-8 text-xs flex-1", type === "expense" && "bg-red-600 hover:bg-red-700")}
                onClick={() => setType("expense")}>
                <TrendingDown className="h-3.5 w-3.5 mr-1.5" /> Gider
              </Button>
              <Button size="sm" variant={type === "income" ? "default" : "outline"}
                className={cn("h-8 text-xs flex-1", type === "income" && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => setType("income")}>
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Gelir
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Kategori Adı</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave() }}
              placeholder="ör. Kırtasiye Gideri"
              className="h-9"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9" onClick={onClose}>İptal</Button>
            <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Ekle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Label Düzenle Dialog ──────────────────────────────────────────────────────
function LabelDuzenleDialog({
  open, onClose, accountCode, currentLabel, onSuccess,
}: {
  open: boolean; onClose: () => void; accountCode: string; currentLabel: string; onSuccess: (newLabel: string) => void
}) {
  const [label, setLabel] = useState(currentLabel)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = label.trim()
    if (!trimmed) { toast.error("İsim boş olamaz"); return }
    if (trimmed === currentLabel) { onClose(); return }
    setSaving(true)
    try {
      const res = await fetch("/api/muhasebe/cari/label", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode, label: trimmed }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success("Kalem adı güncellendi")
      onSuccess(trimmed)
      onClose()
    } catch (error: any) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Kalem Adını Düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Kalem Adı</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave() }} className="h-9" autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9" onClick={onClose}>İptal</Button>
            <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Manuel Hareket Dialog ─────────────────────────────────────────────────────
function ManuelHareketDialog({
  open, onClose, onSuccess, accountCode, accountLabel, editEntry,
}: {
  open: boolean; onClose: () => void; onSuccess: () => void
  accountCode: string; accountLabel: string; editEntry?: DetailEntry | null
}) {
  const isEdit = !!editEntry
  const [date,        setDate]        = useState(isEdit ? format(new Date(editEntry!.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))
  const [debit,       setDebit]       = useState(isEdit ? String(editEntry!.debit || "") : "")
  const [credit,      setCredit]      = useState(isEdit ? String(editEntry!.credit || "") : "")
  const [currency,    setCurrency]    = useState(isEdit ? editEntry!.currency : "TRY")
  const [description, setDescription] = useState(isEdit ? (editEntry!.description ?? "") : "")
  const [saving,      setSaving]      = useState(false)

  const handleSave = async () => {
    const d = parseFloat(debit) || 0
    const c = parseFloat(credit) || 0
    if (d === 0 && c === 0) { toast.error("Borç veya alacak giriniz"); return }
    setSaving(true)
    try {
      if (isEdit) {
        const res = await fetch("/api/muhasebe/cari/entry", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editEntry!.id, date, debit: d, credit: c, currency, description: description || null }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success("Hareket güncellendi")
      } else {
        const isStaff  = accountCode.startsWith("CARI_PERSONEL_")
        const isAgency = accountCode.startsWith("CARI_ACENTA_")
        const res = await fetch("/api/muhasebe/cari/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode, date, debit: d, credit: c, currency,
            description: description || null,
            staffId:  isStaff  ? accountCode.replace("CARI_PERSONEL_", "") : null,
            agencyId: isAgency ? accountCode.replace("CARI_ACENTA_", "")  : null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success("Hareket eklendi")
      }
      onSuccess(); onClose()
    } catch (error: any) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            {isEdit ? "Hareketi Düzenle" : "Hareket Ekle"} — {accountLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Tarih</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-red-600">Borç</Label>
              <Input type="number" placeholder="0.00" value={debit} onChange={e => setDebit(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-emerald-600">Alacak</Label>
              <Input type="number" placeholder="0.00" value={credit} onChange={e => setCredit(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Döviz</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Açıklama</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Hareket açıklaması..." className="resize-none h-16 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9" onClick={onClose}>İptal</Button>
            <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Ekle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Gelir / Gider Ekle Dialog ─────────────────────────────────────────────────
function GelirGiderDialog({
  mode, open, onClose, onSuccess,
}: {
  mode: "income" | "expense"; open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [amount,         setAmount]         = useState("")
  const [currency,       setCurrency]       = useState(mode === "expense" ? "TRY" : "EUR")
  const [description,    setDescription]    = useState("")
  const [saving,         setSaving]         = useState(false)
  const [incomeType,     setIncomeType]     = useState<"reception" | "cari-agency" | "cari-staff">("reception")
  const [incomeSubCat,   setIncomeSubCat]   = useState("")
  const [agencyId,       setAgencyId]       = useState("")
  const [staffId,        setStaffId]        = useState("")
  const [paymentMethod,  setPaymentMethod]  = useState<"nakit" | "kk">("nakit")
  const [expenseCategory, setExpenseCategory] = useState("")

  const { data: agencies } = useQuery<AgencyItem[]>({
    queryKey: ["agencies-list"],
    queryFn: async () => { const r = await fetch("/api/agencies"); return r.ok ? r.json() : [] },
    enabled: open && mode === "income",
  })
  const { data: staffList } = useQuery<StaffItem[]>({
    queryKey: ["staff-list"],
    queryFn: async () => { const r = await fetch("/api/staff"); return r.ok ? r.json() : [] },
    enabled: open && mode === "income",
  })

  const selectedStaff = staffList?.find(s => s.id === staffId)
  const commissionRate = selectedStaff?.commissionRate ?? 0
  const amt = parseFloat(amount) || 0
  const primAmt = commissionRate > 0 ? (amt * commissionRate / 100) : 0
  const isCreditCard = paymentMethod === "kk"
  const effectiveCurrency = isCreditCard ? "TRY" : currency

  const handleSubmit = async () => {
    if (!amount || amt <= 0) { toast.error("Geçerli tutar giriniz"); return }
    if (mode === "expense" && !expenseCategory) { toast.error("Kategori seçiniz"); return }
    if (mode === "income" && incomeType === "reception" && !incomeSubCat) { toast.error("Alt kategori seçiniz"); return }
    if (mode === "income" && incomeType === "cari-agency" && !agencyId) { toast.error("Acenta seçiniz"); return }
    if (mode === "income" && incomeType === "cari-staff" && !staffId) { toast.error("Personel seçiniz"); return }
    setSaving(true)
    try {
      const payload: any = { type: mode, description: description || null }
      if (mode === "expense") {
        payload.expenseAmount = amt; payload.expenseCurrency = currency; payload.expenseCategory = expenseCategory
      } else {
        if (incomeType === "reception") {
          payload.receptionIncomeAmount = amt; payload.receptionIncomeCurrency = currency; payload.incomeSubCategory = incomeSubCat
        } else if (incomeType === "cari-agency") {
          if (isCreditCard) { payload.creditCardAmount = amt; payload.creditCardCurrency = "TRY"; payload.agencyId = agencyId }
          else { payload.agencyIncomeAmount = amt; payload.agencyIncomeCurrency = currency; payload.agencyId = agencyId }
        } else if (incomeType === "cari-staff") {
          if (isCreditCard) { payload.creditCardAmount = amt; payload.creditCardCurrency = "TRY"; payload.staffId = staffId }
          else { payload.staffIncomeAmount = amt; payload.staffIncomeCurrency = currency; payload.staffId = staffId }
        }
      }
      const res = await fetch("/api/muhasebe/entry", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(mode === "income" ? "Gelir kaydedildi" : "Gider kaydedildi")
      setAmount(""); setDescription(""); setStaffId(""); setAgencyId("")
      onSuccess(); onClose()
    } catch (error: any) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  const isIncome = mode === "income"
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            {isIncome ? <><TrendingUp className="h-4 w-4 text-emerald-600" /> Gelir Ekle</> : <><TrendingDown className="h-4 w-4 text-red-600" /> Gider Ekle</>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {isIncome && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Gelir Tipi</Label>
              <div className="flex flex-wrap gap-1.5">
                {([{ key: "reception", label: "Resepsiyon" }, { key: "cari-agency", label: "Cari — Acenta" }, { key: "cari-staff", label: "Cari — Personel" }] as const).map(b => (
                  <Button key={b.key} size="sm" variant={incomeType === b.key ? "default" : "outline"}
                    className={cn("h-7 text-xs", incomeType === b.key && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => { setIncomeType(b.key); setPaymentMethod("nakit") }}>
                    {b.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {isIncome && incomeType === "reception" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Alt Kategori *</Label>
              <Select value={incomeSubCat} onValueChange={setIncomeSubCat}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>{INCOME_SUB_CATEGORIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {isIncome && incomeType === "cari-agency" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Acenta *</Label>
                <Select value={agencyId} onValueChange={v => { setAgencyId(v); const ag = agencies?.find(a => a.id === v); if (ag && !isCreditCard) setCurrency(ag.currency || "EUR") }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Acenta seçin" /></SelectTrigger>
                  <SelectContent>{(agencies ?? []).map(a => <SelectItem key={a.id} value={a.id}>{a.companyName || a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Ödeme Yöntemi</Label>
                <div className="flex gap-1.5">
                  {([{ key: "nakit", label: "Nakit" }, { key: "kk", label: "Kredi Kartı (TRY)" }] as const).map(b => (
                    <Button key={b.key} size="sm" variant={paymentMethod === b.key ? "default" : "outline"}
                      className={cn("h-7 text-xs", paymentMethod === b.key && "bg-blue-600 hover:bg-blue-700")}
                      onClick={() => { setPaymentMethod(b.key); if (b.key === "kk") setCurrency("TRY") }}>
                      {b.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
          {isIncome && incomeType === "cari-staff" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Personel *</Label>
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>{(staffList ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.user.name}{s.commissionRate ? ` (%${s.commissionRate} kom.)` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Ödeme Yöntemi</Label>
                <div className="flex gap-1.5">
                  {([{ key: "nakit", label: "Nakit" }, { key: "kk", label: "Kredi Kartı (TRY)" }] as const).map(b => (
                    <Button key={b.key} size="sm" variant={paymentMethod === b.key ? "default" : "outline"}
                      className={cn("h-7 text-xs", paymentMethod === b.key && "bg-blue-600 hover:bg-blue-700")}
                      onClick={() => { setPaymentMethod(b.key); if (b.key === "kk") setCurrency("TRY") }}>
                      {b.label}
                    </Button>
                  ))}
                </div>
              </div>
              {staffId && commissionRate > 0 && amt > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <span className="font-semibold">Otomatik Prim:</span>{" "}
                  {fmtAmt(primAmt, effectiveCurrency)} (%{commissionRate} × {fmtAmt(amt, effectiveCurrency)}) — gider olarak yansır
                </div>
              )}
            </>
          )}
          {!isIncome && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Kategori *</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Tutar *</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 h-9" />
              {isCreditCard ? (
                <div className="w-24 h-9 flex items-center justify-center border rounded-md text-sm text-gray-600 bg-gray-50 font-medium">TRY</div>
              ) : (
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Açıklama</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Açıklama..." className="resize-none h-16 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9" onClick={onClose}>İptal</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}
              className={cn("h-9", isIncome ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700")}>
              {saving ? "Kaydediliyor..." : isIncome ? "Geliri Kaydet" : "Gideri Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MuhasebePage() {
  const queryClient = useQueryClient()
  const now = new Date()

  const [preset,      setPreset]      = useState<"today" | "week" | "month" | "custom">("month")
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"))
  const [customEnd,   setCustomEnd]   = useState(format(now, "yyyy-MM-dd"))
  const [startOpen,   setStartOpen]   = useState(false)
  const [endOpen,     setEndOpen]     = useState(false)

  const { startStr, endStr } = localDateRange(preset, customStart, customEnd)

  const [ozetView,   setOzetView]   = useState<"all" | "income" | "expense">("all")
  const [incomeSort, setIncomeSort] = useState<SortDir>("desc")
  const [expSort,    setExpSort]    = useState<SortDir>("desc")

  const [cariFilter,    setCariFilter]    = useState<"all" | "expense" | "income" | "staff" | "agency">("all")
  const [detailAccount, setDetailAccount] = useState<{ code: string; label: string; type: string } | null>(null)
  const [manuelDialog,  setManuelDialog]  = useState(false)
  const [editEntry,     setEditEntry]     = useState<DetailEntry | null>(null)

  const [gelirDialog, setGelirDialog] = useState(false)
  const [giderDialog, setGiderDialog] = useState(false)

  const [labelDialog,    setLabelDialog]    = useState(false)
  const [labelAccount,   setLabelAccount]   = useState<{ code: string; label: string } | null>(null)
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({})

  const [kategoriDialog, setKategoriDialog] = useState(false)

  // Acenta cari detay
  const [acentaDetay, setAcentaDetay] = useState<{
    agencyId: string; agencyName: string; agencyCurrency: string
    balance: Record<string, { debit: number; credit: number; bakiye: number }>
  } | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: ozetData, isLoading: ozetLoading } = useQuery<OzetData>({
    queryKey: ["muhasebe-ozet", startStr, endStr],
    queryFn: async () => {
      const res = await fetch(`/api/muhasebe/ozet?startDate=${startStr}&endDate=${endStr}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: cariData, isLoading: cariLoading } = useQuery<{ accounts: CariAccount[] }>({
    queryKey: ["muhasebe-cari"],
    queryFn: async () => {
      const res = await fetch("/api/muhasebe/cari")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: detailData, isLoading: detailLoading } = useQuery<DetailData>({
    queryKey: ["muhasebe-cari-detail", detailAccount?.code],
    queryFn: async () => {
      const res = await fetch(`/api/muhasebe/cari/${encodeURIComponent(detailAccount!.code)}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    enabled: !!detailAccount,
  })

  const { data: virmanList } = useQuery<Array<{
    transferGroupId: string; date: string; fromAccountCode: string
    toAccountCode: string; amount: number; currency: string; description: string | null
  }>>({
    queryKey: ["muhasebe-virman"],
    queryFn: async () => {
      const res = await fetch("/api/muhasebe/virman")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  // ── Hesaplamalar ─────────────────────────────────────────────────────────────
  function rowTotal(totals: Record<string, { debit: number; credit: number }>, field: "credit" | "debit") {
    return Object.values(totals).reduce((s, v) => s + v[field], 0)
  }

  const incomeRows = useMemo(() => {
    const rows = (ozetData?.byCategory ?? []).filter(c => c.type === "income")
    if (!incomeSort) return rows
    return [...rows].sort((a, b) => {
      const av = rowTotal(a.totals, "credit"), bv = rowTotal(b.totals, "credit")
      return incomeSort === "asc" ? av - bv : bv - av
    })
  }, [ozetData, incomeSort])

  const expenseRows = useMemo(() => {
    const rows = (ozetData?.byCategory ?? []).filter(c => c.type === "expense")
    if (!expSort) return rows
    return [...rows].sort((a, b) => {
      const av = rowTotal(a.totals, "debit"), bv = rowTotal(b.totals, "debit")
      return expSort === "asc" ? av - bv : bv - av
    })
  }, [ozetData, expSort])

  const maxIncome  = useMemo(() => Math.max(...incomeRows.map(r => rowTotal(r.totals, "credit")), 1), [incomeRows])
  const maxExpense = useMemo(() => Math.max(...expenseRows.map(r => rowTotal(r.totals, "debit")), 1), [expenseRows])

  const totalIncome  = ozetData?.totalIncome  ?? {}
  const totalExpense = ozetData?.totalExpense ?? {}
  const netByCur = CURRENCIES.reduce((acc, cur) => {
    const inc = totalIncome[cur] ?? 0, exp = totalExpense[cur] ?? 0
    if (inc > 0 || exp > 0) acc[cur] = inc - exp
    return acc
  }, {} as Record<string, number>)

  const accounts = cariData?.accounts ?? []
  const filteredAccounts = cariFilter === "all" ? accounts : accounts.filter(a => a.type === cariFilter)

  const allAccountOptions = [
    ...EXPENSE_CATEGORIES.map(c => ({ code: c.code, label: labelOverrides[c.code] ?? c.label })),
    ...INCOME_SUB_CATEGORIES.map(c => ({ code: c.code, label: labelOverrides[c.code] ?? c.label })),
    { code: "GELIR_RESEPSIYON",  label: "Resepsiyon Geliri" },
    { code: "GELIR_ACENTA",      label: "Acenta Geliri" },
    { code: "GELIR_PERSONEL",    label: "Personel Geliri" },
    { code: "GELIR_KREDI_KARTI", label: "Kredi Kartı Geliri" },
    ...accounts.filter(a => a.type === "staff").map(a  => ({ code: a.accountCode, label: a.label })),
    ...accounts.filter(a => a.type === "agency").map(a => ({ code: a.accountCode, label: a.label })),
  ]

  function nextSort(d: SortDir): SortDir { return d === "desc" ? "asc" : d === "asc" ? null : "desc" }
  const sortLabel = (d: SortDir) => d === "desc" ? "En Çok → En Az" : d === "asc" ? "En Az → En Çok" : "Sıralama"

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["muhasebe-cari"] })
    queryClient.invalidateQueries({ queryKey: ["muhasebe-ozet"] })
    queryClient.invalidateQueries({ queryKey: ["muhasebe-virman"] })
    queryClient.invalidateQueries({ queryKey: ["acenta-odemeler"] })
    queryClient.invalidateQueries({ queryKey: ["acenta-cari-detay"] })
    if (acentaDetay) {
      queryClient.invalidateQueries({ queryKey: ["acenta-odemeler", acentaDetay.agencyId] })
      queryClient.invalidateQueries({ queryKey: ["acenta-cari-detay", acentaDetay.agencyId] })
    }
    if (detailAccount) queryClient.invalidateQueries({ queryKey: ["muhasebe-cari-detail", detailAccount.code] })
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Bu hareketi silmek istediğinize emin misiniz?")) return
    try {
      const res = await fetch(`/api/muhasebe/cari/entry?id=${entryId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success("Hareket silindi")
      invalidateAll()
    } catch (error: any) { toast.error(error.message) }
  }

  const isStaticCategory = (code: string) =>
    EXPENSE_CATEGORIES.some(c => c.code === code) || INCOME_SUB_CATEGORIES.some(c => c.code === code)

  const openLabelDialog = (acc: CariAccount) => {
    setLabelAccount({ code: acc.accountCode, label: labelOverrides[acc.accountCode] ?? acc.label })
    setLabelDialog(true)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Muhasebe</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gelir/gider takibi, cari hesaplar ve virman işlemleri</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={() => setGelirDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> Gelir Ekle
          </Button>
          <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 gap-1.5" onClick={() => setGiderDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> Gider Ekle
          </Button>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm px-3 py-1">
            {preset === "today" ? "Bugün" : preset === "week" ? "Bu Hafta" : preset === "month" ? "Bu Ay" : `${startStr} – ${endStr}`}
          </Badge>
        </div>
      </div>

      {/* Tarih Filtresi */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "month"] as const).map(p => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"}
              className={cn("h-8 text-xs", preset === p && "bg-blue-600 hover:bg-blue-700")}
              onClick={() => setPreset(p)}>
              {p === "today" ? "Bugün" : p === "week" ? "Bu Hafta" : "Bu Ay"}
            </Button>
          ))}
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <Button size="sm" variant={preset === "custom" ? "default" : "outline"}
            className={cn("h-8 text-xs", preset === "custom" && "bg-blue-600 hover:bg-blue-700")}
            onClick={() => setPreset("custom")}>
            Özel Aralık
          </Button>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(new Date(customStart + "T12:00:00"), "dd MMM yyyy", { locale: tr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" locale={tr} selected={new Date(customStart + "T12:00:00")}
                    onSelect={d => { if (d) { setCustomStart(format(d, "yyyy-MM-dd")); setStartOpen(false) } }} />
                </PopoverContent>
              </Popover>
              <span className="text-gray-400 text-xs">—</span>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(new Date(customEnd + "T12:00:00"), "dd MMM yyyy", { locale: tr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" locale={tr} selected={new Date(customEnd + "T12:00:00")}
                    onSelect={d => { if (d) { setCustomEnd(format(d, "yyyy-MM-dd")); setEndOpen(false) } }} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="ozet">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ozet" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Genel Özet</TabsTrigger>
          <TabsTrigger value="cari" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Cari Hesaplar</TabsTrigger>
          <TabsTrigger value="virman" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">Virman</TabsTrigger>
        </TabsList>

        {/* ══ TAB 1: GENEL ÖZET ══════════════════════════════════════════════ */}
        <TabsContent value="ozet" className="space-y-5 mt-4">
          {ozetLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Toplam Gelir</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(totalIncome).filter(([, v]) => v > 0).map(([cur, v]) => (
                        <div key={cur} className="flex items-center justify-between">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", CUR_META[cur]?.light)}>{cur}</span>
                          <span className="text-sm font-bold text-emerald-700">{fmtAmt(v, cur)}</span>
                        </div>
                      ))}
                      {Object.keys(totalIncome).length === 0 && <p className="text-sm text-gray-400">Gelir yok</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-red-200 bg-gradient-to-br from-red-50 to-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Toplam Gider</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(totalExpense).filter(([, v]) => v > 0).map(([cur, v]) => (
                        <div key={cur} className="flex items-center justify-between">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", CUR_META[cur]?.light)}>{cur}</span>
                          <span className="text-sm font-bold text-red-700">{fmtAmt(v, cur)}</span>
                        </div>
                      ))}
                      {Object.keys(totalExpense).length === 0 && <p className="text-sm text-gray-400">Gider yok</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Net Kar / Zarar</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(netByCur).map(([cur, net]) => (
                        <div key={cur} className="flex items-center justify-between">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", CUR_META[cur]?.light)}>{cur}</span>
                          <span className={cn("text-sm font-bold", net >= 0 ? "text-emerald-700" : "text-red-600")}>
                            {net >= 0 ? "+" : ""}{fmtAmt(net, cur)}
                          </span>
                        </div>
                      ))}
                      {Object.keys(netByCur).length === 0 && <p className="text-sm text-gray-400">Veri yok</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center gap-2">
                {([{ key: "all", label: "Tümü" }, { key: "income", label: "Gelirler" }, { key: "expense", label: "Giderler" }] as const).map(b => (
                  <Button key={b.key} size="sm" variant={ozetView === b.key ? "default" : "outline"}
                    className={cn("h-8 text-xs", ozetView === b.key && "bg-blue-600 hover:bg-blue-700")}
                    onClick={() => setOzetView(b.key)}>
                    {b.label}
                  </Button>
                ))}
              </div>

              {(ozetView === "all" || ozetView === "income") && incomeRows.length > 0 && (
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Gelir Kalemleri
                        <span className="text-xs text-gray-400 font-normal">({incomeRows.length} kalem)</span>
                      </CardTitle>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setIncomeSort(nextSort)}>
                        <ArrowUpDown className="h-3 w-3" />{sortLabel(incomeSort)}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/60">
                          <TableHead className="text-xs font-semibold">Kalem</TableHead>
                          {CURRENCIES.map(cur => <TableHead key={cur} className="text-right text-xs font-semibold">{cur}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomeRows.map(cat => {
                          const total = rowTotal(cat.totals, "credit")
                          return (
                            <TableRow key={cat.accountCode} className="cursor-pointer hover:bg-emerald-50/50 transition-colors"
                              onClick={() => setDetailAccount({ code: cat.accountCode, label: labelOverrides[cat.accountCode] ?? cat.label, type: cat.type })}>
                              <TableCell className="py-3">
                                <span className="text-sm font-medium text-gray-800">{labelOverrides[cat.accountCode] ?? cat.label}</span>
                                <MiniBar value={total} max={maxIncome} color="bg-emerald-400" />
                              </TableCell>
                              {CURRENCIES.map(cur => {
                                const v = cat.totals[cur]?.credit ?? 0
                                return (
                                  <TableCell key={cur} className="text-right py-3">
                                    {v > 0 ? <span className="text-sm font-semibold text-emerald-700">{fmtAmt(v, cur)}</span>
                                           : <span className="text-gray-300 text-sm">—</span>}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {(ozetView === "all" || ozetView === "expense") && expenseRows.length > 0 && (
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" /> Gider Kalemleri
                        <span className="text-xs text-gray-400 font-normal">({expenseRows.length} kalem)</span>
                      </CardTitle>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setExpSort(nextSort)}>
                        <ArrowUpDown className="h-3 w-3" />{sortLabel(expSort)}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/60">
                          <TableHead className="text-xs font-semibold">Kalem</TableHead>
                          {CURRENCIES.map(cur => <TableHead key={cur} className="text-right text-xs font-semibold">{cur}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenseRows.map(cat => {
                          const total = rowTotal(cat.totals, "debit")
                          return (
                            <TableRow key={cat.accountCode} className="cursor-pointer hover:bg-red-50/50 transition-colors"
                              onClick={() => setDetailAccount({ code: cat.accountCode, label: labelOverrides[cat.accountCode] ?? cat.label, type: cat.type })}>
                              <TableCell className="py-3">
                                <span className="text-sm font-medium text-gray-800">{labelOverrides[cat.accountCode] ?? cat.label}</span>
                                <MiniBar value={total} max={maxExpense} color="bg-red-400" />
                              </TableCell>
                              {CURRENCIES.map(cur => {
                                const v = cat.totals[cur]?.debit ?? 0
                                return (
                                  <TableCell key={cur} className="text-right py-3">
                                    {v > 0 ? <span className="text-sm font-semibold text-red-700">{fmtAmt(v, cur)}</span>
                                           : <span className="text-gray-300 text-sm">—</span>}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {(ozetData?.byCategory?.length ?? 0) === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">Bu dönemde kayıt bulunamadı</div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ TAB 2: CARİ HESAPLAR ══════════════════════════════════════════ */}
        <TabsContent value="cari" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "all",     label: "Tümü" },
              { key: "income",  label: "Gelir Kalemleri" },
              { key: "expense", label: "Gider Kalemleri" },
              { key: "staff",   label: "Personel" },
              { key: "agency",  label: "Acentalar" },
            ] as const).map(b => (
              <Button key={b.key} size="sm" variant={cariFilter === b.key ? "default" : "outline"}
                className={cn("h-8 text-xs", cariFilter === b.key && "bg-blue-600 hover:bg-blue-700")}
                onClick={() => setCariFilter(b.key)}>
                {b.label}
              </Button>
            ))}
            <div className="flex-1" />
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={() => setKategoriDialog(true)}>
              <Plus className="h-3.5 w-3.5" /> Kategori Ekle
            </Button>
          </div>

          {cariLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">Bu kategoride cari hesap yok</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAccounts.map(acc => {
                const C = {
                  expense: { border: "border-l-red-400",     badge: "bg-red-100 text-red-700",        label: "Gider" },
                  income:  { border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700", label: "Gelir" },
                  staff:   { border: "border-l-amber-400",   badge: "bg-amber-100 text-amber-700",     label: "Personel" },
                  agency:  { border: "border-l-blue-400",    badge: "bg-blue-100 text-blue-700",       label: "Acenta" },
                }[acc.type] ?? { border: "border-l-gray-300", badge: "bg-gray-100 text-gray-600", label: acc.type }

                const displayLabel = labelOverrides[acc.accountCode] ?? acc.label
                const isStatic = isStaticCategory(acc.accountCode)
                const isAgency = acc.type === "agency"

                const balanceEntries = isAgency
                  ? Object.entries(acc.balances).filter(([, v]) => Math.abs(v.bakiye) > 0.001)
                  : Object.entries(acc.balances).filter(([, v]) => v.debit !== 0 || v.credit !== 0)

                return (
                  <Card key={acc.accountCode} className={cn("border-l-4 hover:shadow-md transition-all cursor-pointer", C.border)}
                    onClick={() => {
                      if (isAgency && acc.agencyId) {
                        setAcentaDetay({
                          agencyId: acc.agencyId,
                          agencyName: displayLabel,
                          agencyCurrency: acc.agencyCurrency ?? "EUR",
                          balance: acc.balances,
                        })
                      } else if (!isAgency) {
                        setDetailAccount({ code: acc.accountCode, label: displayLabel, type: acc.type })
                      }
                    }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{displayLabel}</p>
                          <Badge className={cn("text-[10px] mt-1", C.badge)}>{C.label}</Badge>
                        </div>
                        {/* Kalem ikonu: sadece static gelir/gider kategorilerinde — isim düzenleme */}
                        {isStatic && (
                          <button
                            className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-600 transition-colors shrink-0 mt-0.5"
                            title="Kalem Adını Düzenle"
                            onClick={e => { e.stopPropagation(); openLabelDialog(acc) }}
                          >
                            <PenLine className="h-4 w-4" />
                          </button>
                        )}
                        {/* Acenta ikonu */}
                        {isAgency && (
                          <div className="p-1 text-blue-300 shrink-0 mt-0.5">
                            <Building2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      {isAgency ? (
                        balanceEntries.length === 0 ? (
                          <p className="text-xs text-gray-400">Borç yok</p>
                        ) : (
                          <div className="space-y-1">
                            {balanceEntries.map(([cur, v]) => (
                              <div key={cur} className="flex items-center justify-between">
                                <span className={cn("text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full", CUR_META[cur]?.bg ?? "bg-gray-400")}>
                                  {CUR_META[cur]?.symbol}{cur}
                                </span>
                                <span className={cn("text-sm font-bold", v.bakiye > 0 ? "text-red-600" : "text-emerald-700")}>
                                  {v.bakiye > 0 ? `${fmtAmt(v.bakiye, cur)} borç` : `${fmtAmt(Math.abs(v.bakiye), cur)} alacak`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        balanceEntries.length === 0 ? (
                          <p className="text-xs text-gray-400">Hareket yok</p>
                        ) : (
                          <div className="space-y-1">
                            {balanceEntries.map(([cur, v]) => {
                              const bak = v.bakiye ?? (v.credit - v.debit)
                              return (
                                <div key={cur} className="flex items-center justify-between">
                                  <span className={cn("text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full", CUR_META[cur]?.bg ?? "bg-gray-400")}>
                                    {CUR_META[cur]?.symbol}{cur}
                                  </span>
                                  <span className={cn("text-sm font-bold", bak >= 0 ? "text-emerald-700" : "text-red-600")}>
                                    {bak >= 0 ? "+" : ""}{fmtAmt(bak, cur)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ══ TAB 3: VİRMAN ════════════════════════════════════════════════ */}
        <TabsContent value="virman" className="space-y-4 mt-4">
          <VirmanForm accounts={allAccountOptions} onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["muhasebe-cari"] })
            queryClient.invalidateQueries({ queryKey: ["muhasebe-ozet"] })
            queryClient.invalidateQueries({ queryKey: ["muhasebe-virman"] })
          }} />
          {(virmanList?.length ?? 0) > 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-blue-600" /> Virman Geçmişi
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/60">
                      <TableHead className="text-xs">Tarih</TableHead>
                      <TableHead className="text-xs">Kaynak</TableHead>
                      <TableHead className="text-xs">Hedef</TableHead>
                      <TableHead className="text-right text-xs">Tutar</TableHead>
                      <TableHead className="text-xs">Açıklama</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {virmanList?.map(v => (
                      <TableRow key={v.transferGroupId}>
                        <TableCell className="text-sm">{format(new Date(v.date), "dd.MM.yyyy")}</TableCell>
                        <TableCell className="text-sm text-red-600 font-medium">{v.fromAccountCode}</TableCell>
                        <TableCell className="text-sm text-emerald-600 font-medium">{v.toAccountCode}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {fmtAmt(v.amount, v.currency)}
                          <span className="text-xs text-gray-400 ml-1">{v.currency}</span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{v.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Cari Detay Dialog (personel + gelir/gider kalemleri) */}
      <Dialog open={!!detailAccount && !manuelDialog} onOpenChange={v => { if (!v) { setDetailAccount(null); setEditEntry(null) } }}>
        <DialogContent className="w-full !max-w-[960px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{detailAccount?.label}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : detailData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(detailData.summary).map(([cur, s]) => (
                  <Card key={cur} className="border-slate-200">
                    <CardContent className="p-3">
                      <div className={cn("inline-flex items-center gap-1 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full mb-2", CUR_META[cur]?.bg ?? "bg-gray-500")}>
                        {CUR_META[cur]?.symbol}{cur}
                      </div>
                      <div className="text-xs text-gray-500">Borç: <span className="font-medium text-red-600">{fmtAmt(s.totalDebit, cur)}</span></div>
                      <div className="text-xs text-gray-500">Alacak: <span className="font-medium text-emerald-600">{fmtAmt(s.totalCredit, cur)}</span></div>
                      <div className={cn("text-sm font-bold mt-1", s.bakiye >= 0 ? "text-emerald-700" : "text-red-600")}>
                        {s.bakiye >= 0 ? "+" : ""}{fmtAmt(s.bakiye, cur)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">Tarih / Saat</TableHead>
                    <TableHead className="text-xs">Açıklama</TableHead>
                    <TableHead className="text-right text-xs text-red-600">Borç</TableHead>
                    <TableHead className="text-right text-xs text-emerald-600">Alacak</TableHead>
                    <TableHead className="text-right text-xs">Bakiye</TableHead>
                    <TableHead className="text-xs">Döviz</TableHead>
                    <TableHead className="text-xs">Kullancı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.entries.map(e => {
                    const isManuel   = !e.cashEntry && !e.transferGroupId
                    const isSentinel = e.debit === 0 && e.credit === 0
                    const entryDate  = new Date(e.date)
                    return (
                      <TableRow key={e.id} className={cn("hover:bg-gray-50/60", isSentinel && "opacity-40")}>
                        <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                          <div>{format(entryDate, "dd.MM.yyyy")}</div>
                          <div className="text-[10px] text-gray-400">{format(entryDate, "HH:mm")}</div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {e.description || "—"}
                          {e.staff?.name && <span className="text-[10px] text-gray-500 ml-1">({e.staff.name})</span>}
                          {e.cashEntry && <span className="text-[10px] text-gray-400 ml-1">#{e.cashEntry.voucherNo}</span>}
                          {e.transferGroupId && <span className="text-[10px] text-blue-400 ml-1">[Virman]</span>}
                          {isManuel && !isSentinel && <span className="text-[10px] text-amber-500 ml-1">[Manuel]</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-red-600">
                          {e.debit > 0 ? fmtAmt(e.debit, e.currency) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-emerald-600">
                          {e.credit > 0 ? fmtAmt(e.credit, e.currency) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className={cn("text-right text-xs font-bold", e.runningBalance >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {e.runningBalance >= 0 ? "+" : ""}{fmtAmt(e.runningBalance, e.currency)}
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full", CUR_META[e.currency]?.bg ?? "bg-gray-400")}>
                            {e.currency}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          {(e as any).createdByName ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Manuel Hareket Dialog */}
      {detailAccount && manuelDialog && (
        <ManuelHareketDialog
          open={manuelDialog}
          onClose={() => { setManuelDialog(false); setEditEntry(null) }}
          onSuccess={invalidateAll}
          accountCode={detailAccount.code}
          accountLabel={detailAccount.label}
          editEntry={editEntry}
        />
      )}

      {/* Acenta Cari Detay Dialog */}
      {acentaDetay && (
        <AcentaCariDialog
          open={!!acentaDetay}
          onClose={() => setAcentaDetay(null)}
          agencyId={acentaDetay.agencyId}
          agencyName={acentaDetay.agencyName}
          agencyCurrency={acentaDetay.agencyCurrency}
          balance={acentaDetay.balance}
        />
      )}

      {/* Gelir / Gider Ekle */}
      <GelirGiderDialog mode="income" open={gelirDialog} onClose={() => setGelirDialog(false)} onSuccess={invalidateAll} />
      <GelirGiderDialog mode="expense" open={giderDialog} onClose={() => setGiderDialog(false)} onSuccess={invalidateAll} />

      {/* Kategori Ekle Dialog */}
      <KategoriEkleDialog
        open={kategoriDialog}
        onClose={() => setKategoriDialog(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["muhasebe-cari"] })
          queryClient.invalidateQueries({ queryKey: ["muhasebe-ozet"] })
        }}
      />

      {/* Label Düzenle Dialog */}
      {labelDialog && labelAccount && (
        <LabelDuzenleDialog
          open={labelDialog}
          onClose={() => { setLabelDialog(false); setLabelAccount(null) }}
          accountCode={labelAccount.code}
          currentLabel={labelAccount.label}
          onSuccess={(newLabel) => {
            setLabelOverrides(prev => ({ ...prev, [labelAccount.code]: newLabel }))
            invalidateAll()
          }}
        />
      )}
    </div>
  )
}

// ── Virman Form ───────────────────────────────────────────────────────────────
function VirmanForm({ accounts, onSuccess }: {
  accounts: Array<{ code: string; label: string }>
  onSuccess: () => void
}) {
  const [fromAccount, setFromAccount] = useState("")
  const [toAccount,   setToAccount]   = useState("")
  const [amount,      setAmount]      = useState("")
  const [currency,    setCurrency]    = useState("TRY")
  const [date,        setDate]        = useState(format(new Date(), "yyyy-MM-dd"))
  const [description, setDescription] = useState("")
  const [submitting,  setSubmitting]  = useState(false)

  const handleSubmit = async () => {
    if (!fromAccount) { toast.error("Kaynak hesap seçiniz"); return }
    if (!toAccount)   { toast.error("Hedef hesap seçiniz"); return }
    if (fromAccount === toAccount) { toast.error("Kaynak ve hedef farklı olmalı"); return }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Geçerli tutar giriniz"); return }
    setSubmitting(true)
    try {
      const res = await fetch("/api/muhasebe/virman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAccountCode: fromAccount, toAccountCode: toAccount, amount: parseFloat(amount), currency, date, description: description || null }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Başarısız") }
      toast.success("Virman kaydedildi")
      setFromAccount(""); setToAccount(""); setAmount(""); setDescription("")
      onSuccess()
    } catch (error: any) { toast.error(error.message) }
    finally { setSubmitting(false) }
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-blue-600" /> Yeni Virman
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Kaynak Hesap *</Label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Kaynak seçin" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Hedef Hesap *</Label>
            <Select value={toAccount} onValueChange={setToAccount}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Hedef seçin" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Tutar *</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 h-9" />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Tarih *</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-medium text-gray-600">Açıklama</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Virman açıklaması..." className="resize-none h-16 text-sm" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 h-9">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            {submitting ? "Kaydediliyor..." : "Virman Yap"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
