"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Plus, Minus, CalendarIcon, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { getCurrencySymbol, convertCurrency, ExchangeRates } from "@/lib/currency-utils"
import { EXPENSE_CATEGORIES, INCOME_SUB_CATEGORIES, getExpenseCategoryLabel, getIncomeSubCategoryLabel } from "@/lib/accounting-constants"

interface CashEntry {
  id: string
  date: string
  voucherNo: number
  agencyId: string | null
  hotelId: string | null
  roomNumber: string | null
  serviceName: string | null
  pax: number | null
  agencyIncomeAmount: number | null
  agencyIncomeCurrency: string | null
  receptionIncomeAmount: number | null
  receptionIncomeCurrency: string | null
  staffId: string | null
  staffIncomeAmount: number | null
  staffIncomeCurrency: string | null
  creditCardAmount: number | null
  creditCardCurrency: string | null
  creditAmount: number | null
  creditCurrency: string | null
  expenseAmount: number | null
  expenseCurrency: string | null
  description: string | null
  info: string | null
  expenseCategory: string | null
  incomeSubCategory: string | null
  agency: { id: string; name: string; companyName: string | null } | null
  hotel: { id: string; name: string } | null
  staff: { id: string; position: string | null; commissionRate: number | null; user: { name: string } } | null
}

interface Summary {
  agencyIncome: Record<string, number>
  receptionIncome: Record<string, number>
  staffIncome: Record<string, number>
  creditCardIncome: Record<string, number>
  cashIncome: Record<string, number>
  totalIncome: Record<string, number>
  credit: Record<string, number>
  expense: Record<string, number>
  commissionExpense: Record<string, number>
}

interface Agency { id: string; name: string; companyName: string | null }
interface StaffMember {
  id: string; userId: string; position: string | null
  commissionRate: number | null; isActive: boolean
  user: { id: string; name: string; email: string }
}

const CURRENCIES = [
  { value: "TRY", symbol: "₺", bg: "bg-orange-500", ring: "ring-orange-300" },
  { value: "EUR", symbol: "€", bg: "bg-blue-600", ring: "ring-blue-300" },
  { value: "USD", symbol: "$", bg: "bg-emerald-600", ring: "ring-emerald-300" },
  { value: "GBP", symbol: "£", bg: "bg-purple-600", ring: "ring-purple-300" },
]

type EntryKind = "agencyIncome" | "receptionIncome" | "staffIncome" | "creditCard" | "credit" | "expense"

function getEntryKind(entry: CashEntry): EntryKind {
  if (entry.agencyIncomeAmount) return "agencyIncome"
  if (entry.receptionIncomeAmount) return "receptionIncome"
  if (entry.staffIncomeAmount) return "staffIncome"
  if (entry.creditCardAmount) return "creditCard"
  if (entry.creditAmount) return "credit"
  return "expense"
}

function isIncomeEntry(entry: CashEntry): boolean {
  return !!(entry.agencyIncomeAmount || entry.receptionIncomeAmount || entry.staffIncomeAmount || entry.creditCardAmount)
}

function getEntryAmount(entry: CashEntry): { amount: number; currency: string } {
  if (entry.agencyIncomeAmount && entry.agencyIncomeCurrency)
    return { amount: entry.agencyIncomeAmount, currency: entry.agencyIncomeCurrency }
  if (entry.receptionIncomeAmount && entry.receptionIncomeCurrency)
    return { amount: entry.receptionIncomeAmount, currency: entry.receptionIncomeCurrency }
  if (entry.staffIncomeAmount && entry.staffIncomeCurrency)
    return { amount: entry.staffIncomeAmount, currency: entry.staffIncomeCurrency }
  if (entry.creditCardAmount && entry.creditCardCurrency)
    return { amount: entry.creditCardAmount, currency: entry.creditCardCurrency }
  if (entry.creditAmount && entry.creditCurrency)
    return { amount: entry.creditAmount, currency: entry.creditCurrency }
  if (entry.expenseAmount && entry.expenseCurrency)
    return { amount: entry.expenseAmount, currency: entry.expenseCurrency }
  return { amount: 0, currency: "TRY" }
}

