"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Plus, Minus, CalendarIcon, Pencil, Trash2, HandCoins, Printer, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { useSession } from "next-auth/react"
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
  pendingAmount: number | null
  pendingCurrency: string | null
  isPaid: boolean
  slipNo: string | null
  voucherDesc: string | null
  createdAt: string
  agency: { id: string; name: string; companyName: string | null } | null
  hotel: { id: string; name: string } | null
  staff: { id: string; position: string | null; commissionRate: number | null; user: { name: string } } | null
  createdByUser: { name: string } | null
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

interface RestAppointment {
  id: string
  customerName: string | null
  voucherNo: string | null
  pax: number | null
  childCount: number | null
  roomNumber: string | null
  restAmount: number
  restCurrency: string
  startTime: string
  notes: string | null
  agency: { id: string; name: string; companyName: string | null } | null
  hotel: { id: string; name: string } | null
  staff: { id: string; user: { name: string } } | null
  service: { id: string; name: string }
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
  if (entry.agencyIncomeAmount !== null && entry.agencyIncomeAmount !== undefined) return "agencyIncome"
  if (entry.receptionIncomeAmount !== null && entry.receptionIncomeAmount !== undefined) return "receptionIncome"
  if (entry.staffIncomeAmount !== null && entry.staffIncomeAmount !== undefined) return "staffIncome"
  // KK işlemleri: TÜR kolonu semantic tipi göstersin (KK bilgisi KK sütunundan anlaşılıyor)
  if (entry.creditCardAmount !== null && entry.creditCardAmount !== undefined) {
    if (entry.staff) return "staffIncome"
    if (entry.agency) return "agencyIncome"
    return "receptionIncome"
  }
  if (entry.creditAmount !== null && entry.creditAmount !== undefined) return "credit"
  return "expense"
}

function isIncomeEntry(entry: CashEntry): boolean {
  return (
    entry.agencyIncomeAmount !== null && entry.agencyIncomeAmount !== undefined ||
    entry.receptionIncomeAmount !== null && entry.receptionIncomeAmount !== undefined ||
    entry.staffIncomeAmount !== null && entry.staffIncomeAmount !== undefined ||
    entry.creditCardAmount !== null && entry.creditCardAmount !== undefined
  )
}

function getEntryAmount(entry: CashEntry): { amount: number; currency: string } {
  if (entry.agencyIncomeAmount !== null && entry.agencyIncomeAmount !== undefined && entry.agencyIncomeCurrency)
    return { amount: entry.agencyIncomeAmount, currency: entry.agencyIncomeCurrency }
  if (entry.receptionIncomeAmount !== null && entry.receptionIncomeAmount !== undefined && entry.receptionIncomeCurrency)
    return { amount: entry.receptionIncomeAmount, currency: entry.receptionIncomeCurrency }
  if (entry.staffIncomeAmount !== null && entry.staffIncomeAmount !== undefined && entry.staffIncomeCurrency)
    return { amount: entry.staffIncomeAmount, currency: entry.staffIncomeCurrency }
  if (entry.creditCardAmount !== null && entry.creditCardAmount !== undefined && entry.creditCardCurrency)
    return { amount: entry.creditCardAmount, currency: entry.creditCardCurrency }
  if (entry.creditAmount !== null && entry.creditAmount !== undefined && entry.creditCurrency)
    return { amount: entry.creditAmount, currency: entry.creditCurrency }
  if (entry.expenseAmount && entry.expenseCurrency)
    return { amount: entry.expenseAmount, currency: entry.expenseCurrency }
  return { amount: 0, currency: "TRY" }
}

