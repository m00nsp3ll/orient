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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startDateStr = searchParams.get("startDate")
  const endDateStr = searchParams.get("endDate")

  const where: any = {}
  if (startDateStr && endDateStr) {
    const [sy, sm, sd] = startDateStr.split("-").map(Number)
    const [ey, em, ed] = endDateStr.split("-").map(Number)
    where.date = {
      gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
      lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
    }
  }

  const [entries, customCats] = await Promise.all([
    prisma.accountingEntry.findMany({ where }),
    loadCustomCategories(),
  ])

  const customExpenseCodes = new Set(customCats.filter(c => c.type === "expense").map(c => c.code))
  const customIncomeCodes  = new Set(customCats.filter(c => c.type === "income").map(c => c.code))

  // Toplam gelir/gider per currency
  const totalIncome: Record<string, number> = {}
  const totalExpense: Record<string, number> = {}
  const byAccount: Record<string, Record<string, { debit: number; credit: number }>> = {}

  for (const e of entries) {
    const cur = e.currency
    if (!byAccount[e.accountCode]) byAccount[e.accountCode] = {}
    if (!byAccount[e.accountCode][cur]) byAccount[e.accountCode][cur] = { debit: 0, credit: 0 }
    byAccount[e.accountCode][cur].debit += e.debit
    byAccount[e.accountCode][cur].credit += e.credit

    // Gelir hesapları
    if (e.credit > 0 && (
      e.accountCode.startsWith("GELIR_") ||
      INCOME_SUB_CATEGORIES.some(c => c.code === e.accountCode) ||
      customIncomeCodes.has(e.accountCode)
    )) {
      totalIncome[cur] = (totalIncome[cur] || 0) + e.credit
    }

    // Gider hesapları (CARI_ hariç — bunlar iç transfer)
    if (e.debit > 0 && (
      EXPENSE_CATEGORIES.some(c => c.code === e.accountCode) ||
      customExpenseCodes.has(e.accountCode)
    )) {
      totalExpense[cur] = (totalExpense[cur] || 0) + e.debit
    }
  }

  // Kategori kırılımı
  const allCategoryCodes = [
    ...EXPENSE_CATEGORIES.map(c => c.code),
    ...INCOME_SUB_CATEGORIES.map(c => c.code),
    "GELIR_RESEPSIYON", "GELIR_ACENTA", "GELIR_PERSONEL", "GELIR_KREDI_KARTI",
    ...customCats.map(c => c.code),
  ]

  const byCategory = allCategoryCodes
    .filter(code => byAccount[code])
    .map(code => {
      const isExpense = EXPENSE_CATEGORIES.some(c => c.code === code) || customExpenseCodes.has(code)
      const customCat = customCats.find(c => c.code === code)
      const label = customCat ? customCat.label :
        isExpense ? getExpenseCategoryLabel(code) :
        (INCOME_SUB_CATEGORIES.some(c => c.code === code)
          ? getIncomeSubCategoryLabel(code)
          : (ACCOUNT_LABELS[code] ?? code))
      return {
        accountCode: code,
        label,
        type: isExpense ? "expense" : "income",
        totals: byAccount[code],
      }
    })

  return NextResponse.json({ totalIncome, totalExpense, byCategory })
}
