import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getExpenseCategoryLabel, getIncomeSubCategoryLabel, EXPENSE_CATEGORIES, INCOME_SUB_CATEGORIES, ACCOUNT_LABELS } from "@/lib/accounting-constants"

function getAccountLabel(code: string): string {
  const exp = EXPENSE_CATEGORIES.find(c => c.code === code)
  if (exp) return exp.label
  const inc = INCOME_SUB_CATEGORIES.find(c => c.code === code)
  if (inc) return inc.label
  if (ACCOUNT_LABELS[code]) return ACCOUNT_LABELS[code]
  return code
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountCode: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { accountCode } = await params
  const decoded = decodeURIComponent(accountCode)
  const { searchParams } = new URL(req.url)
  const startDateStr = searchParams.get("startDate")
  const endDateStr = searchParams.get("endDate")

  const where: any = { accountCode: decoded }
  if (startDateStr && endDateStr) {
    where.date = {
      gte: new Date(startDateStr),
      lte: new Date(endDateStr + "T23:59:59.999Z"),
    }
  }

  const entries = await prisma.accountingEntry.findMany({
    where,
    include: {
      cashEntry: { select: { voucherNo: true, date: true } },
      staff: { include: { user: { select: { name: true } } } },
      agency: { select: { name: true, companyName: true } },
      createdByUser: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  })

  // Running balance per currency
  const runningBalance: Record<string, number> = {}
  const enriched = entries.map(e => {
    const cur = e.currency
    if (!runningBalance[cur]) runningBalance[cur] = 0
    runningBalance[cur] += e.credit - e.debit
    return {
      id: e.id,
      date: e.date,
      debit: e.debit,
      credit: e.credit,
      currency: cur,
      description: e.description,
      runningBalance: runningBalance[cur],
      transferGroupId: e.transferGroupId,
      cashEntry: e.cashEntry ? { voucherNo: e.cashEntry.voucherNo, date: e.cashEntry.date } : null,
      staff: e.staff ? { name: e.staff.user.name } : null,
      agency: e.agency ? { name: e.agency.companyName || e.agency.name } : null,
      createdByName: (e as any).createdByUser?.name ?? null,
    }
  })

  // Summary per currency
  const summary: Record<string, { totalDebit: number; totalCredit: number; bakiye: number }> = {}
  for (const e of entries) {
    if (!summary[e.currency]) summary[e.currency] = { totalDebit: 0, totalCredit: 0, bakiye: 0 }
    summary[e.currency].totalDebit += e.debit
    summary[e.currency].totalCredit += e.credit
  }
  for (const cur in summary) {
    summary[cur].bakiye = summary[cur].totalCredit - summary[cur].totalDebit
  }

  return NextResponse.json({
    accountCode: decoded,
    label: getAccountLabel(decoded),
    entries: enriched,
    summary,
  })
}