const KIND_META: Record<EntryKind, { label: string; badgeClass: string; borderClass: string }> = {
  agencyIncome:    { label: "Acenta",      badgeClass: "bg-blue-100 text-blue-700",      borderClass: "border-l-blue-400" },
  receptionIncome: { label: "Resepsiyon",  badgeClass: "bg-emerald-100 text-emerald-700", borderClass: "border-l-emerald-400" },
  staffIncome:     { label: "İnfocu",      badgeClass: "bg-amber-100 text-amber-700",    borderClass: "border-l-amber-400" },
  creditCard:      { label: "Kredi Kartı", badgeClass: "bg-violet-100 text-violet-700",  borderClass: "border-l-violet-400" },
  credit:          { label: "Slip",        badgeClass: "bg-sky-100 text-sky-700",        borderClass: "border-l-sky-400" },
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
  const { data: session } = useSession()
  const canManageKasa = has("kasa_yonetimi")
  const canKasa = has("kasa_view")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formMode, setFormMode] = useState<"income" | "expense" | null>(null)
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [kasaTeslimOpen, setKasaTeslimOpen] = useState(false)
  const [kasaTeslimConfirm, setKasaTeslimConfirm] = useState(false)
  const [kasaTeslimAmounts, setKasaTeslimAmounts] = useState<Record<string, string>>({})
  const [kasaTeslimInfo, setKasaTeslimInfo] = useState<{ items: { currency: string; amount: number }[]; userName: string; time: string } | null>(null)
  const [paymentConfirmEntry, setPaymentConfirmEntry] = useState<CashEntry | null>(null)

  const dateStr = format(selectedDate, "yyyy-MM-dd")

  const { data, isLoading } = useQuery<{ entries: CashEntry[]; summary: Summary; restAppointments: RestAppointment[] }>({
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

  const kasaTeslimMutation = useMutation({
    mutationFn: async (items: { currency: string; amount: number }[]) => {
      // Her para birimi için kasa gider kaydı + muhasebe kaydı
      const results = await Promise.all(items.map(async ({ currency, amount }) => {
        // 1. CashEntry — gider olarak
        const kasaRes = await fetch("/api/kasa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateStr,
            expenseAmount: amount,
            expenseCurrency: currency,
            expenseCategory: "GIDER_KASA_TESLIM_BARIS",
            description: "Kasa Teslim - Barış Bey",
          }),
        })
        if (!kasaRes.ok) { const e = await kasaRes.json(); throw new Error(e.error || "Kasa kaydı oluşturulamadı") }
        // 2. Muhasebe cari hareketi — credit (cari + alacak)
        const muhRes = await fetch("/api/muhasebe/cari/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode: "GIDER_KASA_TESLIM_BARIS",
            date: dateStr,
            debit: 0,
            credit: amount,
            currency,
            description: `Kasa Teslim - ${dateStr}`,
          }),
        })
        if (!muhRes.ok) { const e = await muhRes.json(); throw new Error(e.error || "Muhasebe kaydı oluşturulamadı") }
      }))
      return results
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["kasa", dateStr] })
      toast.success("Kasa teslimi gerçekleştirildi")
      setKasaTeslimInfo({
        items,
        userName: session?.user?.name || "—",
        time: format(new Date(), "HH:mm"),
      })
      setKasaTeslimOpen(false)
      setKasaTeslimConfirm(false)
      setKasaTeslimAmounts({})
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setKasaTeslimConfirm(false)
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

  const paymentMutation = useMutation({
    mutationFn: async (entry: CashEntry) => {
      const { amount: currentAmount, currency } = getEntryAmount(entry)
      const fullAmount = currentAmount + (entry.pendingAmount || 0)
      const updatePayload: Record<string, unknown> = {
        isPaid: true,
        pendingAmount: null,
        pendingCurrency: null,
      }
      if (entry.agencyIncomeAmount) {
        updatePayload.agencyIncomeAmount = fullAmount
        updatePayload.agencyIncomeCurrency = currency
      } else if (entry.staffIncomeAmount) {
        updatePayload.staffIncomeAmount = fullAmount
        updatePayload.staffIncomeCurrency = currency
      } else {
        updatePayload.receptionIncomeAmount = fullAmount
        updatePayload.receptionIncomeCurrency = currency
      }
      const res = await fetch(`/api/kasa/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Güncellenemedi") }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kasa", dateStr] })
      toast.success("Ödeme alındı, kayıt güncellendi")
      setPaymentConfirmEntry(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const entries = data?.entries || []
  const summary = data?.summary
  const restAppointments = data?.restAppointments || []

  // Muhasebe girişlerini kasadan ayır
  const muhasebeEntries = entries.filter(e => e.info === "MUHASEBE")
  const kasaEntries = entries.filter(e => e.info !== "MUHASEBE")

  // Gelirler: kredi kartı hariç nakit gelirler + kredi kartları ayrı
  const cashIncomeEntries = kasaEntries.filter(e => !!(e.agencyIncomeAmount || e.receptionIncomeAmount || e.staffIncomeAmount))
  const creditCardEntries = kasaEntries.filter(e => !!e.creditCardAmount)
  const expenseEntries = kasaEntries.filter(e => !isIncomeEntry(e))

  const primData = (() => {
    if (!staffList) return []
    return staffList
      .filter(s => s.isActive && s.commissionRate && s.commissionRate > 0)
      .map(s => {
        const rate = s.commissionRate!
        const byCurrency: Record<string, { cash: number; cc: number }> = {}
        for (const e of kasaEntries) {
          if (e.staffId === s.id && e.staffIncomeAmount && e.staffIncomeCurrency) {
            if (!byCurrency[e.staffIncomeCurrency]) byCurrency[e.staffIncomeCurrency] = { cash: 0, cc: 0 }
            byCurrency[e.staffIncomeCurrency].cash += e.staffIncomeAmount
          }
          if (e.staffId === s.id && e.creditCardAmount && e.creditCardCurrency) {
            if (!byCurrency[e.creditCardCurrency]) byCurrency[e.creditCardCurrency] = { cash: 0, cc: 0 }
            byCurrency[e.creditCardCurrency].cc += e.creditCardAmount
          }
        }
        const currencies = Object.entries(byCurrency).filter(([, v]) => v.cash + v.cc > 0)
        if (currencies.length === 0) return null
        return {
          staff: s, rate, byCurrency: currencies,
          entries: kasaEntries.filter(e => e.staffId === s.id && (e.staffIncomeAmount || e.creditCardAmount))
        }
      })
      .filter(Boolean) as { staff: StaffMember; rate: number; byCurrency: [string, { cash: number; cc: number }][]; entries: CashEntry[] }[]
  })()

  const handleEdit = (entry: CashEntry) => {
    setEditingEntry(entry)
    setFormMode(isIncomeEntry(entry) ? "income" : "expense")
  }


  const CURS = ["TRY", "EUR", "USD", "GBP"] as const
  const CUR_SYM: Record<string, string> = { TRY: "₺", EUR: "€", USD: "$", GBP: "£" }

  function KasaTable({ entries, summary, onEdit, onDelete, onPayment, canManageKasa, canKasa }: {
    entries: CashEntry[]
    summary: Summary
    onEdit: (e: CashEntry) => void
    onDelete: (id: string) => void
    onPayment: (e: CashEntry) => void
    canManageKasa: boolean
    canKasa: boolean
  }) {
    const [descEntry, setDescEntry] = useState<CashEntry | null>(null)
    const amt = (v: number | null) => v && v > 0 ? v.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ""

    // Toplam satırı için summary değerleri (muhasebe hariç zaten)
    const totAgency   = (cur: string) => summary.agencyIncome[cur] || 0
    const totRecep    = (cur: string) => summary.receptionIncome[cur] || 0
    const totStaff    = (cur: string) => summary.staffIncome[cur] || 0
    const totCC       = (cur: string) => summary.creditCardIncome[cur] || 0
    const totCredit   = (cur: string) => summary.credit[cur] || 0
    const totExpense  = (cur: string) => summary.expense[cur] || 0
    const netCash     = (cur: string) => (summary.cashIncome[cur] || 0) - (summary.credit[cur] || 0) - (summary.expense[cur] || 0)

    const thBase = "px-1 py-1 text-center text-[10px] font-bold border border-gray-300 whitespace-nowrap"
    const tdBase = "px-1 py-1 text-center text-[11px] border border-gray-200 tabular-nums whitespace-nowrap"
    const tdInfo = "px-1 py-1 text-[11px] border border-gray-200"

    return (
      <>
      <div className="rounded-lg border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[11px] table-auto">
          <thead>
            {/* Grup başlıkları */}
            <tr>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>#</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>VOUCHER</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>TÜR</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>HİZMET</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>ACENTA / PERSONEL</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>OTEL</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}>AÇIKLAMA</th>
              <th colSpan={4} className={cn(thBase, "bg-blue-100 text-blue-800")}>GELİR ACENTA</th>
              <th colSpan={4} className={cn(thBase, "bg-emerald-100 text-emerald-800")}>GELİR RESEPSİYON</th>
              <th colSpan={4} className={cn(thBase, "bg-amber-100 text-amber-800")}>GELİR İNFOCU</th>
              <th colSpan={1} className={cn(thBase, "bg-violet-100 text-violet-800")}>KREDİ KARTI</th>
              <th colSpan={1} className={cn(thBase, "bg-sky-100 text-sky-800")}>SLİP</th>
              <th colSpan={4} className={cn(thBase, "bg-red-100 text-red-800")}>GİDER</th>
              <th rowSpan={2} className={cn(thBase, "bg-gray-100")}></th>
            </tr>
            <tr>
              {/* Acenta */}
              {CURS.map(c => <th key={`ag-${c}`} className={cn(thBase, "bg-blue-50 text-blue-700")}>{CUR_SYM[c]}</th>)}
              {/* Resepsiyon */}
              {CURS.map(c => <th key={`re-${c}`} className={cn(thBase, "bg-emerald-50 text-emerald-700")}>{CUR_SYM[c]}</th>)}
              {/* Personel */}
              {CURS.map(c => <th key={`st-${c}`} className={cn(thBase, "bg-amber-50 text-amber-700")}>{CUR_SYM[c]}</th>)}
              {/* KK */}
              <th className={cn(thBase, "bg-violet-50 text-violet-700")}>₺</th>
              {/* Kredi / Slip */}
              <th className={cn(thBase, "bg-sky-50 text-sky-700")}>Slip No</th>
              {/* Gider */}
              {CURS.map(c => <th key={`ex-${c}`} className={cn(thBase, "bg-red-50 text-red-700")}>{CUR_SYM[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => {
              const isIncome = isIncomeEntry(e)
              const isPending = isIncome && e.isPaid === false
              const rowBg = isPending ? "bg-yellow-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
              const { amount, currency } = getEntryAmount(e)
              const kind = getEntryKind(e)
              return (
                <tr key={e.id} className={cn(rowBg, "hover:bg-blue-50/30 transition-colors")}>
                  {/* # (voucher no) */}
                  <td className={cn(tdInfo, "text-gray-400 text-center whitespace-nowrap")}>{e.voucherNo}</td>
                  {/* VOUCHER (fiş no), ortalı */}
                  <td className={cn(tdInfo, "text-gray-600 text-center whitespace-nowrap text-[10px]")}>
                    {e.voucherDesc || ""}
                  </td>
                  {/* TÜR */}
                  <td className={cn(tdInfo, "text-center whitespace-nowrap")}>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", KIND_META[kind].badgeClass)}>
                      {KIND_META[kind].label}
                    </span>
                    {kind === "staffIncome" && e.staff && (
                      <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        {e.staff.user.name}
                      </span>
                    )}
                    {e.incomeSubCategory === "GELIR_REST" && (
                      <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">REST</span>
                    )}
                    {isPending && <span className="block text-[9px] text-yellow-600 mt-0.5">⏳</span>}
                  </td>
                  {/* HİZMET / gelir kalemi (+ KK işareti) */}
                  <td className={cn(tdInfo, "text-gray-600 whitespace-nowrap text-[10px]")}>
                    {e.expenseCategory
                      ? getExpenseCategoryLabel(e.expenseCategory)
                      : e.incomeSubCategory
                        ? getIncomeSubCategoryLabel(e.incomeSubCategory)
                        : kind === "agencyIncome"
                          ? "Acenta Genel"
                          : ""}
                    {e.creditCardAmount !== null && e.creditCardAmount !== undefined && (
                      <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">KK</span>
                    )}
                  </td>
                  {/* ACENTA / PERSONEL */}
                  <td className={cn(tdInfo, "text-gray-700 whitespace-nowrap")}>
                    {e.agency ? (e.agency.companyName || e.agency.name) : e.staff ? e.staff.user.name : ""}
                  </td>
                  {/* OTEL */}
                  <td className={cn(tdInfo, "text-gray-600 whitespace-nowrap text-[10px]")}>
                    {e.hotel ? e.hotel.name : ""}
                  </td>
                  {/* AÇIKLAMA — wrap edilebilir (okunabilirlik için) */}
                  <td
                    className={cn(tdInfo, "text-gray-500 break-words min-w-[120px] cursor-pointer hover:bg-blue-50/50 hover:text-blue-700")}
                    onClick={() => setDescEntry(e)}
                    title="Detay için tıklayın"
                  >
                    {e.description || <span className="text-gray-300 text-[10px]">detay</span>}
                    {isPending && e.pendingAmount ? (
                      <span className="block text-[9px] text-yellow-600">Kalan: {CUR_SYM[e.pendingCurrency || "TRY"]}{e.pendingAmount.toLocaleString("tr-TR")}</span>
                    ) : null}
                  </td>
                  {/* GELİR ACENTA */}
                  {CURS.map(c => (
                    <td key={`ag-${c}`} className={cn(tdBase, "bg-blue-50/30 text-blue-700")}>
                      {e.agencyIncomeCurrency === c ? amt(e.agencyIncomeAmount) : ""}
                    </td>
                  ))}
                  {/* GELİR RESEPSİYON */}
                  {CURS.map(c => (
                    <td key={`re-${c}`} className={cn(tdBase, "bg-emerald-50/30 text-emerald-700")}>
                      {e.receptionIncomeCurrency === c ? amt(e.receptionIncomeAmount) : ""}
                    </td>
                  ))}
                  {/* GELİR PERSONEL */}
                  {CURS.map(c => (
                    <td key={`st-${c}`} className={cn(tdBase, "bg-amber-50/30 text-amber-700")}>
                      {e.staffIncomeCurrency === c ? amt(e.staffIncomeAmount) : ""}
                    </td>
                  ))}
                  {/* KREDİ KARTI */}
                  <td className={cn(tdBase, "bg-violet-50/30 text-violet-700")}>
                    {e.creditCardCurrency === "TRY" ? amt(e.creditCardAmount) : ""}
                  </td>
                  {/* SLİP */}
                  <td className={cn(tdBase, "bg-sky-50/30 text-sky-700 text-xs")}>
                    {e.creditCardAmount && e.slipNo ? e.slipNo : ""}
                  </td>
                  {/* GİDER */}
                  {CURS.map(c => (
                    <td key={`ex-${c}`} className={cn(tdBase, "bg-red-50/30 text-red-600")}>
                      {e.expenseCurrency === c ? amt(e.expenseAmount) : ""}
                    </td>
                  ))}
                  {/* İşlemler */}
                  <td className={cn(tdInfo, "text-center")}>
                    <div className="flex items-center justify-center gap-0.5">
                      {isPending && (canManageKasa || canKasa) && (
                        <button onClick={() => onPayment(e)} className="p-0.5 rounded hover:bg-emerald-100 text-yellow-600 hover:text-emerald-700" title="Ödeme alındı">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManageKasa && (
                        <>
                          <button onClick={() => onEdit(e)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => onDelete(e.id)} className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {/* Toplam */}
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
              <td colSpan={7} className={cn(tdInfo, "text-right text-xs font-bold text-gray-700 bg-gray-100")}>TOPLAM</td>
              {CURS.map(c => <td key={`ag-${c}`} className={cn(tdBase, "bg-blue-100 text-blue-800 font-bold")}>{totAgency(c) > 0 ? `${CUR_SYM[c]}${totAgency(c).toLocaleString("tr-TR")}` : ""}</td>)}
              {CURS.map(c => <td key={`re-${c}`} className={cn(tdBase, "bg-emerald-100 text-emerald-800 font-bold")}>{totRecep(c) > 0 ? `${CUR_SYM[c]}${totRecep(c).toLocaleString("tr-TR")}` : ""}</td>)}
              {CURS.map(c => <td key={`st-${c}`} className={cn(tdBase, "bg-amber-100 text-amber-800 font-bold")}>{totStaff(c) > 0 ? `${CUR_SYM[c]}${totStaff(c).toLocaleString("tr-TR")}` : ""}</td>)}
              <td className={cn(tdBase, "bg-violet-100 text-violet-800 font-bold")}>{totCC("TRY") > 0 ? `₺${totCC("TRY").toLocaleString("tr-TR")}` : ""}</td>
              <td className={cn(tdBase, "bg-sky-100 text-sky-800 font-bold")}></td>
              {CURS.map(c => <td key={`ex-${c}`} className={cn(tdBase, "bg-red-100 text-red-700 font-bold")}>{totExpense(c) > 0 ? `${CUR_SYM[c]}${totExpense(c).toLocaleString("tr-TR")}` : ""}</td>)}
              <td className={cn(tdInfo, "bg-gray-100")}></td>
            </tr>
            {/* Kalan (Net nakit) */}
            <tr className="bg-gray-200 font-bold">
              <td colSpan={7} className={cn(tdInfo, "text-right text-xs font-bold text-gray-700 bg-gray-200")}>KALAN</td>
              {/* Acenta toplam (gelir) */}
              {CURS.map(c => <td key={`ag-${c}`} className={cn(tdBase, "bg-blue-50 text-blue-900 font-bold")}>{totAgency(c) > 0 ? `${CUR_SYM[c]}${totAgency(c).toLocaleString("tr-TR")}` : ""}</td>)}
              {/* Resepsiyon toplam */}
              {CURS.map(c => <td key={`re-${c}`} className={cn(tdBase, "bg-emerald-50 text-emerald-900 font-bold")}>{totRecep(c) > 0 ? `${CUR_SYM[c]}${totRecep(c).toLocaleString("tr-TR")}` : ""}</td>)}
              {/* Personel toplam */}
              {CURS.map(c => <td key={`st-${c}`} className={cn(tdBase, "bg-amber-50 text-amber-900 font-bold")}>{totStaff(c) > 0 ? `${CUR_SYM[c]}${totStaff(c).toLocaleString("tr-TR")}` : ""}</td>)}
              {/* KK */}
              <td className={cn(tdBase, "bg-violet-50 text-violet-900 font-bold")}>{totCC("TRY") > 0 ? `₺${totCC("TRY").toLocaleString("tr-TR")}` : ""}</td>
              {/* Net nakit (cashIncome - kredi - gider) */}
              <td colSpan={5} className={cn(tdInfo, "bg-gray-200")}>
                <div className="flex gap-2 justify-end flex-wrap">
                  {CURS.map(c => {
                    const net = netCash(c)
                    if (net === 0) return null
                    return (
                      <span key={c} className={cn("text-xs font-bold", net >= 0 ? "text-emerald-700" : "text-red-600")}>
                        {net < 0 ? "-" : ""}{CUR_SYM[c]}{Math.abs(net).toLocaleString("tr-TR")}
                      </span>
                    )
                  })}
                </div>
              </td>
              <td className={cn(tdInfo, "bg-gray-200")}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* İşlem Detay Modalı */}
      <Dialog open={!!descEntry} onOpenChange={(v) => { if (!v) setDescEntry(null) }}>
        <DialogContent className="w-full !max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-700">
              <span>#{descEntry?.voucherNo}</span>
              {descEntry && (
                <span className={cn("px-2 py-0.5 rounded text-[11px] font-semibold", KIND_META[getEntryKind(descEntry)].badgeClass)}>
                  {KIND_META[getEntryKind(descEntry)].label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {descEntry && (() => {
            const { amount, currency } = getEntryAmount(descEntry)
            const isIncome = isIncomeEntry(descEntry)
            const isPending = isIncome && descEntry.isPaid === false
            return (
              <div className="space-y-3">
                {/* Tutar */}
                <div className={cn("rounded-lg px-4 py-3 flex items-center justify-between", isIncome ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
                  <span className="text-xs font-medium text-gray-500">Tutar</span>
                  <span className={cn("text-xl font-bold", isIncome ? "text-emerald-700" : "text-red-600")}>
                    {getCurrencySymbol(currency)} {amount.toLocaleString("tr-TR")}
                  </span>
                </div>

                {/* Kısmi ödeme */}
                {isPending && descEntry.pendingAmount && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Alınan:</span>
                      <span className="font-semibold text-emerald-700">{getCurrencySymbol(currency)} {amount.toLocaleString("tr-TR")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Kalan:</span>
                      <span className="font-semibold text-yellow-700">{getCurrencySymbol(descEntry.pendingCurrency || currency)} {descEntry.pendingAmount.toLocaleString("tr-TR")}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-yellow-300 pt-1">
                      <span className="text-gray-600 font-medium">Toplam:</span>
                      <span className="font-bold">{getCurrencySymbol(currency)} {(amount + descEntry.pendingAmount).toLocaleString("tr-TR")}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {/* Saat */}
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Saat</p>
                    <p className="font-medium text-gray-700">{format(new Date(descEntry.createdAt), "HH:mm")}</p>
                  </div>
                  {/* İşlemi yapan */}
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">İşlemi Yapan</p>
                    <p className="font-medium text-gray-700">{descEntry.createdByUser?.name || "—"}</p>
                  </div>
                  {/* Acenta */}
                  {descEntry.agency && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-blue-400 mb-0.5">Acenta</p>
                      <p className="font-medium text-blue-700">{descEntry.agency.companyName || descEntry.agency.name}</p>
                    </div>
                  )}
                  {/* Personel */}
                  {descEntry.staff && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-amber-400 mb-0.5">Personel</p>
                      <p className="font-medium text-amber-700">{descEntry.staff.user.name}</p>
                    </div>
                  )}
                  {/* Otel */}
                  {descEntry.hotel && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Otel{descEntry.roomNumber ? " · Oda" : ""}</p>
                      <p className="font-medium text-gray-700">{descEntry.hotel.name}{descEntry.roomNumber ? ` · ${descEntry.roomNumber}` : ""}</p>
                    </div>
                  )}
                  {/* Hizmet */}
                  {descEntry.serviceName && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Hizmet{descEntry.pax ? " · PAX" : ""}</p>
                      <p className="font-medium text-gray-700">{descEntry.serviceName}{descEntry.pax ? ` · ${descEntry.pax} PAX` : ""}</p>
                    </div>
                  )}
                  {/* Gider kategorisi */}
                  {descEntry.expenseCategory && (
                    <div className="bg-red-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-red-400 mb-0.5">Gider Kategorisi</p>
                      <p className="font-medium text-red-700">{getExpenseCategoryLabel(descEntry.expenseCategory)}</p>
                    </div>
                  )}
                  {/* Alt kategori */}
                  {descEntry.incomeSubCategory && (
                    <div className="bg-emerald-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-emerald-400 mb-0.5">Kategori</p>
                      <p className="font-medium text-emerald-700">{getIncomeSubCategoryLabel(descEntry.incomeSubCategory)}</p>
                    </div>
                  )}
                  {/* Slip No — sadece KK */}
                  {descEntry.creditCardAmount && descEntry.slipNo && (
                    <div className="bg-violet-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-violet-400 mb-0.5">Slip No</p>
                      <p className="font-medium text-violet-700">{descEntry.slipNo}</p>
                    </div>
                  )}
                </div>

                {/* Açıklama */}
                {descEntry.description && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Açıklama</p>
                    <p className="text-sm text-gray-700">{descEntry.description}</p>
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
      </>
    )
  }

  function EntryCard({ entry }: { entry: CashEntry }) {
    const kind = getEntryKind(entry)
    const meta = KIND_META[kind]
    const { amount, currency } = getEntryAmount(entry)
    const isIncome = isIncomeEntry(entry)
    const isPending = isIncome && entry.isPaid === false
    const hasPaid = isIncome && entry.isPaid === true && entry.pendingAmount

    const cardBorderClass = isPending ? "border-l-yellow-400" : meta.borderClass

    return (
      <Card className={cn("border-l-4", cardBorderClass)}>
        <CardContent className={cn("p-3", isPending && "bg-yellow-50/40")}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] shrink-0">#{entry.voucherNo}</Badge>
                <Badge className={cn("text-[10px] shrink-0", meta.badgeClass)}>{meta.label}</Badge>
                {isPending && (
                  <Badge className="text-[10px] shrink-0 bg-yellow-100 text-yellow-800 border border-yellow-300">
                    <Clock className="h-2.5 w-2.5 mr-1" />
                    Bekleyen Ödeme
                  </Badge>
                )}
                {hasPaid && (
                  <Badge className="text-[10px] shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    Ödendi
                  </Badge>
                )}
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
              {isPending && entry.pendingAmount && entry.pendingCurrency && (
                <p className="text-xs text-yellow-700 font-medium mt-1">
                  Kalan: {getCurrencySymbol(entry.pendingCurrency)} {entry.pendingAmount.toLocaleString("tr-TR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <div className="flex flex-col items-end gap-1">
                <span className={cn("text-lg font-bold", isIncome ? "text-emerald-700" : "text-red-600")}>
                  {getCurrencySymbol(currency)} {amount.toLocaleString("tr-TR")}
                </span>
                <span className="text-[10px] text-gray-400">
                  {format(new Date(entry.createdAt), "HH:mm")}
                  {entry.createdByUser && ` · ${entry.createdByUser.name}`}
                </span>
              </div>
              <div className="flex gap-0.5">
                {isPending && (canManageKasa || canKasa) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-yellow-600 hover:text-emerald-600 hover:bg-emerald-50"
                    onClick={() => setPaymentConfirmEntry(entry)}
                    title="Ödeme alındı"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
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
            {(canManageKasa || canKasa) && (
              <Button
                className="bg-amber-600 hover:bg-amber-700 flex-1 md:flex-none"
                onClick={() => {
                  setKasaTeslimAmounts({})
                  setKasaTeslimOpen(true)
                }}
              >
                <HandCoins className="h-4 w-4 mr-2" /> Kasa Teslim
              </Button>
            )}
            {!isLoading && entries.length > 0 && (
              <Button
                variant="outline"
                className="flex-1 md:flex-none"
                onClick={() => {
                  const dateLabel = format(selectedDate, "d MMMM yyyy, EEEE", { locale: tr })
                  const printedAt = format(new Date(), "dd.MM.yyyy HH:mm", { locale: tr })
                  const userName = session?.user?.name || "—"
                  printKasaReport({ dateLabel, printedAt, userName, entries: kasaEntries, summary: summary!, exchangeRates: exchangeRates?.rates })
                }}
              >
                <Printer className="h-4 w-4 mr-2" /> Yazdır
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Özet Kartları */}
      {summary && entries.length > 0 && (() => {
        const cashRows = CURRENCIES.map(cur => {
          const cashIn = summary.cashIncome[cur.value] || 0
          const outgoing = (summary.credit[cur.value] || 0) + (summary.expense[cur.value] || 0)
          const net = cashIn - outgoing
          if (cashIn === 0 && outgoing === 0) return null
          return { cur, cashIn, outgoing, net }
        }).filter(Boolean) as { cur: typeof CURRENCIES[number]; cashIn: number; outgoing: number; net: number }[]

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

        // Rest toplamları — kasa girişlerindeki GELIR_REST kayıtlarından
        const restByCurrency: Record<string, number> = {}
        const restKKByCurrency: Record<string, number> = {}
        for (const e of kasaEntries) {
          if (e.incomeSubCategory === "GELIR_REST") {
            const isKK = e.creditCardAmount !== null && e.creditCardAmount !== undefined && e.creditCardAmount > 0
            if (isKK) {
              const cur = e.creditCardCurrency || "TRY"
              restKKByCurrency[cur] = (restKKByCurrency[cur] || 0) + e.creditCardAmount!
            } else {
              const { amount, currency } = getEntryAmount(e)
              if (amount > 0) restByCurrency[currency] = (restByCurrency[currency] || 0) + amount
            }
          }
        }
        const restRows = Object.entries(restByCurrency)
        const restKKRows = Object.entries(restKKByCurrency)

        if (cashRows.length === 0 && ccRows.length === 0 && muhasebeRows.length === 0 && restRows.length === 0 && restKKRows.length === 0) return null

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
                    {cashRows.map(({ cur, cashIn, outgoing, net }) => (
                      <div key={cur.value} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="space-y-1">
                          <Badge className={cn("text-white text-xs", cur.bg)}>{cur.symbol} {cur.value}</Badge>
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span className="text-emerald-600">+{cashIn.toLocaleString("tr-TR")}</span>
                            <span className="text-red-500">-{outgoing.toLocaleString("tr-TR")}</span>
                          </div>
                        </div>
                        <div className={cn("text-xl font-bold", net >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {net < 0 ? "-" : ""}{cur.symbol} {Math.abs(net).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* KK + Genel Toplam */}
                {(cashRows.length > 0 || ccRows.length > 0) && exchangeRates?.rates && (() => {
                  let cashEur = 0
                  for (const { cur, net } of cashRows) {
                    if (cur.value === "EUR") { cashEur += net }
                    else {
                      const c = convertCurrency(Math.abs(net), cur.value, "EUR", exchangeRates.rates)
                      if (c !== null) cashEur += net >= 0 ? c : -c
                    }
                  }
                  // KK sadece TRY destekli
                  const ccTRY = ccRows.reduce((s, { cur, amount }) => cur.value === "TRY" ? s + amount : s, 0)
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
                    <div className="mt-4 space-y-0">
                      {ccRows.length > 0 && (
                        <div className="flex items-center justify-between pt-3 border-t border-dashed border-violet-200">
                          <span className="text-xs font-medium text-violet-600">Kredi Kartı (TL)</span>
                          <span className="text-base font-bold text-violet-700">
                            ₺ {ccTRY.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t border-dashed border-blue-200 mt-2">
                        <span className="text-xs font-medium text-blue-600" title="Net nakit kasa (gider ve slip düşülmüş) + KK toplamının € karşılığı">Net Kasa + KK (€)</span>
                        <span className={cn("text-lg font-bold", grandEur >= 0 ? "text-blue-700" : "text-red-600")}>
                          {grandEur < 0 ? "-" : ""}€ {Math.abs(grandEur).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {(() => {
                        // RESTSİZ: rest tutarlarını EUR'a çevir ve grandEur'dan çıkar
                        let restEur = 0
                        for (const [cur, amt] of restRows) {
                          if (cur === "EUR") { restEur += amt }
                          else {
                            const c = convertCurrency(amt, cur, "EUR", exchangeRates.rates)
                            if (c !== null) restEur += c
                          }
                        }
                        for (const [cur, amt] of restKKRows) {
                          if (cur === "EUR") { restEur += amt }
                          else {
                            const c = convertCurrency(amt, cur, "EUR", exchangeRates.rates)
                            if (c !== null) restEur += c
                          }
                        }
                        const restlessEur = grandEur - restEur
                        return (
                          <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-300 mt-1">
                            <span className="text-[11px] font-semibold text-gray-500">Restsiz Genel Toplam</span>
                            <span className={cn("text-base font-bold", restlessEur >= 0 ? "text-gray-700" : "text-red-600")}>
                              {restlessEur < 0 ? "-" : ""}€ {Math.abs(restlessEur).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Kredi Kartı + Toplam Rest */}
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                {/* Kredi Kartı */}
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

                {/* Toplam Rest — ayırıcıyla altında */}
                <div className="border-t border-dashed border-rose-200 mt-4 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <h3 className="font-semibold text-gray-700">Toplam Rest</h3>
                    {(restRows.length > 0 || restKKRows.length > 0) && (
                      <span className="text-[10px] text-rose-400">({restRows.length + restKKRows.length} kalem)</span>
                    )}
                  </div>
                  {restRows.length === 0 && restKKRows.length === 0 ? (
                    <p className="text-sm text-gray-400">Rest işlemi yok</p>
                  ) : (
                    <div
                      className="space-y-2 cursor-pointer"
                      onClick={() => {
                        // RestSummaryCard modalını tetiklemek için global event
                        window.dispatchEvent(new CustomEvent("open-rest-modal"))
                      }}
                    >
                      {restRows.map(([cur, amt]) => {
                        const c = CURRENCIES.find(x => x.value === cur)
                        return (
                          <div key={cur} className="flex items-center justify-between py-1">
                            <Badge className={cn("text-white text-xs", c?.bg ?? "bg-gray-500")}>{c?.symbol} {cur}</Badge>
                            <div className="text-xl font-bold text-rose-700">
                              {c?.symbol} {amt.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )
                      })}
                      {restKKRows.map(([cur, amt]) => {
                        const c = CURRENCIES.find(x => x.value === cur)
                        return (
                          <div key={`kk-${cur}`} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-1.5">
                              <Badge className="text-white text-xs bg-violet-500">{c?.symbol} {cur}</Badge>
                              <span className="text-[10px] font-bold text-violet-600">KK</span>
                            </div>
                            <div className="text-xl font-bold text-violet-700">
                              {c?.symbol} {amt.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        )
                      })}
                      <p className="text-[10px] text-rose-400 text-right">Detay için tıklayın</p>
                    </div>
                  )}
                </div>
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

      {/* Kasa Teslim Bilgi Kutusu */}
      {kasaTeslimInfo && (
        <div className="border border-emerald-300 rounded-xl bg-emerald-50 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Kasa Teslim Edildi</p>
              <p className="text-xs text-emerald-600">{kasaTeslimInfo.userName} · {kasaTeslimInfo.time}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {kasaTeslimInfo.items.map(({ currency, amount }) => {
              const c = CURRENCIES.find(x => x.value === currency)
              return (
                <span key={currency} className={cn("text-sm font-bold px-3 py-1 rounded-full text-white", c?.bg ?? "bg-gray-500")}>
                  {c?.symbol} {amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* İnfocu Prim Tablosu */}
      {primData.length > 0 && <PrimTable primData={primData} exchangeRates={exchangeRates?.rates} />}

      {/* Entries */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Yükleniyor...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Bu tarihte kasa girişi yok</div>
      ) : (
        <>
          {/* Desktop: Excel tablo görünümü */}
          <div className="hidden lg:block">
            <KasaTable
              entries={kasaEntries}
              summary={summary!}
              onEdit={handleEdit}
              onDelete={(id) => setDeletingId(id)}
              onPayment={(entry) => setPaymentConfirmEntry(entry)}
              canManageKasa={canManageKasa}
              canKasa={canKasa}
            />
          </div>

          {/* Mobil: Kart görünümü */}
          <div className="lg:hidden grid grid-cols-1 gap-6">
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-violet-500" />
                <h2 className="font-semibold text-violet-800">Kredi Kartı ({creditCardEntries.length})</h2>
              </div>
              {creditCardEntries.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Kredi kartı girişi yok</p>
              ) : (
                creditCardEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <h2 className="font-semibold text-red-800">Giderler ({expenseEntries.length})</h2>
              </div>
              {expenseEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)}
              {expenseEntries.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Gider girişi yok</p>
              )}
            </div>
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

          {/* Muhasebe girişleri — desktop'ta tablo altında ayrı */}
          {muhasebeEntries.length > 0 && (
            <div className="hidden lg:block space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <h2 className="font-semibold text-blue-800 text-sm">Muhasebe ({muhasebeEntries.length})</h2>
                <span className="text-xs text-gray-400">(kasaya dahil değil)</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-blue-100">
                <table className="w-full text-xs">
                  <tbody>
                    {muhasebeEntries.map(entry => {
                      const { amount, currency } = getEntryAmount(entry)
                      const isIncome = isIncomeEntry(entry)
                      return (
                        <tr key={entry.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                          <td className="px-2 py-1.5 text-gray-400 w-8">#{entry.voucherNo}</td>
                          <td className="px-2 py-1.5 text-gray-600">{entry.agency?.companyName || entry.agency?.name || entry.description || "—"}</td>
                          <td className={cn("px-2 py-1.5 font-semibold text-right", isIncome ? "text-blue-700" : "text-red-600")}>
                            {getCurrencySymbol(currency)}{amount.toLocaleString("tr-TR")}
                          </td>
                          <td className="px-2 py-1.5 text-gray-400 text-right">{currency}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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

      {/* Kasa Teslim Modalı */}
      <Dialog open={kasaTeslimOpen} onOpenChange={(v) => { if (!v) { setKasaTeslimOpen(false); setKasaTeslimAmounts({}) } }}>
        <DialogContent className="w-full !max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-amber-700 flex items-center gap-2">
              <HandCoins className="h-5 w-5" /> Kasa Teslim — Barış Bey
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const cashRows = summary ? CURRENCIES.map(cur => {
              const cashIn = summary.cashIncome[cur.value] || 0
              const outgoing = (summary.credit[cur.value] || 0) + (summary.expense[cur.value] || 0)
              const net = cashIn - outgoing
              if (net <= 0) return null
              return { cur, net }
            }).filter(Boolean) as { cur: typeof CURRENCIES[number]; net: number }[] : []

            if (cashRows.length === 0) {
              return <p className="text-sm text-gray-500 text-center py-4">Teslim edilecek nakit bakiye yok.</p>
            }

            const teslimItems = cashRows.map(({ cur, net }) => ({
              cur, net,
              input: kasaTeslimAmounts[cur.value] ?? String(net),
            }))

            const hasAnyAmount = teslimItems.some(x => parseFloat(x.input) > 0)

            return (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Her para birimi için teslim edilecek miktarı onaylayın veya düzenleyin.</p>
                <div className="space-y-3">
                  {teslimItems.map(({ cur, net, input }) => (
                    <div key={cur.value} className="flex items-center gap-3 bg-amber-50/50 rounded-lg px-4 py-3 border border-amber-100">
                      <Badge className={cn("text-white shrink-0", cur.bg)}>{cur.symbol} {cur.value}</Badge>
                      <div className="flex-1 text-xs text-gray-500">
                        Kasa bakiyesi: <span className="font-semibold text-gray-700">{cur.symbol} {net.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm text-gray-500">{cur.symbol}</span>
                        <Input
                          type="number"
                          className="h-8 w-28 text-right"
                          value={input}
                          onChange={(e) => setKasaTeslimAmounts(prev => ({ ...prev, [cur.value]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setKasaTeslimOpen(false); setKasaTeslimAmounts({}) }}>İptal</Button>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={!hasAnyAmount}
                    onClick={() => setKasaTeslimConfirm(true)}
                  >
                    Devam Et
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Kasa Teslim Onay Dialogu */}
      <AlertDialog open={kasaTeslimConfirm} onOpenChange={setKasaTeslimConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kasa Teslimini Onaylıyor Musunuz?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Aşağıdaki tutarlar Barış Bey&apos;e teslim edilecek ve muhasebeye işlenecektir:</p>
                <div className="space-y-2">
                  {CURRENCIES.map(cur => {
                    const raw = kasaTeslimAmounts[cur.value]
                    const amt = raw !== undefined ? parseFloat(raw) : (summary ? (() => {
                      const cashIn = summary.cashIncome[cur.value] || 0
                      const outgoing = (summary.credit[cur.value] || 0) + (summary.expense[cur.value] || 0)
                      return cashIn - outgoing
                    })() : 0)
                    if (!amt || amt <= 0) return null
                    return (
                      <div key={cur.value} className="flex items-center justify-between bg-amber-50 rounded px-3 py-2">
                        <Badge className={cn("text-white text-xs", cur.bg)}>{cur.symbol} {cur.value}</Badge>
                        <span className="font-bold text-amber-800">{cur.symbol} {amt.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                const items = CURRENCIES.map(cur => {
                  const raw = kasaTeslimAmounts[cur.value]
                  const amt = raw !== undefined ? parseFloat(raw) : (summary ? (() => {
                    const cashIn = summary.cashIncome[cur.value] || 0
                    const outgoing = (summary.credit[cur.value] || 0) + (summary.expense[cur.value] || 0)
                    return cashIn - outgoing
                  })() : 0)
                  if (!amt || amt <= 0) return null
                  return { currency: cur.value, amount: amt }
                }).filter(Boolean) as { currency: string; amount: number }[]
                kasaTeslimMutation.mutate(items)
              }}
            >
              {kasaTeslimMutation.isPending ? "İşleniyor..." : "Evet, Teslim Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Ödeme Onay Dialogu */}
      <AlertDialog open={!!paymentConfirmEntry} onOpenChange={(v) => { if (!v) setPaymentConfirmEntry(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ödeme Alındı mı?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {paymentConfirmEntry && (() => {
                  const { amount: paid, currency } = getEntryAmount(paymentConfirmEntry)
                  const pending = paymentConfirmEntry.pendingAmount || 0
                  const full = paid + pending
                  const sym = getCurrencySymbol(currency)
                  return (
                    <div className="space-y-3 mt-1">
                      <p>Kalan tutar tahsil edildiğinde kayıt <strong>{sym} {full.toLocaleString("tr-TR")}</strong> olarak güncellenecektir.</p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Alınan:</span>
                          <span className="font-semibold text-emerald-700">{sym} {paid.toLocaleString("tr-TR")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Kalan:</span>
                          <span className="font-semibold text-yellow-700">{sym} {pending.toLocaleString("tr-TR")}</span>
                        </div>
                        <div className="flex justify-between border-t border-yellow-300 pt-1 mt-1">
                          <span className="text-gray-700 font-medium">Toplam:</span>
                          <span className="font-bold text-gray-900">{sym} {full.toLocaleString("tr-TR")}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => paymentConfirmEntry && paymentMutation.mutate(paymentConfirmEntry)}
            >
              {paymentMutation.isPending ? "İşleniyor..." : "Evet, Ödeme Alındı"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rest Summary Modal */}
      <RestSummaryCard restEntries={kasaEntries.filter(e => e.incomeSubCategory === "GELIR_REST")} />

      {/* Print View — artık kullanılmıyor, iframe tabanlı yazdırma kullanılıyor */}
    </div>
  )
}

// ---- Kasa Print View ----
function buildPrintHTML({ dateLabel, printedAt, userName, entries, summary, exchangeRates }: {
  dateLabel: string; printedAt: string; userName: string
  entries: CashEntry[]; summary: Summary; exchangeRates?: ExchangeRates
}): string {
  const incomeEntries = entries.filter(e => !!(e.agencyIncomeAmount || e.receptionIncomeAmount || e.staffIncomeAmount || e.creditCardAmount))
  const expenseEntries = entries.filter(e => !!(e.expenseAmount) && !e.agencyIncomeAmount && !e.receptionIncomeAmount && !e.staffIncomeAmount && !e.creditCardAmount)

  // Kategori = hizmet türü (alt kategori). Ödeme yöntemi (nakit/KK) ayrı blokta gösterilir.
  const incomeByCat: Record<string, Record<string, number>> = {}
  for (const e of incomeEntries) {
    const cat = e.incomeSubCategory
      ? getIncomeSubCategoryLabel(e.incomeSubCategory)
      : e.agencyIncomeAmount
      ? "Acenta Geliri"
      : e.creditCardAmount
      ? "Kredi Kartı Geliri"
      : "Resepsiyon Geliri"
    const { amount, currency } = getEntryAmount(e)
    if (!incomeByCat[cat]) incomeByCat[cat] = {}
    incomeByCat[cat][currency] = (incomeByCat[cat][currency] || 0) + amount
  }

  const expenseByCat: Record<string, Record<string, number>> = {}
  for (const e of expenseEntries) {
    const cat = e.expenseCategory ? getExpenseCategoryLabel(e.expenseCategory) : "Diğer"
    const currency = e.expenseCurrency || "TRY"
    const amount = e.expenseAmount || 0
    if (!expenseByCat[cat]) expenseByCat[cat] = {}
    expenseByCat[cat][currency] = (expenseByCat[cat][currency] || 0) + amount
  }

  const fmtAmt = (amount: number, currency: string) => {
    const sym = getCurrencySymbol(currency)
    return `${sym} ${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const incomeRows = incomeEntries.map(e => {
    const kind = getEntryKind(e)
    const { amount, currency } = getEntryAmount(e)
    const typeLabel = kind === "agencyIncome" ? "Acenta"
      : kind === "creditCard" ? "KK"
      : kind === "staffIncome" ? (e.staff?.user.name || "Personel")
      : "Resepsiyon"
    const desc = [
      e.agency ? (e.agency.companyName || e.agency.name) : null,
      e.incomeSubCategory ? getIncomeSubCategoryLabel(e.incomeSubCategory) : null,
      e.description,
    ].filter(Boolean).join(" · ")
    return `<tr><td>#${e.voucherNo}</td><td>${typeLabel}</td><td>${desc || "—"}</td><td style="text-align:right;font-weight:600">${fmtAmt(amount, currency)}</td></tr>`
  }).join("")

  const expenseRows = expenseEntries.map(e => {
    return `<tr><td>#${e.voucherNo}</td><td>${e.expenseCategory ? getExpenseCategoryLabel(e.expenseCategory) : "Diğer"}</td><td>${e.description || "—"}</td><td style="text-align:right;font-weight:600;color:#b91c1c">- ${fmtAmt(e.expenseAmount!, e.expenseCurrency!)}</td></tr>`
  }).join("")

  const incomeCatRows = Object.entries(incomeByCat).map(([cat, byCur]) =>
    Object.entries(byCur).map(([cur, amt]) =>
      `<div class="cat-row"><span>${cat}</span><span style="font-weight:600">${fmtAmt(amt, cur)}</span></div>`
    ).join("")
  ).join("")

  const expenseCatRows = Object.entries(expenseByCat).map(([cat, byCur]) =>
    Object.entries(byCur).map(([cur, amt]) =>
      `<div class="cat-row"><span>${cat}</span><span style="font-weight:600;color:#b91c1c">- ${fmtAmt(amt, cur)}</span></div>`
    ).join("")
  ).join("") || `<div style="color:#9ca3af;font-size:10px">Gider yok</div>`

  const currencyBlocks = CURRENCIES.map(cur => {
    const cashIn = summary.cashIncome[cur.value] || 0
    const ccIn = summary.creditCardIncome[cur.value] || 0
    const credit = summary.credit[cur.value] || 0
    const exp = summary.expense[cur.value] || 0
    const net = cashIn - credit - exp
    if (cashIn === 0 && ccIn === 0 && credit === 0 && exp === 0) return ""
    return `
      <div class="summary-block">
        <div class="summary-cur">${cur.symbol} ${cur.value}</div>
        <div class="summary-row"><span>Nakit Gelir</span><span>${fmtAmt(cashIn, cur.value)}</span></div>
        ${ccIn > 0 ? `<div class="summary-row"><span>Kredi Kartı</span><span>${fmtAmt(ccIn, cur.value)}</span></div>` : ""}
        ${credit > 0 ? `<div class="summary-row"><span>Slip (tahsil edilmedi)</span><span style="color:#0369a1">- ${fmtAmt(credit, cur.value)}</span></div>` : ""}
        ${exp > 0 ? `<div class="summary-row"><span>Gider</span><span style="color:#b91c1c">- ${fmtAmt(exp, cur.value)}</span></div>` : ""}
        <div class="summary-row net"><span>Net Nakit</span><span style="color:${net >= 0 ? "#000" : "#b91c1c"}">${fmtAmt(net, cur.value)}</span></div>
      </div>`
  }).join("")

  // Grand total block: KK toplam + EUR karşılıkları + Toplam (nakit+KK)
  const grandTotalBlock = (() => {
    // KK toplamları (per currency)
    const ccTotals = CURRENCIES.map(cur => {
      const ccIn = summary.creditCardIncome[cur.value] || 0
      if (ccIn === 0) return ""
      return `<div class="summary-row"><span>KK ${cur.value}</span><span>${fmtAmt(ccIn, cur.value)}</span></div>`
    }).join("")

    if (!exchangeRates) {
      if (!ccTotals) return ""
      return `
        <div class="summary-block" style="border-color:#7c3aed;margin-top:8px">
          <div class="summary-cur" style="color:#7c3aed">KREDİ KARTI TOPLAM</div>
          ${ccTotals}
        </div>`
    }

    // KK toplam EUR
    let ccEur = 0
    for (const cur of CURRENCIES) {
      const ccIn = summary.creditCardIncome[cur.value] || 0
      if (ccIn === 0) continue
      if (cur.value === "EUR") { ccEur += ccIn }
      else {
        const c = convertCurrency(ccIn, cur.value, "EUR", exchangeRates)
        if (c !== null) ccEur += c
      }
    }

    // Brüt nakit gelir toplam EUR (gider/slip çıkarılmamış)
    let grossCashEur = 0
    for (const cur of CURRENCIES) {
      const cashIn = summary.cashIncome[cur.value] || 0
      if (cashIn === 0) continue
      if (cur.value === "EUR") { grossCashEur += cashIn }
      else {
        const c = convertCurrency(cashIn, cur.value, "EUR", exchangeRates)
        if (c !== null) grossCashEur += c
      }
    }

    // Net nakit toplam EUR (gider + slip çıkarılmış)
    let netCashEur = 0
    for (const cur of CURRENCIES) {
      const net = (summary.cashIncome[cur.value] || 0) - (summary.credit[cur.value] || 0) - (summary.expense[cur.value] || 0)
      if (cur.value === "EUR") { netCashEur += net }
      else {
        const c = convertCurrency(Math.abs(net), cur.value, "EUR", exchangeRates)
        if (c !== null) netCashEur += net >= 0 ? c : -c
      }
    }

    // Gider toplam EUR
    let expenseEur = 0
    for (const cur of CURRENCIES) {
      const exp = summary.expense[cur.value] || 0
      if (exp === 0) continue
      if (cur.value === "EUR") { expenseEur += exp }
      else {
        const c = convertCurrency(exp, cur.value, "EUR", exchangeRates)
        if (c !== null) expenseEur += c
      }
    }

    // TRY tarafı: brüt ve net ayrı
    const grossCashTRY = summary.cashIncome["TRY"] || 0
    const netCashTRY = grossCashTRY - (summary.credit["TRY"] || 0) - (summary.expense["TRY"] || 0)
    const ccTRY = summary.creditCardIncome["TRY"] || 0
    const grossTRY = grossCashTRY + ccTRY
    const netTRY = netCashTRY + ccTRY

    const grossEur = grossCashEur + ccEur
    const netEur = netCashEur + ccEur
    const hasCc = CURRENCIES.some(cur => (summary.creditCardIncome[cur.value] || 0) > 0)
    if (!hasCc) return ""

    return `
      <div class="summary-block" style="border-color:#7c3aed;margin-top:8px">
        <div class="summary-cur" style="color:#7c3aed">KREDİ KARTI TOPLAM</div>
        ${ccTotals}
        <div class="summary-row" style="border-top:1px solid #ccc;margin-top:4px;padding-top:4px;font-weight:bold">
          <span>KK Toplam (€ karşılığı)</span>
          <span style="color:#7c3aed">€ ${ccEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      <div class="summary-block" style="border-color:#1d4ed8;margin-top:6px">
        <div class="summary-cur" style="color:#1d4ed8">GENEL TOPLAM</div>
        <div class="summary-row"><span>Brüt Gelir TL (Nakit + KK)</span><span style="font-weight:600">₺ ${grossTRY.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        <div class="summary-row"><span>Brüt Gelir € Karşılığı (Nakit + KK)</span><span style="font-weight:600">€ ${grossEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        ${expenseEur > 0 ? `<div class="summary-row" style="color:#b91c1c"><span>(-) Gider € Karşılığı</span><span>- € ${expenseEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ""}
        <div class="summary-row" style="font-weight:600;border-top:1px solid #ccc;margin-top:4px;padding-top:4px">
          <span>Net Kasa TL (Net Nakit + KK)</span>
          <span>₺ ${netTRY.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="summary-row" style="font-weight:bold">
          <span>Net Kasa € Karşılığı</span>
          <span style="color:#1d4ed8">€ ${netEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>`
  })()

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>Günlük Kasa Raporu — ${dateLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 16px; }
  h1 { font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 1px; }
  h2 { font-size: 13px; text-align: center; font-weight: 600; margin: 4px 0; }
  .sub { font-size: 10px; color: #555; text-align: center; margin-bottom: 12px; }
  hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
  hr.thin { border-top: 1px solid #ccc; }
  .section-title { font-size: 12px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; padding: 2px 4px; border-bottom: 1px solid #aaa; font-size: 10px; }
  td { padding: 2px 4px; border-bottom: 1px solid #eee; vertical-align: top; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
  .cat-title { font-size: 10px; font-weight: bold; border-bottom: 1px solid #aaa; padding-bottom: 2px; margin-bottom: 4px; }
  .cat-row { display: flex; justify-content: space-between; font-size: 10px; padding: 1px 0; }
  .summary-block { border: 1px solid #ccc; border-radius: 4px; padding: 6px; margin-bottom: 6px; }
  .summary-cur { font-weight: bold; font-size: 11px; margin-bottom: 4px; }
  .summary-row { display: flex; justify-content: space-between; font-size: 10px; padding: 1px 0; }
  .summary-row.net { border-top: 1px solid #ccc; margin-top: 4px; padding-top: 4px; font-weight: bold; }
  .footer { margin-top: 16px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #ccc; padding-top: 6px; }
  @page { margin: 10mm; size: A4; }
</style>
</head>
<body>
  <h1>GÜNLÜK KASA RAPORU</h1>
  <h2>${dateLabel}</h2>
  <div class="sub">Yazdıran: ${userName} &nbsp;|&nbsp; ${printedAt}</div>
  <hr/>

  <div class="section-title">GELİRLER</div>
  <table>
    <thead><tr><th style="width:32px">Fiş#</th><th style="width:80px">Tür</th><th>Açıklama / Kategori</th><th style="width:110px;text-align:right">Tutar</th></tr></thead>
    <tbody>${incomeRows}</tbody>
  </table>

  ${expenseEntries.length > 0 ? `
  <div class="section-title">GİDERLER</div>
  <table>
    <thead><tr><th style="width:32px">Fiş#</th><th style="width:130px">Kategori</th><th>Açıklama</th><th style="width:110px;text-align:right">Tutar</th></tr></thead>
    <tbody>${expenseRows}</tbody>
  </table>` : ""}

  <div class="grid2">
    <div>
      <div class="cat-title">GELİR KATEGORİLERİ</div>
      ${incomeCatRows}
    </div>
    <div>
      <div class="cat-title">GİDER KATEGORİLERİ</div>
      ${expenseCatRows}
    </div>
  </div>

  <hr/>
  <div class="section-title">GENEL ÖZET</div>
  ${currencyBlocks}
  ${grandTotalBlock}

  <div class="footer">Orient SPA &amp; Orient Turizm &nbsp;|&nbsp; ${dateLabel} &nbsp;|&nbsp; Yazdırma: ${printedAt}</div>
</body>
</html>`
}

function printKasaReport(data: { dateLabel: string; printedAt: string; userName: string; entries: CashEntry[]; summary: Summary; exchangeRates?: ExchangeRates }) {
  const html = buildPrintHTML(data)
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow!.document
  doc.open()
  doc.write(html)
  doc.close()
  iframe.contentWindow!.focus()
  setTimeout(() => {
    iframe.contentWindow!.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 300)
}

function buildPrimPrintHTML({ staffName, rate, entries, byCurrency, dateLabel, printedAt }: {
  staffName: string; rate: number; dateLabel: string; printedAt: string
  entries: CashEntry[]
  byCurrency: [string, { cash: number; cc: number }][]
}): string {
  const fmtAmt = (amount: number, currency: string) => {
    const sym = getCurrencySymbol(currency)
    return `${sym} ${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const rows = entries.map(e => {
    const isCash = !!e.staffIncomeAmount
    const amount = isCash ? e.staffIncomeAmount! : e.creditCardAmount!
    const cur = isCash ? e.staffIncomeCurrency! : e.creditCardCurrency!
    const prim = amount * rate / 100
    const cat = e.incomeSubCategory ? getIncomeSubCategoryLabel(e.incomeSubCategory) : "—"
    return `<tr>
      <td>#${e.voucherNo}</td>
      <td>${isCash ? "Nakit" : "KK"}</td>
      <td>${cat}</td>
      <td>${e.description || "—"}</td>
      <td style="text-align:right">${fmtAmt(amount, cur)} × %${rate}</td>
      <td style="text-align:right;font-weight:600;color:#b45309">${fmtAmt(prim, cur)}</td>
    </tr>`
  }).join("")

  const totalRows = byCurrency.map(([cur, { cash, cc }]) => {
    const c = CURRENCIES.find(x => x.value === cur)
    const total = cash + cc
    const prim = total * rate / 100
    return `<div style="display:flex;justify-content:space-between;background:#fef3c7;border-radius:4px;padding:6px 10px;margin-bottom:4px;font-weight:bold">
      <span>Toplam Prim (${cur})</span>
      <span style="color:#92400e">${c?.symbol}${prim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>`
  }).join("")

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>Prim Detayı — ${staffName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 16px; }
  h1 { font-size: 16px; font-weight: bold; text-align: center; }
  h2 { font-size: 12px; text-align: center; color: #555; margin: 4px 0 12px; }
  hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
  .section-title { font-size: 12px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; padding: 2px 4px; border-bottom: 1px solid #aaa; }
  td { padding: 2px 4px; border-bottom: 1px solid #eee; vertical-align: top; }
  .footer { margin-top: 16px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #ccc; padding-top: 6px; }
  @page { margin: 10mm; size: A4; }
</style>
</head>
<body>
  <h1>PRİM DETAY RAPORU</h1>
  <h2>${staffName} — %${rate} Prim — ${dateLabel}</h2>
  <div style="font-size:10px;color:#555;text-align:center;margin-bottom:8px">Yazdıran: ${printedAt}</div>
  <hr/>
  <table>
    <thead><tr><th style="width:32px">Fiş#</th><th style="width:40px">Tür</th><th style="width:100px">Kategori</th><th>Açıklama</th><th style="width:120px;text-align:right">Satış × Prim%</th><th style="width:80px;text-align:right">Prim</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:12px">${totalRows}</div>
  <div class="footer">Orient SPA &amp; Orient Turizm &nbsp;|&nbsp; ${dateLabel} &nbsp;|&nbsp; Yazdırma: ${printedAt}</div>
</body>
</html>`
}

function printPrimReport(data: { staffName: string; rate: number; entries: CashEntry[]; byCurrency: [string, { cash: number; cc: number }][]; dateLabel: string; printedAt: string }) {
  const html = buildPrimPrintHTML(data)
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow!.document
  doc.open(); doc.write(html); doc.close()
  iframe.contentWindow!.focus()
  setTimeout(() => {
    iframe.contentWindow!.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 300)
}

// ---- Rest Summary Card (özet kartlar grid'inde kullanılır) ----
function RestSummaryCard({ restEntries }: { restEntries: CashEntry[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-rest-modal", handler)
    return () => window.removeEventListener("open-rest-modal", handler)
  }, [])

  const byCurrency: Record<string, number> = {}
  const kkByCurrency: Record<string, number> = {}
  for (const e of restEntries) {
    const isKK = e.creditCardAmount !== null && e.creditCardAmount !== undefined && e.creditCardAmount > 0
    if (isKK) {
      const cur = e.creditCardCurrency || "TRY"
      kkByCurrency[cur] = (kkByCurrency[cur] || 0) + e.creditCardAmount!
    } else {
      const { amount, currency } = getEntryAmount(e)
      if (amount > 0) byCurrency[currency] = (byCurrency[currency] || 0) + amount
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full !max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="text-rose-700">Günlük Rest Listesi</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {restEntries.map(e => {
            const isKK = e.creditCardAmount !== null && e.creditCardAmount !== undefined && e.creditCardAmount > 0
            const amount = isKK ? e.creditCardAmount! : getEntryAmount(e).amount
            const currency = isKK ? (e.creditCardCurrency || "TRY") : getEntryAmount(e).currency
            const c = CURRENCIES.find(x => x.value === currency)
            return (
              <div key={e.id} className={cn("border rounded-lg p-3", isKK ? "border-violet-100 bg-violet-50/30" : "border-rose-100 bg-rose-50/30")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">#{e.voucherNo}</Badge>
                      {isKK && <Badge className="text-[9px] bg-violet-500 text-white">KK</Badge>}
                      {e.agency && <span className="text-sm font-semibold text-gray-800">{e.agency.companyName || e.agency.name}</span>}
                      {e.staff && <span className="text-xs text-gray-600">{e.staff.user.name}</span>}
                      <span className="text-xs text-gray-400">{format(new Date(e.createdAt), "HH:mm")}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      {e.hotel && <span>{e.hotel.name}{e.roomNumber ? ` · ${e.roomNumber}` : ""}</span>}
                      {e.serviceName && <span>· {e.serviceName}</span>}
                      {e.pax && <span>· {e.pax} PAX</span>}
                      {isKK && e.slipNo && <span>· Slip: {e.slipNo}</span>}
                    </div>
                    {e.description && <p className="text-xs text-gray-400 mt-1">{e.description}</p>}
                  </div>
                  <div className={cn("text-lg font-bold shrink-0", isKK ? "text-violet-700" : "text-rose-700")}>
                    {c?.symbol ?? currency} {amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t pt-3 space-y-1">
          {Object.entries(byCurrency).map(([cur, amt]) => {
            const c = CURRENCIES.find(x => x.value === cur)
            return (
              <div key={cur} className="flex items-center justify-between bg-rose-100 rounded-lg px-4 py-2">
                <span className="text-sm text-rose-800 font-medium">Toplam Rest ({cur})</span>
                <span className="text-base font-bold text-rose-900">{c?.symbol} {amt.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )
          })}
          {Object.entries(kkByCurrency).map(([cur, amt]) => {
            const c = CURRENCIES.find(x => x.value === cur)
            return (
              <div key={`kk-${cur}`} className="flex items-center justify-between bg-violet-100 rounded-lg px-4 py-2">
                <span className="text-sm text-violet-800 font-medium">KK Rest ({cur})</span>
                <span className="text-base font-bold text-violet-900">{c?.symbol} {amt.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}


// ---- Prim Euro Cell ----
function PrimEuroCell({ row, exchangeRates }: {
  row: { rate: number; byCurrency: [string, { cash: number; cc: number }][] }
  exchangeRates: ExchangeRates | undefined
}) {
  if (!exchangeRates) return <span className="text-xs text-gray-400">—</span>
  let totalEur = 0
  for (const [cur, { cash, cc }] of row.byCurrency) {
    const prim = (cash + cc) * row.rate / 100
    if (cur === "EUR") { totalEur += prim }
    else {
      const converted = convertCurrency(prim, cur, "EUR", exchangeRates)
      if (converted !== null) totalEur += converted
    }
  }
  return (
    <span className="font-bold text-blue-700 text-sm">
      € {totalEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )
}

// ---- Prim Table ----
function PrimTable({ primData, exchangeRates }: {
  primData: { staff: StaffMember; rate: number; byCurrency: [string, { cash: number; cc: number }][]; entries: CashEntry[] }[]
  exchangeRates: ExchangeRates | undefined
}) {
  const [detailStaff, setDetailStaff] = useState<typeof primData[number] | null>(null)

  return (
    <>
      <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <h3 className="font-semibold text-amber-800 text-sm">İnfocu Prim Özeti</h3>
          <span className="text-[10px] text-amber-600">(detay için infocuya tıklayın)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">İnfocu</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Pozisyon</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Prim %</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Toplam Gelir</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-amber-700">Prim Tutarı</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-blue-600">Toplam € Karşılığı</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {primData.map((row) => (
                <tr
                  key={row.staff.id}
                  className="hover:bg-amber-50/60 cursor-pointer transition-colors"
                  onClick={() => setDetailStaff(row)}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800">{row.staff.user.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{row.staff.position || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">%{row.rate}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {row.byCurrency.map(([cur, { cash, cc }]) => {
                      const c = CURRENCIES.find(x => x.value === cur)
                      return <div key={cur}>{c?.symbol}{(cash + cc).toLocaleString("tr-TR")}</div>
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-amber-700">
                    {row.byCurrency.map(([cur, { cash, cc }]) => {
                      const c = CURRENCIES.find(x => x.value === cur)
                      const prim = (cash + cc) * row.rate / 100
                      return <div key={cur}>{c?.symbol}{prim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <PrimEuroCell row={row} exchangeRates={exchangeRates} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detay Modal */}
      <Dialog open={!!detailStaff} onOpenChange={(v) => { if (!v) setDetailStaff(null) }}>
        <DialogContent className="w-full !max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-amber-700">
                {detailStaff?.staff.user.name} — Prim Detayı
              </DialogTitle>
              {detailStaff && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => printPrimReport({
                    staffName: detailStaff.staff.user.name,
                    rate: detailStaff.rate,
                    entries: detailStaff.entries,
                    byCurrency: detailStaff.byCurrency,
                    dateLabel: format(new Date(), "d MMMM yyyy", { locale: tr }),
                    printedAt: format(new Date(), "dd.MM.yyyy HH:mm", { locale: tr }),
                  })}
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Yazdır
                </Button>
              )}
            </div>
          </DialogHeader>
          {detailStaff && (
            <div className="space-y-3">
              <div className="space-y-2">
                {detailStaff.entries.map(e => {
                  const isCash = !!e.staffIncomeAmount
                  const amount = isCash ? e.staffIncomeAmount! : e.creditCardAmount!
                  const cur = isCash ? e.staffIncomeCurrency! : e.creditCardCurrency!
                  const c = CURRENCIES.find(x => x.value === cur)
                  const prim = amount * detailStaff.rate / 100
                  return (
                    <div key={e.id} className="flex items-center justify-between bg-amber-50/50 rounded-lg px-3 py-2.5 border border-amber-100 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge variant="outline" className="text-[10px] shrink-0">#{e.voucherNo}</Badge>
                        <Badge className={cn("text-[10px] shrink-0", isCash ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700")}>
                          {isCash ? "Nakit" : "KK"}
                        </Badge>
                        <div className="min-w-0">
                          {e.incomeSubCategory && (
                            <span className="text-[10px] text-gray-500">{getIncomeSubCategoryLabel(e.incomeSubCategory)}</span>
                          )}
                          {e.description && <span className="text-[10px] text-gray-400 ml-1 truncate block">{e.description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <span className="text-xs text-gray-500 whitespace-nowrap">{c?.symbol}{amount.toLocaleString("tr-TR")} × %{detailStaff.rate}</span>
                        <span className="text-sm font-bold text-amber-700 whitespace-nowrap">{c?.symbol}{prim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t pt-3 space-y-1">
                {detailStaff.byCurrency.map(([cur, { cash, cc }]) => {
                  const c = CURRENCIES.find(x => x.value === cur)
                  const total = cash + cc
                  const prim = total * detailStaff.rate / 100
                  return (
                    <div key={cur} className="flex items-center justify-between bg-amber-100 rounded-lg px-4 py-2">
                      <span className="text-sm text-amber-800 font-medium">Toplam Prim ({cur})</span>
                      <span className="text-base font-bold text-amber-900">{c?.symbol}{prim.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---- Income Form ----
interface BasketItem {
  id: string
  incomeType: "reception" | "agency" | "staff"
  paymentMethod: "cash" | "creditCard"
  agencyId: string
  staffId: string
  hotelId: string
  hotelName: string
  amount: string
  currency: string
  description: string
  voucherDesc: string
  subCategory: string
  agencyIncomeKind: "general" | "rest"
  slipNo: string
  hasPending: boolean
  pendingAmount: string
}

function buildPayload(item: BasketItem, dateStr: string, voucherNo?: number): Record<string, unknown> {
  const isPending = item.hasPending && item.paymentMethod === "cash" && parseFloat(item.pendingAmount) > 0
  const parsedAmount = parseFloat(item.amount) || 0
  // Tüm gelir/gider/ilişki alanlarını null olarak başlat.
  // Böylece edit senaryosunda tipi değiştirirken eski tipin alanları da temizlenir
  // (örn. Reception → Staff'a çevrilirse receptionIncomeAmount null'a düşer, sadece staffIncomeAmount dolu kalır).
  const payload: Record<string, unknown> = {
    date: dateStr,
    description: item.description || null,
    voucherDesc: item.voucherDesc || null,
    agencyId: null,
    hotelId: null,
    staffId: null,
    agencyIncomeAmount: null,
    agencyIncomeCurrency: null,
    receptionIncomeAmount: null,
    receptionIncomeCurrency: null,
    staffIncomeAmount: null,
    staffIncomeCurrency: null,
    creditCardAmount: null,
    creditCardCurrency: null,
    slipNo: null,
    incomeSubCategory: null,
    expenseAmount: null,
    expenseCurrency: null,
    expenseCategory: null,
    isPaid: !isPending,
    pendingAmount: isPending ? parseFloat(item.pendingAmount) : null,
    pendingCurrency: isPending ? item.currency : null,
    ...(voucherNo ? { voucherNo } : {}),
  }

  // Ortak alanlar: acenta + otel her tip için bilgi olarak saklanır
  if (item.agencyId && item.agencyId !== "none") payload.agencyId = item.agencyId
  if (item.hotelId) payload.hotelId = item.hotelId

  if (item.paymentMethod === "creditCard") {
    payload.creditCardAmount = parsedAmount
    payload.creditCardCurrency = "TRY"
    if (item.slipNo) payload.slipNo = item.slipNo
    if (item.incomeType === "staff" && item.staffId) payload.staffId = item.staffId
    if ((item.incomeType === "reception" || item.incomeType === "staff") && item.subCategory && item.subCategory !== "none") {
      payload.incomeSubCategory = item.subCategory
    }
    if (item.incomeType === "agency" && item.agencyIncomeKind === "rest") payload.incomeSubCategory = "GELIR_REST"
  } else if (item.incomeType === "agency") {
    payload.agencyIncomeAmount = parsedAmount
    payload.agencyIncomeCurrency = item.currency
    if (item.agencyIncomeKind === "rest") payload.incomeSubCategory = "GELIR_REST"
  } else if (item.incomeType === "staff") {
    payload.staffId = item.staffId
    payload.staffIncomeAmount = parsedAmount
    payload.staffIncomeCurrency = item.currency
    if (item.subCategory) payload.incomeSubCategory = item.subCategory
  } else {
    payload.receptionIncomeAmount = parsedAmount
    payload.receptionIncomeCurrency = item.currency
    if (item.subCategory && item.subCategory !== "none") payload.incomeSubCategory = item.subCategory
  }
  return payload
}

function incomeTypeLabel(item: BasketItem, agencies: Agency[], staffList: StaffMember[]): string {
  if (item.incomeType === "agency") {
    const agency = agencies.find(a => a.id === item.agencyId)
    return agency ? (agency.companyName || agency.name) : "Acenta"
  }
  if (item.incomeType === "staff") {
    const staff = staffList.find(s => s.id === item.staffId)
    return staff ? staff.user.name : "Personel"
  }
  return "Resepsiyon"
}

function IncomeFormDialog({ open, onOpenChange, editingEntry, agencies, staffList, dateStr, onSuccess }: {
  open: boolean; onOpenChange: (open: boolean) => void; editingEntry: CashEntry | null
  agencies: Agency[]; staffList: StaffMember[]; dateStr: string; onSuccess: () => void
}) {
  const isEditing = !!editingEntry

  // Hotels query
  const { data: hotels } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["hotels"],
    queryFn: async () => {
      const res = await fetch("/api/hotels")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  // Sepet
  const [basket, setBasket] = useState<BasketItem[]>([])

  // Aktif satır formu
  const [incomeType, setIncomeType] = useState<"reception" | "agency" | "staff">("reception")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "creditCard">("cash")
  const [agencyId, setAgencyId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [hotelId, setHotelId] = useState("")
  const [hotelName, setHotelName] = useState("")
  const [hotelSearch, setHotelSearch] = useState("")
  const [showHotelDropdown, setShowHotelDropdown] = useState(false)
  const [voucherDesc, setVoucherDesc] = useState("")
  const [agencyIncomeKind, setAgencyIncomeKind] = useState<"general" | "rest">("general")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [description, setDescription] = useState("")
  const [subCategory, setSubCategory] = useState("")
  const [slipNo, setSlipNo] = useState("")
  const [hasPending, setHasPending] = useState(false)
  const [pendingAmount, setPendingAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const filteredHotels = hotels
    ? hotels.filter(h => h.name.toLowerCase().includes(hotelSearch.toLowerCase())).slice(0, 10)
    : []

  const resetRow = () => {
    setIncomeType("reception"); setPaymentMethod("cash")
    setAgencyId(""); setStaffId("")
    setHotelId(""); setHotelName(""); setHotelSearch(""); setShowHotelDropdown(false)
    setVoucherDesc(""); setAgencyIncomeKind("general")
    setAmount(""); setCurrency("EUR"); setDescription(""); setSubCategory(""); setSlipNo("")
    setHasPending(false); setPendingAmount("")
  }

  useEffect(() => {
    if (open) {
      setBasket([])
      if (editingEntry) {
        // Common fields
        setHotelId(editingEntry.hotelId || "")
        setHotelName(editingEntry.hotel?.name || "")
        setHotelSearch(editingEntry.hotel?.name || "")
        setVoucherDesc(editingEntry.voucherDesc || "")
        setDescription(editingEntry.description || "")
        setAgencyId(editingEntry.agencyId || "")
        if (editingEntry.agencyIncomeAmount !== null && editingEntry.agencyIncomeAmount !== undefined) {
          setIncomeType("agency"); setPaymentMethod("cash")
          setStaffId("")
          setAmount(editingEntry.agencyIncomeAmount.toString())
          setCurrency(editingEntry.agencyIncomeCurrency || "EUR")
          setSubCategory("")
          setAgencyIncomeKind(editingEntry.incomeSubCategory === "GELIR_REST" ? "rest" : "general")
        } else if (editingEntry.staffIncomeAmount !== null && editingEntry.staffIncomeAmount !== undefined) {
          setIncomeType("staff"); setPaymentMethod("cash")
          setStaffId(editingEntry.staffId || ""); setAgencyId("")
          setAmount(editingEntry.staffIncomeAmount.toString())
          setCurrency(editingEntry.staffIncomeCurrency || "EUR")
          setSubCategory(editingEntry.incomeSubCategory || "")
          setAgencyIncomeKind("general")
        } else if (editingEntry.creditCardAmount !== null && editingEntry.creditCardAmount !== undefined) {
          const isRestKK = editingEntry.incomeSubCategory === "GELIR_REST"
          setIncomeType(isRestKK ? "agency" : "reception"); setPaymentMethod("creditCard")
          setStaffId("")
          setAmount(editingEntry.creditCardAmount.toString())
          setCurrency("TRY")
          setSubCategory(isRestKK ? "" : (editingEntry.incomeSubCategory || ""))
          setSlipNo(editingEntry.slipNo || "")
          setAgencyIncomeKind(isRestKK ? "rest" : "general")
        } else {
          setIncomeType("reception"); setPaymentMethod("cash")
          setStaffId("")
          setAmount(editingEntry.receptionIncomeAmount?.toString() || "")
          setCurrency(editingEntry.receptionIncomeCurrency || "EUR")
          setSubCategory(editingEntry.incomeSubCategory || "")
          setAgencyIncomeKind("general")
        }
      } else {
        resetRow()
      }
    }
  }, [open, editingEntry])

  useEffect(() => {
    if (incomeType === "agency" && agencyIncomeKind !== "rest") setPaymentMethod("cash")
  }, [incomeType, agencyIncomeKind])

  useEffect(() => {
    if (paymentMethod === "creditCard") setCurrency("TRY")
  }, [paymentMethod])

  const validateRow = (): boolean => {
    const isPartialWithZero = hasPending && paymentMethod === "cash" && (!amount || parseFloat(amount) === 0)
    if (!isPartialWithZero && (!amount || parseFloat(amount) <= 0)) { toast.error("Miktar giriniz"); return false }
    if (incomeType === "staff" && !staffId) { toast.error("Personel seçiniz"); return false }
    if (incomeType === "staff" && !subCategory) { toast.error("Alt kategori seçiniz"); return false }
    if (incomeType === "agency" && (!agencyId || agencyId === "none")) {
      toast.error(agencyIncomeKind === "rest" ? "REST geliri için acenta seçiniz" : "Acenta geliri için acenta seçiniz")
      return false
    }
    if (paymentMethod === "creditCard" && !slipNo.trim()) { toast.error("Slip No giriniz"); return false }
    if (hasPending && paymentMethod === "cash") {
      if (!pendingAmount || parseFloat(pendingAmount) <= 0) { toast.error("Kalan tutar giriniz"); return false }
    }
    return true
  }

  const handleAddToBasket = () => {
    if (!validateRow()) return
    const item: BasketItem = {
      id: crypto.randomUUID(),
      incomeType, paymentMethod, agencyId, staffId, hotelId, hotelName,
      amount, currency, description, voucherDesc, subCategory, slipNo,
      agencyIncomeKind, hasPending, pendingAmount,
    }
    setBasket(prev => [...prev, item])
    // Satırı sıfırla ama tipi / acenta / otel / voucher koru
    setAmount(""); setDescription(""); setSlipNo("")
    setHasPending(false); setPendingAmount("")
  }

  const handleSubmit = async () => {
    if (submitting) return
    // Edit modunda sepet yok, direkt kaydet
    if (isEditing) {
      if (!validateRow()) return
      setSubmitting(true)
      try {
        const payload = buildPayload({ id: "", incomeType, paymentMethod, agencyId, staffId, hotelId, hotelName, amount, currency, description, voucherDesc, subCategory, slipNo, agencyIncomeKind, hasPending, pendingAmount }, dateStr)
        const res = await fetch(`/api/kasa/${editingEntry!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "İşlem başarısız") }
        toast.success("Güncellendi")
        onSuccess()
      } catch (error: any) {
        toast.error(error.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Normal mod: sepetteki + mevcut satır
    // Sıfır tutarlı kısmi ödeme de geçerli (hasPending=true + pendingAmount>0)
    const currentFilled =
      (amount && parseFloat(amount) > 0) ||
      (hasPending && (!amount || parseFloat(amount) === 0) && pendingAmount && parseFloat(pendingAmount) > 0)
    const allItems: BasketItem[] = [
      ...basket,
      ...(currentFilled ? [{ id: "current", incomeType, paymentMethod, agencyId, staffId, hotelId, hotelName, amount, currency, description, voucherDesc, subCategory, slipNo, agencyIncomeKind, hasPending, pendingAmount }] : [])
    ]
    if (allItems.length === 0) { toast.error("En az bir kalem giriniz"); return }
    if (currentFilled && !validateRow()) return

    setSubmitting(true)
    try {
      // İlk POST'tan voucherNo al, geri kalanlar o numarayla
      let sharedVoucherNo: number | undefined

      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i]
        const payload = buildPayload(item, dateStr, sharedVoucherNo)
        const res = await fetch("/api/kasa", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "İşlem başarısız") }
        if (i === 0) {
          const created = await res.json()
          sharedVoucherNo = created.voucherNo
        }
      }

      toast.success(`${allItems.length} kalem kaydedildi`)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const methodBadgeClass = (item: BasketItem) =>
    item.paymentMethod === "creditCard" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full !max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-emerald-700">{isEditing ? "Gelir Düzenle" : "Gelir Ekle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* Sepet listesi — sadece yeni modda */}
          {!isEditing && basket.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700">Sepet ({basket.length} kalem)</span>
              </div>
              <div className="divide-y">
                {basket.map((item, idx) => {
                  const c = CURRENCIES.find(x => x.value === item.currency)
                  return (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 shrink-0">#{idx + 1}</span>
                        <Badge className={cn("text-[10px] shrink-0", methodBadgeClass(item))}>
                          {item.paymentMethod === "creditCard" ? "KK" : "Nakit"}
                        </Badge>
                        <span className="text-xs text-gray-600 truncate">{incomeTypeLabel(item, agencies, staffList)}</span>
                        {item.description && <span className="text-xs text-gray-400 truncate">{item.description}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-semibold text-emerald-700 text-sm">
                          {item.paymentMethod === "creditCard" ? "₺" : c?.symbol} {parseFloat(item.amount).toLocaleString("tr-TR")}
                        </span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600"
                          onClick={() => setBasket(prev => prev.filter(b => b.id !== item.id))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Gelir Tipi */}
          <div className="flex gap-2">
            {([
              { key: "reception", label: "Resepsiyon", color: "bg-emerald-600 hover:bg-emerald-700" },
              { key: "agency",    label: "Acenta",      color: "bg-blue-600 hover:bg-blue-700" },
              { key: "staff",     label: "İnfocu",      color: "bg-amber-600 hover:bg-amber-700" },
            ] as const).map(({ key, label, color }) => (
              <Button key={key} type="button" variant={incomeType === key ? "default" : "outline"}
                className={cn("flex-1", incomeType === key && color)}
                onClick={() => setIncomeType(key)}>
                {label}
              </Button>
            ))}
          </div>

          {/* Ödeme Yöntemi — Acenta REST'te de göster */}
          {(incomeType !== "agency" || agencyIncomeKind === "rest") && (
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

          {/* Acenta seçimi — tüm tipler için opsiyonel */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">
              Acenta{incomeType === "agency" ? "" : " (opsiyonel)"}
            </Label>
            <Select value={agencyId || "none"} onValueChange={v => setAgencyId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Acenta seçin (opsiyonel)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seçiniz</SelectItem>
                {agencies.map(a => <SelectItem key={a.id} value={a.id}>{a.companyName || a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Acenta gelir türü: Genel / REST — sadece agency tipinde */}
          {incomeType === "agency" && (
            <div className="flex gap-2">
              <Button type="button" variant={agencyIncomeKind === "general" ? "default" : "outline"}
                className={cn("flex-1 text-sm", agencyIncomeKind === "general" && "bg-blue-600 hover:bg-blue-700")}
                onClick={() => setAgencyIncomeKind("general")}>
                Genel Gelir
              </Button>
              <Button type="button" variant={agencyIncomeKind === "rest" ? "default" : "outline"}
                className={cn("flex-1 text-sm", agencyIncomeKind === "rest" && "bg-rose-600 hover:bg-rose-700")}
                onClick={() => setAgencyIncomeKind("rest")}>
                REST Geliri
              </Button>
            </div>
          )}

          {/* Personel seçimi */}
          {incomeType === "staff" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Personel *</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {staffList.filter(s => s.isActive && s.commissionRate).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.name}{s.position ? ` (${s.position})` : ""}
                      {s.commissionRate ? ` — %${s.commissionRate} prim` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Otel autocomplete — tüm tipler için */}
          <div className="space-y-2 relative">
            <Label className="text-xs font-medium text-gray-600">Otel (opsiyonel)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Otel ara..."
                value={hotelSearch}
                onChange={e => { setHotelSearch(e.target.value); setShowHotelDropdown(true); if (!e.target.value) { setHotelId(""); setHotelName("") } }}
                onFocus={() => setShowHotelDropdown(true)}
                onBlur={() => setTimeout(() => setShowHotelDropdown(false), 150)}
                className="flex-1 h-10"
              />
              {hotelId && (
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-red-500"
                  onClick={() => { setHotelId(""); setHotelName(""); setHotelSearch("") }}>
                  ×
                </Button>
              )}
            </div>
            {showHotelDropdown && filteredHotels.length > 0 && (
              <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto top-[calc(100%-4px)]">
                {filteredHotels.map(h => (
                  <button key={h.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700"
                    onMouseDown={() => { setHotelId(h.id); setHotelName(h.name); setHotelSearch(h.name); setShowHotelDropdown(false) }}>
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voucher / Fiş No */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Voucher / Fiş No (opsiyonel)</Label>
            <Input placeholder="Fiş no..." value={voucherDesc} onChange={e => setVoucherDesc(e.target.value)} className="h-10" />
          </div>

          {/* Alt kategori + Slip No (KK için) */}
          {(incomeType === "reception" || incomeType === "staff") && (
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-xs font-medium text-gray-600">Alt Kategori{incomeType === "staff" ? " *" : ""}</Label>
                <Select value={subCategory || undefined} onValueChange={(v) => setSubCategory(v)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                  <SelectContent>
                    {incomeType === "reception" && (
                      <SelectItem value="none">Genel Resepsiyon Geliri</SelectItem>
                    )}
                    {INCOME_SUB_CATEGORIES
                      .filter(c => c.code !== "GELIR_REST")
                      .map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === "creditCard" && (
                <div className="w-36 space-y-2">
                  <Label className="text-xs font-medium text-violet-700">Slip No *</Label>
                  <Input
                    placeholder="Slip no..."
                    value={slipNo}
                    onChange={(e) => setSlipNo(e.target.value)}
                    className="h-10 border-violet-300 focus-visible:ring-violet-400"
                  />
                </div>
              )}
            </div>
          )}
          {/* Slip No — agency + creditCard */}
          {incomeType === "agency" && paymentMethod === "creditCard" && (
            <div className="w-full space-y-2">
              <Label className="text-xs font-medium text-violet-700">Slip No *</Label>
              <Input
                placeholder="Slip no..."
                value={slipNo}
                onChange={(e) => setSlipNo(e.target.value)}
                className="h-10 border-violet-300 focus-visible:ring-violet-400"
              />
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

          {/* Kısmi Ödeme — sadece nakit */}
          {paymentMethod === "cash" && !isEditing && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                  checked={hasPending}
                  onChange={(e) => { setHasPending(e.target.checked); if (!e.target.checked) setPendingAmount("") }}
                />
                <span className="text-xs font-medium text-yellow-700">Kısmi Ödeme (müşteri kalan tutarı sonra ödeyecek)</span>
              </label>
              {hasPending && (
                <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50/50 space-y-1.5">
                  <Label className="text-xs font-semibold text-yellow-700">Kalan Tutar *</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={pendingAmount}
                      onChange={(e) => setPendingAmount(e.target.value)}
                      className="flex-1 h-10 border-yellow-300 focus-visible:ring-yellow-400"
                    />
                    <div className="h-8 px-2 text-xs font-bold rounded bg-yellow-200 text-yellow-800 flex items-center">
                      {CURRENCIES.find(c => c.value === currency)?.symbol} {currency}
                    </div>
                  </div>
                  <p className="text-[10px] text-yellow-600">
                    Alınan: {amount || "0"} + Kalan: {pendingAmount || "0"} = Toplam: {((parseFloat(amount) || 0) + (parseFloat(pendingAmount) || 0)).toLocaleString("tr-TR")} {currency}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Açıklama */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Açıklama</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama..." className="resize-none h-16" />
          </div>

          {/* Butonlar */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            {!isEditing && (
              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={handleAddToBasket}
                disabled={submitting}
              >
                + Sepete Ekle
              </Button>
            )}
            <Button
              className={paymentMethod === "creditCard" ? "bg-violet-600 hover:bg-violet-700" : "bg-emerald-600 hover:bg-emerald-700"}
              onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Kaydediliyor..." : isEditing ? "Kaydet" : basket.length > 0 ? `Kaydet (${basket.length + (amount ? 1 : 0)} kalem)` : "Kaydet"}
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
