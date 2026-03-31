import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { syncAccountingEntries } from "@/lib/accounting-sync"
import { startOfDay } from "date-fns"

const entrySchema = z.object({
  type: z.enum(["income", "expense"]),
  date: z.string(),
  // Gelir alanları
  incomeType: z.enum(["reception", "agency", "staff", "creditCard"]).optional(),
  receptionIncomeAmount: z.number().optional().nullable(),
  receptionIncomeCurrency: z.string().optional().nullable(),
  incomeSubCategory: z.string().optional().nullable(),
  agencyIncomeAmount: z.number().optional().nullable(),
  agencyIncomeCurrency: z.string().optional().nullable(),
  agencyId: z.string().optional().nullable(),
  staffIncomeAmount: z.number().optional().nullable(),
  staffIncomeCurrency: z.string().optional().nullable(),
  creditCardAmount: z.number().optional().nullable(),
  creditCardCurrency: z.string().optional().nullable(),
  // Gider alanları
  expenseAmount: z.number().optional().nullable(),
  expenseCurrency: z.string().optional().nullable(),
  expenseCategory: z.string().optional().nullable(),
  // Ortak
  staffId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  hotelId: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
  serviceName: z.string().optional().nullable(),
  pax: z.number().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = entrySchema.parse(body)

    if (data.type === "expense" && data.expenseAmount && !data.expenseCategory) {
      return NextResponse.json({ error: "Gider kategorisi seçiniz" }, { status: 400 })
    }

    const [y, m, d] = data.date.split("-").map(Number)
    const targetDate = new Date(y, m - 1, d, 0, 0, 0, 0)

    const maxVoucher = await prisma.cashEntry.aggregate({
      where: { date: { gte: startOfDay(targetDate), lt: new Date(y, m - 1, d + 1) } },
      _max: { voucherNo: true },
    })
    const nextVoucher = (maxVoucher._max.voucherNo ?? 0) + 1

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.cashEntry.create({
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
          incomeSubCategory: data.incomeSubCategory || null,
          staffId: data.staffId || null,
          staffIncomeAmount: data.staffIncomeAmount || null,
          staffIncomeCurrency: data.staffIncomeCurrency || null,
          creditCardAmount: data.creditCardAmount || null,
          creditCardCurrency: data.creditCardCurrency || "TRY",
          expenseAmount: data.expenseAmount || null,
          expenseCurrency: data.expenseCurrency || null,
          expenseCategory: data.expenseCategory || null,
          description: data.description || null,
          info: "MUHASEBE",
          createdBy: session.user.id,
        },
        include: { staff: { select: { commissionRate: true } } },
      })
      await syncAccountingEntries(tx, entry, session.user.id)
      return entry
    })

    return NextResponse.json({ success: true, id: created.id })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("[muhasebe/entry] HATA:", error)
    return NextResponse.json({ error: error.message || "Kayıt oluşturulamadı" }, { status: 500 })
  }
}
