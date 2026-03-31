import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { syncAccountingEntries } from "@/lib/accounting-sync"
import { checkPermission } from "@/lib/permissions"

const updateSchema = z.object({
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
  expenseCategory: z.string().optional().nullable(),
  incomeSubCategory: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  staffIncomeAmount: z.number().optional().nullable(),
  staffIncomeCurrency: z.string().optional().nullable(),
  creditCardAmount: z.number().optional().nullable(),
  creditCardCurrency: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  info: z.string().optional().nullable(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  // STAFF kullanıcılar için kasa_yonetimi yetkisi kontrolü
  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "kasa_yonetimi")
    if (!hasPerm) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }
  }

  const { id } = await params

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    // Kredi kartı sadece TRY
    if (data.creditCardAmount && data.creditCardCurrency && data.creditCardCurrency !== "TRY") {
      return NextResponse.json({ error: "Kredi kartı sadece TRY destekler" }, { status: 400 })
    }

    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.cashEntry.update({
        where: { id },
        data: {
          agencyId: data.agencyId ?? undefined,
          hotelId: data.hotelId ?? undefined,
          roomNumber: data.roomNumber ?? undefined,
          serviceName: data.serviceName ?? undefined,
          pax: data.pax ?? undefined,
          agencyIncomeAmount: data.agencyIncomeAmount ?? undefined,
          agencyIncomeCurrency: data.agencyIncomeCurrency ?? undefined,
          receptionIncomeAmount: data.receptionIncomeAmount ?? undefined,
          receptionIncomeCurrency: data.receptionIncomeCurrency ?? undefined,
          creditAmount: data.creditAmount ?? undefined,
          creditCurrency: data.creditCurrency ?? undefined,
          expenseAmount: data.expenseAmount ?? undefined,
          expenseCurrency: data.expenseCurrency ?? undefined,
          expenseCategory: data.expenseCategory ?? undefined,
          incomeSubCategory: data.incomeSubCategory ?? undefined,
          staffId: data.staffId ?? undefined,
          staffIncomeAmount: data.staffIncomeAmount ?? undefined,
          staffIncomeCurrency: data.staffIncomeCurrency ?? undefined,
          creditCardAmount: data.creditCardAmount ?? undefined,
          creditCardCurrency: data.creditCardCurrency ?? undefined,
          description: data.description ?? undefined,
          info: data.info ?? undefined,
        },
        include: {
          agency: { select: { id: true, name: true, companyName: true } },
          hotel: { select: { id: true, name: true } },
          staff: { select: { id: true, position: true, commissionRate: true, user: { select: { name: true } } } },
        },
      })

      await syncAccountingEntries(tx, updated, session.user.id)
      return updated
    })

    return NextResponse.json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: "Güncelleme başarısız" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.cashEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 })
  }
}
