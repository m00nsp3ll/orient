import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  EXPENSE_CATEGORIES, INCOME_SUB_CATEGORIES, ACCOUNT_LABELS,
  getExpenseCategoryLabel, getIncomeSubCategoryLabel,
} from "@/lib/accounting-constants"

type CustomCategory = { code: string; label: string; type: "income" | "expense" }

async function loadCustomCategories(): Promise<CustomCategory[]> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "accounting_custom_categories" } })
  if (!setting) return []
  try { return JSON.parse(setting.value) } catch { return [] }
}

// Label overrides
async function loadLabelOverrides(): Promise<Record<string, string>> {
  const settings = await prisma.systemSetting.findMany({ where: { key: { startsWith: "accounting_label_" } } })
  const map: Record<string, string> = {}
  for (const s of settings) { map[s.key.replace("accounting_label_", "")] = s.value }
  return map
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  // Sabit cari hesaplar (gider + gelir kategorileri)
  const staticEntries = await prisma.accountingEntry.groupBy({
    by: ["accountCode", "currency"],
    _sum: { debit: true, credit: true },
  })

  const staticMap: Record<string, Record<string, { debit: number; credit: number }>> = {}
  for (const e of staticEntries) {
    if (!staticMap[e.accountCode]) staticMap[e.accountCode] = {}
    staticMap[e.accountCode][e.currency] = {
      debit: e._sum.debit ?? 0,
      credit: e._sum.credit ?? 0,
    }
  }

  // Personel carileri (AccountingEntry üzerinden)
  const staffEntries = await prisma.accountingEntry.findMany({
    where: { accountCode: { startsWith: "CARI_PERSONEL_" } },
    include: { staff: { include: { user: { select: { name: true } } } } },
  })

  const staffMap: Record<string, { name: string; balances: Record<string, { debit: number; credit: number }> }> = {}
  for (const e of staffEntries) {
    const key = e.accountCode
    if (!staffMap[key]) {
      staffMap[key] = {
        name: e.staff?.user?.name ?? "Bilinmeyen Personel",
        balances: {},
      }
    }
    if (!staffMap[key].balances[e.currency]) staffMap[key].balances[e.currency] = { debit: 0, credit: 0 }
    staffMap[key].balances[e.currency].debit += e.debit
    staffMap[key].balances[e.currency].credit += e.credit
  }

  // Acenta carileri — AgencyTransaction üzerinden borç, AccountingEntry üzerinden ödeme
  const agencies = await prisma.agency.findMany({
    select: { id: true, name: true, companyName: true, currency: true },
    orderBy: { companyName: "asc" },
  })

  // Tüm acenta AgencyTransaction borçları
  const agencyTxs = await prisma.agencyTransaction.findMany({
    select: { agencyId: true, type: true, amount: true, currency: true },
  })

  // Acenta AccountingEntry ödemeleri (CARI_ACENTA_ kodlu credit'lar)
  const agencyAccEntries = await prisma.accountingEntry.findMany({
    where: { accountCode: { startsWith: "CARI_ACENTA_" } },
    select: { accountCode: true, debit: true, credit: true, currency: true, agencyId: true },
  })

  const agencyAccounts = agencies.map(ag => {
    const txs = agencyTxs.filter(t => t.agencyId === ag.id)
    const accEntries = agencyAccEntries.filter(e => e.agencyId === ag.id)

    // Bakiye: AgencyTransaction DEBIT → borç artar, CREDIT/PAYMENT → borç azalır
    // AccountingEntry credit → ödeme yapıldı (borç azalır)
    const balanceMap: Record<string, number> = {}

    for (const tx of txs) {
      const cur = tx.currency || ag.currency
      if (!balanceMap[cur]) balanceMap[cur] = 0
      if (tx.type === "DEBIT") balanceMap[cur] += tx.amount
      else balanceMap[cur] -= tx.amount // CREDIT veya PAYMENT
    }

    // AccountingEntry'deki ödemeleri de düş (kasa/muhasebe üzerinden)
    for (const e of accEntries) {
      const cur = e.currency
      if (!balanceMap[cur]) balanceMap[cur] = 0
      // credit = ödeme geldi (borç azalır), debit = borç arttı (nadir)
      balanceMap[cur] -= e.credit
      balanceMap[cur] += e.debit
    }

    const balances: Record<string, { debit: number; credit: number; bakiye: number }> = {}
    for (const [cur, net] of Object.entries(balanceMap)) {
      if (net !== 0) {
        balances[cur] = { debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, bakiye: -net }
      }
    }

    return {
      accountCode: `CARI_ACENTA_${ag.id}`,
      label: ag.companyName || ag.name,
      type: "agency",
      balances,
      agencyId: ag.id,
      agencyCurrency: ag.currency,
    }
  })

  const [customCats, labelOverrides] = await Promise.all([loadCustomCategories(), loadLabelOverrides()])

  const allCodes = [
    ...EXPENSE_CATEGORIES.map(c => c.code),
    ...INCOME_SUB_CATEGORIES.map(c => c.code),
    "GELIR_RESEPSIYON", "GELIR_ACENTA", "GELIR_PERSONEL", "GELIR_KREDI_KARTI",
    ...customCats.map(c => c.code),
  ]

  const staticAccounts = allCodes
    .filter(code => staticMap[code])
    .map(code => {
      const isExpense = EXPENSE_CATEGORIES.some(c => c.code === code)
      const isIncomeSub = INCOME_SUB_CATEGORIES.some(c => c.code === code)
      const customCat = customCats.find(c => c.code === code)
      const label = labelOverrides[code] ?? (
        customCat ? customCat.label :
        isExpense ? getExpenseCategoryLabel(code) :
        isIncomeSub ? getIncomeSubCategoryLabel(code) :
        (ACCOUNT_LABELS[code] ?? code)
      )
      const type = customCat ? customCat.type : isExpense ? "expense" : "income"
      const balances: Record<string, { debit: number; credit: number; bakiye: number }> = {}
      for (const [cur, v] of Object.entries(staticMap[code] ?? {})) {
        balances[cur] = { ...v, bakiye: v.credit - v.debit }
      }
      return { accountCode: code, label, type, balances, isCustom: !!customCat }
    })

  const staffAccounts = Object.entries(staffMap).map(([code, v]) => {
    const balances: Record<string, { debit: number; credit: number; bakiye: number }> = {}
    for (const [cur, b] of Object.entries(v.balances)) {
      balances[cur] = { ...b, bakiye: b.debit - b.credit }
    }
    return { accountCode: code, label: v.name, type: "staff", balances }
  })

  return NextResponse.json({ accounts: [...staticAccounts, ...staffAccounts, ...agencyAccounts] })
}
