import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { startOfDay } from "date-fns"

const cashEntrySchema = z.object({
  date: z.string(),
  agencyId: z.string().optional().nullable(),
  hotelId: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
  serviceName: z.string().optional().nullable(),
  pax: z.number().int().optional().nullable(),
  agencyIncomeAmount: z.number().optional().nullable(),
  agencyIncomeCurrency: z.string().optional().nullable(),
  receptionIncomeAmount: z.number().optional().nullable(),
  receptionIncomeCurrency: z.string().optional().nullable(),
  creditAmount: z.number().optional().nullable(),
  creditCurrency: z.string().optional().nullable(),
  expenseAmount: z.number().optional().nullable(),
  expenseCurrency: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  staffIncomeAmount: z.number().optional().nullable(),
  staffIncomeCurrency: z.string().optional().nullable(),
  creditCardAmount: z.number().optional().nullable(),
  creditCardCurrency: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  info: z.string().optional().nullable(),
})

function computeSummary(entries: any[]) {
  const currencies = ["TRY", "EUR", "USD", "GBP"]
  const zero = () => Object.fromEntries(currencies.map(c => [c, 0]))

  const agencyIncome = zero()
  const receptionIncome = zero()
  const staffIncome = zero()
  const creditCardIncome = zero()
  const cashIncome = zero()   // nakit: agency + reception + staff (creditCard hariç)
  const totalIncome = zero()  // cash + creditCard
  const credit = zero()
  const expense = zero()
  const commissionExpense = zero() // personel prim gideri

  for (const e of entries) {
    if (e.agencyIncomeAmount && e.agencyIncomeCurrency) {
      agencyIncome[e.agencyIncomeCurrency] += e.agencyIncomeAmount
    }
    if (e.receptionIncomeAmount && e.receptionIncomeCurrency) {
      receptionIncome[e.receptionIncomeCurrency] += e.receptionIncomeAmount
    }
    if (e.staffIncomeAmount && e.staffIncomeCurrency) {
      staffIncome[e.staffIncomeCurrency] += e.staffIncomeAmount
      // Personelin komisyon gideri otomatik hesaplanır
      if (e.staff?.commissionRate) {
        const comm = e.staffIncomeAmount * e.staff.commissionRate / 100
        commissionExpense[e.staffIncomeCurrency] = (commissionExpense[e.staffIncomeCurrency] || 0) + comm
      }
    }
    if (e.creditCardAmount && e.creditCardCurrency) {
      creditCardIncome[e.creditCardCurrency] += e.creditCardAmount
    }
    if (e.creditAmount && e.creditCurrency) {
      credit[e.creditCurrency] += e.creditAmount
    }
    if (e.expenseAmount && e.expenseCurrency) {
      expense[e.expenseCurrency] += e.expenseAmount
    }
  }

  for (const c of currencies) {
    cashIncome[c] = agencyIncome[c] + receptionIncome[c] + staffIncome[c]
    totalIncome[c] = cashIncome[c] + creditCardIncome[c]
  }

  return { agencyIncome, receptionIncome, staffIncome, creditCardIncome, cashIncome, totalIncome, credit, expense, commissionExpense }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date")

  if (!dateStr) {
    return NextResponse.json({ error: "Tarih gerekli" }, { status: 400 })
  }

  // yyyy-MM-dd formatını local timezone olarak parse et
  const [year, month, day] = dateStr.split("-").map(Number)
  const targetDate = new Date(year, month - 1, day)
  targetDate.setHours(0, 0, 0, 0)
  const nextDay = new Date(targetDate)
  nextDay.setDate(nextDay.getDate() + 1)

  const entries = await prisma.cashEntry.findMany({
    where: {
      date: { gte: targetDate, lt: nextDay },
    },
    include: {
      agency: { select: { id: true, name: true, companyName: true } },
      hotel: { select: { id: true, name: true } },
      staff: { select: { id: true, position: true, commissionRate: true, user: { select: { name: true } } } },
    },
    orderBy: { voucherNo: "asc" },
  })

  const summary = computeSummary(entries)

  return NextResponse.json({ entries, summary })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = cashEntrySchema.parse(body)

    const targetDate = startOfDay(new Date(data.date))

    const maxVoucher = await prisma.cashEntry.aggregate({
      where: { date: targetDate },
      _max: { voucherNo: true },
    })
    const nextVoucher = (maxVoucher._max.voucherNo ?? 0) + 1

    const entry = await prisma.cashEntry.create({
      data: {
        date: targetDate,
        voucherNo: nextVoucher,
        agencyId: data.agencyId || null,
        hotelId: data.hotelId || null,
        roomNumber: data.roomNumber || null,
        serviceName: data.serviceName || null,
        pax: data.pax || null,
        agencyIncomeAmount: data.agencyIncomeAmount || null,
        agencyIncomeCurrency: data.agencyIncomeCurrency || null,
        receptionIncomeAmount: data.receptionIncomeAmount || null,
        receptionIncomeCurrency: data.receptionIncomeCurrency || null,
        creditAmount: data.creditAmount || null,
        creditCurrency: data.creditCurrency || null,
        expenseAmount: data.expenseAmount || null,
        expenseCurrency: data.expenseCurrency || null,
        staffId: data.staffId || null,
        staffIncomeAmount: data.staffIncomeAmount || null,
        staffIncomeCurrency: data.staffIncomeCurrency || null,
        creditCardAmount: data.creditCardAmount || null,
        creditCardCurrency: data.creditCardCurrency || null,
        description: data.description || null,
        info: data.info || null,
        createdBy: session.user.id,
      },
      include: {
        agency: { select: { id: true, name: true, companyName: true } },
        hotel: { select: { id: true, name: true } },
        staff: { select: { id: true, position: true, commissionRate: true, user: { select: { name: true } } } },
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Cash entry create error:", error)
    const message = error instanceof Error ? error.message : "Kasa girişi oluşturulamadı"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