const KIND_META: Record<EntryKind, { label: string; badgeClass: string; borderClass: string }> = {
  agencyIncome:    { label: "Acenta",      badgeClass: "bg-blue-100 text-blue-700",      borderClass: "border-l-blue-400" },
  receptionIncome: { label: "Resepsiyon",  badgeClass: "bg-emerald-100 text-emerald-700", borderClass: "border-l-emerald-400" },
  staffIncome:     { label: "Personel",    badgeClass: "bg-amber-100 text-amber-700",    borderClass: "border-l-amber-400" },
  creditCard:      { label: "Kredi Kartı", badgeClass: "bg-violet-100 text-violet-700",  borderClass: "border-l-violet-400" },
  credit:          { label: "Kredi",       badgeClass: "bg-sky-100 text-sky-700",        borderClass: "border-l-sky-400" },
  expense:         { label: "Gider",       badgeClass: "bg-red-100 text-red-700",        borderClass: "border-l-red-400" },
}

function CurrencyButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {CURRENCIES.map((c) => (
        <button key={c.value} type="button"
          className={cn("h-8 px-2 text-xs font-bold rounded transition-all border",
            value === c.value ? `${c.bg} text-white ring-2 ${c.ring}` : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
          )}
          onClick={() => onChange(c.value)}
        >
          {c.symbol}
        </button>
      ))}
    </div>
  )
}

export default function KasaPage() {
  const queryClient = useQueryClient()
  const { has } = usePermissions()
  const canManageKasa = has("kasa_yonetimi")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formMode, setFormMode] = useState<"income" | "expense" | null>(null)
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dateStr = format(selectedDate, "yyyy-MM-dd")

  const { data, isLoading } = useQuery<{ entries: CashEntry[]; summary: Summary }>({
    queryKey: ["kasa", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/kasa?date=${dateStr}`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: agencies } = useQuery<Agency[]>({
    queryKey: ["agencies"],
    queryFn: async () => {
      const res = await fetch("/api/agencies")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: staffList } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const { data: exchangeRates } = useQuery<{ rates: ExchangeRates }>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/exchange-rates")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kasa/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Silinemedi")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kasa", dateStr] })
      toast.success("Kasa girişi silindi")
      setDeletingId(null)
    },
    onError: () => toast.error("Silinemedi"),
  })

  const entries = data?.entries || []
  const summary = data?.summary

  // Muhasebe girişlerini kasadan ayır
  const muhasebeEntries = entries.filter(e => e.info === "MUHASEBE")
  const kasaEntries = entries.filter(e => e.info !== "MUHASEBE")

  // Gelirler: kredi kartı hariç nakit gelirler + kredi kartları ayrı
  const cashIncomeEntries = kasaEntries.filter(e => !!(e.agencyIncomeAmount || e.receptionIncomeAmount || e.staffIncomeAmount))
  const creditCardEntries = kasaEntries.filter(e => !!e.creditCardAmount)
  const expenseEntries = kasaEntries.filter(e => !isIncomeEntry(e))

  // Personel prim özeti (sadece o personelin staffIncome'undan)
  const commissionData = (() => {
    if (!staffList) return []
    return staffList
      .filter(s => s.isActive && s.commissionRate && s.commissionRate > 0)
      .map(s => {
        const rate = s.commissionRate!
        const byCurrency: Record<string, number> = {}
        for (const e of entries) {
          if (e.staffId === s.id && e.staffIncomeAmount && e.staffIncomeCurrency) {
            byCurrency[e.staffIncomeCurrency] = (byCurrency[e.staffIncomeCurrency] || 0) + e.staffIncomeAmount
          }
          if (e.staffId === s.id && e.creditCardAmount && e.creditCardCurrency) {
            byCurrency[e.creditCardCurrency] = (byCurrency[e.creditCardCurrency] || 0) + e.creditCardAmount
          }
        }
        const commissions = Object.entries(byCurrency)
          .filter(([, total]) => total > 0)
          .map(([currency, total]) => ({ currency, totalIncome: total, commission: total * rate / 100 }))
        return { staff: s, rate, commissions }
      })
      .filter(d => d.commissions.length > 0)
  })()

  const handleEdit = (entry: CashEntry) => {
    setEditingEntry(entry)
    setFormMode(isIncomeEntry(entry) ? "income" : "expense")
  }

  function EntryCard({ entry }: { entry: CashEntry }) {
    const kind = getEntryKind(entry)
    const meta = KIND_META[kind]
    const { amount, currency } = getEntryAmount(entry)
    const isIncome = isIncomeEntry(entry)
    return (
      <Card className={cn("border-l-4", meta.borderClass)}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] shrink-0">#{entry.voucherNo}</Badge>
                <Badge className={cn("text-[10px] shrink-0", meta.badgeClass)}>{meta.label}</Badge>
                {entry.agency && <span className="text-xs text-gray-600 truncate">{entry.agency.companyName || entry.agency.name}</span>}
                {entry.staff && <span className="text-xs text-gray-600 truncate">{entry.staff.user.name}</span>}
                {entry.expenseCategory && (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-red-200 text-red-600">
                    {getExpenseCategoryLabel(entry.expenseCategory)}
                  </Badge>
                )}
                {entry.incomeSubCategory && (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-200 text-emerald-600">
                    {getIncomeSubCategoryLabel(entry.incomeSubCategory)}
                  </Badge>
                )}
              </div>
              {entry.hotel && <p className="text-xs text-gray-500">{entry.hotel.name}{entry.roomNumber ? ` • Oda ${entry.roomNumber}` : ""}</p>}
              {entry.serviceName && <p className="text-xs text-gray-500">{entry.serviceName}{entry.pax ? ` • ${entry.pax} PAX` : ""}</p>}
              {entry.description && <p className="text-xs text-gray-600 mt-1">{entry.description}</p>}
              {entry.info && <p className="text-xs text-gray-400">{entry.info}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className={cn("text-lg font-bold", isIncome ? "text-emerald-700" : "text-red-600")}>
                {getCurrencySymbol(currency)} {amount.toLocaleString("tr-TR")}
              </span>
              <div className="flex gap-0.5">
                {canManageKasa && (
                <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(entry)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeletingId(entry.id)}>
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
                </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Günlük Kasa</h1>
          <p className="text-gray-500">{format(selectedDate, "d MMMM yyyy, EEEE", { locale: tr })}</p>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 w-full md:w-auto">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "dd.MM.yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false) } }} locale={tr} />
            </PopoverContent>
          </Popover>
          <div className="flex gap-2">
            <Button className="bg-emerald-600 hover:bg-emerald-700 flex-1 md:flex-none" onClick={() => { setEditingEntry(null); setFormMode("income") }}>
              <Plus className="h-4 w-4 mr-2" /> Gelir Ekle
            </Button>
            <Button className="bg-red-500 hover:bg-red-600 flex-1 md:flex-none" onClick={() => { setEditingEntry(null); setFormMode("expense") }}>
              <Minus className="h-4 w-4 mr-2" /> Gider Ekle
            </Button>
          </div>
        </div>
      </div>

      {/* Özet Kartları */}
      {summary && entries.length > 0 && (() => {
        const cashRows = CURRENCIES.map(cur => {
          const cashIn = summary.cashIncome[cur.value] || 0
          const commExp = summary.commissionExpense[cur.value] || 0
          const outgoing = (summary.credit[cur.value] || 0) + (summary.expense[cur.value] || 0) + commExp
          const net = cashIn - outgoing
          if (cashIn === 0 && outgoing === 0) return null
          return { cur, cashIn, outgoing, net, commExp }
        }).filter(Boolean) as { cur: typeof CURRENCIES[number]; cashIn: number; outgoing: number; net: number; commExp: number }[]

        const ccRows = CURRENCIES.map(cur => {
          const amount = summary.creditCardIncome[cur.value] || 0
          if (amount === 0) return null
          return { cur, amount }
        }).filter(Boolean) as { cur: typeof CURRENCIES[number]; amount: number }[]

        const muhasebeRows = CURRENCIES.map(cur => {
          const muhasebeCreditEntries = muhasebeEntries.filter(e => e.receptionIncomeAmount && e.receptionIncomeCurrency === cur.value)
          const muhasebeDebitEntries = muhasebeEntries.filter(e => e.expenseAmount && e.expenseCurrency === cur.value)
          const muhasebeAgencyEntries = muhasebeEntries.filter(e => e.agencyIncomeAmount && e.agencyIncomeCurrency === cur.value)
          const muhasebeStaffEntries = muhasebeEntries.filter(e => e.staffIncomeAmount && e.staffIncomeCurrency === cur.value)
          const muhasebeCCEntries = muhasebeEntries.filter(e => e.creditCardAmount && e.creditCardCurrency === cur.value)
          const totalCash = muhasebeCreditEntries.reduce((s, e) => s + (e.receptionIncomeAmount || 0), 0)
            + muhasebeAgencyEntries.reduce((s, e) => s + (e.agencyIncomeAmount || 0), 0)
            + muhasebeStaffEntries.reduce((s, e) => s + (e.staffIncomeAmount || 0), 0)
          const totalCC = muhasebeCCEntries.reduce((s, e) => s + (e.creditCardAmount || 0), 0)
          const totalIn = totalCash + totalCC
          const totalOut = muhasebeDebitEntries.reduce((s, e) => s + (e.expenseAmount || 0), 0)
          if (totalIn === 0 && totalOut === 0) return null
          return { cur, totalIn, totalCash, totalCC, totalOut }
        }).filter(Boolean) as { cur: typeof CURRENCIES[number]; totalIn: number; totalCash: number; totalCC: number; totalOut: number }[]

        if (cashRows.length === 0 && ccRows.length === 0 && muhasebeRows.length === 0) return null

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nakit Kasa */}
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <h3 className="font-semibold text-gray-700">Nakit Kasa</h3>
                </div>
                {cashRows.length === 0 ? (
                  <p className="text-sm text-gray-400">Nakit işlem yok</p>
                ) : (
                  <div className="space-y-3">
                    {cashRows.map(({ cur, cashIn, outgoing, net, commExp }) => (
                      <div key={cur.value} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="space-y-1">
                          <Badge className={cn("text-white text-xs", cur.bg)}>{cur.symbol} {cur.value}</Badge>
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span className="text-emerald-600">+{cashIn.toLocaleString("tr-TR")}</span>
                            <span className="text-red-500">-{outgoing.toLocaleString("tr-TR")}</span>
                          </div>
                          {commExp > 0 && (
                            <div className="text-[10px] text-amber-600">Prim: {cur.symbol}{commExp.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          )}
                        </div>
                        <div className={cn("text-xl font-bold", net >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {net < 0 ? "-" : ""}{cur.symbol} {Math.abs(net).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Euro Karşılığı */}
                {cashRows.length > 0 && exchangeRates?.rates && (() => {
                  let totalEur = 0
                  for (const { cur, net } of cashRows) {
                    if (cur.value === "EUR") {
                      totalEur += net
                    } else {
                      const converted = convertCurrency(Math.abs(net), cur.value, "EUR", exchangeRates.rates)
                      if (converted !== null) {
                        totalEur += net >= 0 ? converted : -converted
                      }
                    }
                  }
                  return (
                    <div className="mt-4 pt-3 border-t border-dashed border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-600">Euro Karşılığı</span>
                        <span className={cn("text-lg font-bold", totalEur >= 0 ? "text-blue-700" : "text-red-600")}>
                          {totalEur < 0 ? "-" : ""}€ {Math.abs(totalEur).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                {/* Kasa Genel Toplam: Nakit EUR + KK + Genel Toplam EUR */}
                {(cashRows.length > 0 || ccRows.length > 0) && exchangeRates?.rates && (() => {
                  // Nakit net → EUR
                  let cashEur = 0
                  for (const { cur, net } of cashRows) {
                    if (cur.value === "EUR") { cashEur += net }
                    else {
                      const c = convertCurrency(Math.abs(net), cur.value, "EUR", exchangeRates.rates)
                      if (c !== null) cashEur += net >= 0 ? c : -c
                    }
                  }
                  // KK → EUR
                  let ccEur = 0
                  for (const { cur, amount } of ccRows) {
                    if (cur.value === "EUR") { ccEur += amount }
                    else {
                      const c = convertCurrency(amount, cur.value, "EUR", exchangeRates.rates)
                      if (c !== null) ccEur += c
                    }
                  }
                  const grandEur = cashEur + ccEur

                  return (
                    <div className="mt-4 pt-4 border-t-2 border-gray-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-gray-600" />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Kasa Genel Toplam</span>
                        <span className="text-[10px] text-gray-400">(Nakit + KK)</span>
                      </div>
                      <div className="space-y-1.5">
                        {cashRows.length > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Nakit</span>
                            <span className={cn("font-semibold", cashEur >= 0 ? "text-emerald-700" : "text-red-600")}>
                              {cashEur < 0 ? "-" : ""}€ {Math.abs(cashEur).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {ccRows.length > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Kredi Kartı</span>
                            <span className="font-semibold text-violet-700">
                              € {ccEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-blue-200">
                        <span className="text-xs font-medium text-blue-600">Genel Toplam</span>
                        <span className={cn("text-lg font-bold", grandEur >= 0 ? "text-blue-700" : "text-red-600")}>
                          {grandEur < 0 ? "-" : ""}€ {Math.abs(grandEur).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Kredi Kartı */}
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <h3 className="font-semibold text-gray-700">Kredi Kartı</h3>
                  <span className="text-[10px] text-gray-400">(nakit kasaya dahil değil)</span>
                </div>
                {ccRows.length === 0 ? (
                  <p className="text-sm text-gray-400">Kredi kartı işlemi yok</p>
                ) : (
                  <div className="space-y-3">
                    {ccRows.map(({ cur, amount }) => (
                      <div key={cur.value} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <Badge className={cn("text-white text-xs", cur.bg)}>{cur.symbol} {cur.value}</Badge>
                        <div className="text-xl font-bold text-violet-700">
                          {cur.symbol} {amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Muhasebe */}
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <h3 className="font-semibold text-gray-700">Muhasebe</h3>
                  <span className="text-[10px] text-gray-400">(kasaya dahil değil)</span>
                </div>
                {muhasebeRows.length === 0 ? (
                  <p className="text-sm text-gray-400">Muhasebe girişi yok</p>
                ) : (
                  <div className="space-y-3">
                    {muhasebeRows.map(({ cur, totalCash, totalCC, totalOut }) => (
                      <div key={cur.value} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="space-y-1">
                          <Badge className={cn("text-white text-xs", cur.bg)}>{cur.symbol} {cur.value}</Badge>
                          <div className="flex flex-col gap-0.5 text-xs">
                            {totalCash > 0 && <span className="text-emerald-600">Nakit +{totalCash.toLocaleString("tr-TR")}</span>}
                            {totalCC > 0 && <span className="text-violet-600">KK +{totalCC.toLocaleString("tr-TR")}</span>}
                            {totalOut > 0 && <span className="text-red-500">Gider -{totalOut.toLocaleString("tr-TR")}</span>}
                          </div>
                        </div>
                        <div className={cn("text-xl font-bold", (totalCash + totalCC - totalOut) >= 0 ? "text-blue-700" : "text-red-600")}>
                          {cur.symbol} {Math.abs(totalCash + totalCC - totalOut).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      })()}

      {/* Entries */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Yükleniyor...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Bu tarihte kasa girişi yok</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Nakit Gelirler */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <h2 className="font-semibold text-emerald-800">Nakit Gelirler ({cashIncomeEntries.length})</h2>
            </div>
            {cashIncomeEntries.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nakit gelir girişi yok</p>
            ) : (
              cashIncomeEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
            )}
          </div>

          {/* Kredi Kartı Gelirleri */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-violet-500" />
              <h2 className="font-semibold text-violet-800">Kredi Kartı ({creditCardEntries.length})</h2>
              <span className="text-xs text-gray-400">(nakit dışı)</span>
            </div>
            {creditCardEntries.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Kredi kartı girişi yok</p>
            ) : (
              creditCardEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
            )}
          </div>

          {/* Giderler */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <h2 className="font-semibold text-red-800">Giderler ({expenseEntries.length + commissionData.reduce((a, d) => a + d.commissions.length, 0)})</h2>
            </div>
            {expenseEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)}
            {/* Prim Giderleri — sanal, otomatik hesaplanır */}
            {commissionData.map(({ staff: s, commissions }) =>
              commissions.map(cm => {
                const cur = CURRENCIES.find(c => c.value === cm.currency)
                return (
                  <Card key={`prim-${s.id}-${cm.currency}`} className="border-l-4 border-l-amber-400">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] shrink-0">Otomatik</Badge>
                            <Badge className="text-[10px] shrink-0 bg-amber-100 text-amber-700">Prim Gideri</Badge>
                            <span className="text-xs text-gray-600">{s.user.name}</span>
                          </div>
                          <p className="text-xs text-gray-500">%{s.commissionRate} prim · {cur?.symbol}{cm.totalIncome.toLocaleString("tr-TR")} gelir üzerinden</p>
                        </div>
                        <span className="text-lg font-bold text-red-600 shrink-0 ml-2">
                          -{cur?.symbol} {cm.commission.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
            {expenseEntries.length === 0 && commissionData.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Gider girişi yok</p>
            )}
          </div>

          {/* Muhasebe Girişleri */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <h2 className="font-semibold text-blue-800">Muhasebe ({muhasebeEntries.length})</h2>
              <span className="text-xs text-gray-400">(kasaya dahil değil)</span>
            </div>
            {muhasebeEntries.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Muhasebe girişi yok</p>
            ) : (
              muhasebeEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
            )}
          </div>
        </div>
      )}

      {/* Personel Prim Özeti */}
      {commissionData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personel Prim Özeti</CardTitle>
            <p className="text-xs text-gray-500">Prim tutarları otomatik olarak nakit kasa giderinden düşülmektedir</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personel</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead>Prim %</TableHead>
                  <TableHead className="text-right">Personel Geliri</TableHead>
                  <TableHead className="text-right text-amber-700">Prim Tutarı (Gider)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionData.map(({ staff: s, rate, commissions }) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.user.name}</TableCell>
                    <TableCell>{s.position || "-"}</TableCell>
                    <TableCell>%{rate}</TableCell>
                    <TableCell className="text-right">
                      {commissions.map(cm => {
                        const cur = CURRENCIES.find(c => c.value === cm.currency)
                        return <div key={cm.currency}>{cur?.symbol} {cm.totalIncome.toLocaleString("tr-TR")}</div>
                      })}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {commissions.map(cm => {
                        const cur = CURRENCIES.find(c => c.value === cm.currency)
                        return <div key={cm.currency}>{cur?.symbol} {cm.commission.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Income Form */}
      <IncomeFormDialog
        open={formMode === "income"}
        onOpenChange={(v) => { if (!v) { setFormMode(null); setEditingEntry(null) } }}
        editingEntry={editingEntry}
        agencies={agencies || []}
        staffList={staffList || []}
        dateStr={dateStr}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["kasa", dateStr] })
          setFormMode(null)
          setEditingEntry(null)
        }}
      />

      {/* Expense Form */}
      <ExpenseFormDialog
        open={formMode === "expense"}
        onOpenChange={(v) => { if (!v) { setFormMode(null); setEditingEntry(null) } }}
        editingEntry={editingEntry}
        dateStr={dateStr}
        staffList={staffList || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["kasa", dateStr] })
          setFormMode(null)
          setEditingEntry(null)
        }}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kasa Girişini Sil</AlertDialogTitle>
            <AlertDialogDescription>Bu kasa girişini silmek istediğinizden emin misiniz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => deletingId && deleteMutation.mutate(deletingId)}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---- Income Form ----
function IncomeFormDialog({ open, onOpenChange, editingEntry, agencies, staffList, dateStr, onSuccess }: {
  open: boolean; onOpenChange: (open: boolean) => void; editingEntry: CashEntry | null
  agencies: Agency[]; staffList: StaffMember[]; dateStr: string; onSuccess: () => void
}) {
  const isEditing = !!editingEntry

  const [incomeType, setIncomeType] = useState<"reception" | "agency" | "staff">("reception")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "creditCard">("cash")
  const [agencyId, setAgencyId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [description, setDescription] = useState("")
  const [subCategory, setSubCategory] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        if (editingEntry.agencyIncomeAmount) {
          setIncomeType("agency"); setPaymentMethod("cash")
          setAgencyId(editingEntry.agencyId || ""); setStaffId("")
          setAmount(editingEntry.agencyIncomeAmount?.toString() || "")
          setCurrency(editingEntry.agencyIncomeCurrency || "EUR")
          setSubCategory("")
        } else if (editingEntry.staffIncomeAmount) {
          setIncomeType("staff"); setPaymentMethod("cash")
          setStaffId(editingEntry.staffId || ""); setAgencyId("")
          setAmount(editingEntry.staffIncomeAmount?.toString() || "")
          setCurrency(editingEntry.staffIncomeCurrency || "EUR")
          setSubCategory(editingEntry.incomeSubCategory || "")
        } else if (editingEntry.creditCardAmount) {
          setIncomeType("reception"); setPaymentMethod("creditCard")
          setAgencyId(""); setStaffId("")
          setAmount(editingEntry.creditCardAmount?.toString() || "")
          setCurrency("TRY")
          setSubCategory(editingEntry.incomeSubCategory || "")
        } else {
          setIncomeType("reception"); setPaymentMethod("cash")
          setAgencyId(""); setStaffId("")
          setAmount(editingEntry.receptionIncomeAmount?.toString() || "")
          setCurrency(editingEntry.receptionIncomeCurrency || "EUR")
          setSubCategory(editingEntry.incomeSubCategory || "")
        }
        setDescription(editingEntry.description || "")
      } else {
        setIncomeType("reception"); setPaymentMethod("cash")
        setAgencyId(""); setStaffId(""); setAmount(""); setCurrency("EUR"); setDescription(""); setSubCategory("")
      }
    }
  }, [open, editingEntry])

  // Acenta seçildiğinde sadece nakit
  useEffect(() => {
    if (incomeType === "agency") setPaymentMethod("cash")
  }, [incomeType])

  // Kredi kartı seçildiğinde TRY'ye zorla
  useEffect(() => {
    if (paymentMethod === "creditCard") setCurrency("TRY")
  }, [paymentMethod])

  const handleSubmit = async () => {
    if (!amount) { toast.error("Miktar giriniz"); return }
    if (incomeType === "staff" && !staffId) { toast.error("Personel seçiniz"); return }
    if (incomeType === "staff" && !subCategory) { toast.error("Alt kategori seçiniz"); return }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { date: dateStr, description: description || null }

      if (paymentMethod === "creditCard") {
        payload.creditCardAmount = parseFloat(amount)
        payload.creditCardCurrency = "TRY"
        if (incomeType === "staff") payload.staffId = staffId
        if (incomeType === "reception" && subCategory) payload.incomeSubCategory = subCategory
      } else if (incomeType === "agency") {
        payload.agencyId = agencyId && agencyId !== "none" ? agencyId : null
        payload.agencyIncomeAmount = parseFloat(amount)
        payload.agencyIncomeCurrency = currency
      } else if (incomeType === "staff") {
        payload.staffId = staffId
        payload.staffIncomeAmount = parseFloat(amount)
        payload.staffIncomeCurrency = currency
        if (subCategory) payload.incomeSubCategory = subCategory
      } else {
        payload.receptionIncomeAmount = parseFloat(amount)
        payload.receptionIncomeCurrency = currency
        if (subCategory) payload.incomeSubCategory = subCategory
      }

      const url = isEditing ? `/api/kasa/${editingEntry.id}` : "/api/kasa"
      const method = isEditing ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "İşlem başarısız") }
      toast.success(isEditing ? "Güncellendi" : "Gelir eklendi")
      onSuccess()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full !max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-emerald-700">{isEditing ? "Gelir Düzenle" : "Gelir Ekle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Gelir Tipi */}
          <div className="flex gap-2">
            {([
              { key: "reception", label: "Resepsiyon", color: "bg-emerald-600 hover:bg-emerald-700" },
              { key: "agency",    label: "Acenta",      color: "bg-blue-600 hover:bg-blue-700" },
              { key: "staff",     label: "Personel",    color: "bg-amber-600 hover:bg-amber-700" },
            ] as const).map(({ key, label, color }) => (
              <Button key={key} type="button" variant={incomeType === key ? "default" : "outline"}
                className={cn("flex-1", incomeType === key && color)}
                onClick={() => setIncomeType(key)}>
                {label}
              </Button>
            ))}
          </div>

          {/* Ödeme Yöntemi — Acenta hariç */}
          {incomeType !== "agency" && (
            <div className="flex gap-2">
              <Button type="button" variant={paymentMethod === "cash" ? "default" : "outline"}
                className={cn("flex-1", paymentMethod === "cash" && "bg-gray-700 hover:bg-gray-800")}
                onClick={() => setPaymentMethod("cash")}>
                💵 Nakit
              </Button>
              <Button type="button" variant={paymentMethod === "creditCard" ? "default" : "outline"}
                className={cn("flex-1", paymentMethod === "creditCard" && "bg-violet-600 hover:bg-violet-700")}
                onClick={() => setPaymentMethod("creditCard")}>
                💳 Kredi Kartı
              </Button>
            </div>
          )}

          {paymentMethod === "creditCard" && (
            <div className="text-xs text-violet-600 bg-violet-50 rounded p-2">
              Kredi kartı geliri nakit kasaya dahil edilmez, ayrı gösterilir. Sadece TRY desteklenir.
            </div>
          )}

          {/* Acenta seçimi */}
          {incomeType === "agency" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Acenta</Label>
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Acenta seçin (opsiyonel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçiniz</SelectItem>
                  {agencies.map(a => <SelectItem key={a.id} value={a.id}>{a.companyName || a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Personel seçimi */}
          {incomeType === "staff" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Personel *</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {staffList.filter(s => s.isActive && s.position?.toLowerCase() === "infocu").map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.name}{s.position ? ` (${s.position})` : ""}
                      {s.commissionRate ? ` — %${s.commissionRate} prim` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resepsiyon veya Personel alt kategorisi */}
          {(incomeType === "reception" || incomeType === "staff") && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Alt Kategori{incomeType === "staff" ? " *" : ""}</Label>
              <Select value={subCategory || undefined} onValueChange={(v) => setSubCategory(v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  {incomeType === "reception" && (
                    <SelectItem value="none">Genel Resepsiyon Geliri</SelectItem>
                  )}
                  {INCOME_SUB_CATEGORIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Miktar */}
          <div className={cn("border rounded-lg p-3 space-y-2",
            paymentMethod === "creditCard" ? "bg-violet-50/50" : "bg-emerald-50/30"
          )}>
            <Label className={cn("text-xs font-semibold",
              paymentMethod === "creditCard" ? "text-violet-700" : "text-emerald-700"
            )}>Miktar</Label>
            <div className="flex gap-2 items-center">
              <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 h-10" />
              {paymentMethod === "creditCard" ? (
                <div className="h-8 px-3 text-xs font-bold rounded bg-orange-500 text-white flex items-center">₺ TRY</div>
              ) : (
                <CurrencyButtons value={currency} onChange={setCurrency} />
              )}
            </div>
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Açıklama</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama..." className="resize-none h-16" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button
              className={paymentMethod === "creditCard" ? "bg-violet-600 hover:bg-violet-700" : "bg-emerald-600 hover:bg-emerald-700"}
              onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Expense Form ----
function ExpenseFormDialog({ open, onOpenChange, editingEntry, dateStr, onSuccess, staffList }: {
  open: boolean; onOpenChange: (open: boolean) => void; editingEntry: CashEntry | null
  dateStr: string; onSuccess: () => void; staffList: StaffMember[]
}) {
  const isEditing = !!editingEntry
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("TRY")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [staffId, setStaffId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setAmount(editingEntry.expenseAmount?.toString() || "")
        setCurrency(editingEntry.expenseCurrency || "TRY")
        setDescription(editingEntry.description || "")
        setCategory(editingEntry.expenseCategory || "")
        setStaffId(editingEntry.staffId || "")
      } else {
        setAmount(""); setCurrency("TRY"); setDescription(""); setCategory(""); setStaffId("")
      }
    }
  }, [open, editingEntry])

  const handleSubmit = async () => {
    if (!amount) { toast.error("Miktar giriniz"); return }
    if (!category) { toast.error("Kategori seçiniz"); return }
    if (category === "GIDER_DIGER" && !description) { toast.error("Diğer giderler için açıklama giriniz"); return }
    if (category === "GIDER_PERSONEL_PRIM" && !staffId) { toast.error("Personel seçiniz"); return }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        date: dateStr,
        description: description || null,
        expenseAmount: parseFloat(amount),
        expenseCurrency: currency,
        expenseCategory: category,
        staffId: category === "GIDER_PERSONEL_PRIM" ? (staffId || null) : null,
      }
      const url = isEditing ? `/api/kasa/${editingEntry.id}` : "/api/kasa"
      const method = isEditing ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "İşlem başarısız") }
      toast.success(isEditing ? "Güncellendi" : "Gider eklendi")
      onSuccess()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full !max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">{isEditing ? "Gider Düzenle" : "Gider Ekle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Kategori */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Kategori *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Kategori seçin" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Personel seçimi — sadece prim kategorisi */}
          {category === "GIDER_PERSONEL_PRIM" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Personel *</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {staffList.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.name}{s.position ? ` (${s.position})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border rounded-lg p-3 space-y-2 bg-red-50/30">
            <Label className="text-xs font-semibold text-red-700">Miktar</Label>
            <div className="flex gap-2 items-center">
              <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 h-10" />
              <CurrencyButtons value={currency} onChange={setCurrency} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">
              Açıklama{category === "GIDER_DIGER" ? " *" : ""}
            </Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama..." className="resize-none h-16" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
