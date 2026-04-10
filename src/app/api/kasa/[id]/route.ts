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
  slipNo: z.string().optional().nullable(),
  voucherDesc: z.string().optional().nullable(),
  pendingAmount: z.number().optional().nullable(),
  pendingCurrency: z.string().optional().nullable(),
  isPaid: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
  }

  // STAFF kullanıcılar için yetki kontrolü:
  // Sadece ödeme onayı (isPaid=true) ise kasa_view yeterli, tam düzenleme için kasa_yonetimi gerekir
  if (session.user.role === "STAFF") {
    const PAYMENT_CONFIRM_KEYS = new Set([
      "isPaid", "pendingAmount", "pendingCurrency",
      "agencyIncomeAmount", "agencyIncomeCurrency",
      "receptionIncomeAmount", "receptionIncomeCurrency",
      "staffIncomeAmount", "staffIncomeCurrency",
    ])
    const bodyKeys = Object.keys(body as object)
    const isPaymentConfirmOnly =
      (body as any).isPaid === true &&
      bodyKeys.every((k) => PAYMENT_CONFIRM_KEYS.has(k))

    if (isPaymentConfirmOnly) {
      const hasPerm = await checkPermission(session.user.role, session.user.id, "kasa_view")
      if (!hasPerm) {
        return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
      }
    } else {
      const hasPerm = await checkPermission(session.user.role, session.user.id, "kasa_yonetimi")
      if (!hasPerm) {
        return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
      }
    }
  }

  try {
    const data = updateSchema.parse(body)

    // Kredi kartı sadece TRY
    if (data.creditCardAmount && data.creditCardCurrency && data.creditCardCurrency !== "TRY") {
      return NextResponse.json({ error: "Kredi kartı sadece TRY destekler" }, { status: 400 })
    }

    // PUT semantiği: body'de yok → undefined (Prisma atlar); body'de explicit null → null set edilir; value → set.
    // Bu sayede frontend buildPayload tipi değiştirdiğinde eski tipin amount/id alanlarını null'a çekerek temizleyebilir.
    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.cashEntry.update({
        where: { id },
        data: {
          agencyId: data.agencyId,
          hotelId: data.hotelId,
          roomNumber: data.roomNumber,
          serviceName: data.serviceName,
          pax: data.pax,
          agencyIncomeAmount: data.agencyIncomeAmount,
          agencyIncomeCurrency: data.agencyIncomeCurrency,
          receptionIncomeAmount: data.receptionIncomeAmount,
          receptionIncomeCurrency: data.receptionIncomeCurrency,
          creditAmount: data.creditAmount,
          creditCurrency: data.creditCurrency,
          expenseAmount: data.expenseAmount,
          expenseCurrency: data.expenseCurrency,
          expenseCategory: data.expenseCategory,
          incomeSubCategory: data.incomeSubCategory,
          staffId: data.staffId,
          staffIncomeAmount: data.staffIncomeAmount,
          staffIncomeCurrency: data.staffIncomeCurrency,
          creditCardAmount: data.creditCardAmount,
          creditCardCurrency: data.creditCardCurrency,
          description: data.description,
          info: data.info,
          slipNo: data.slipNo,
          voucherDesc: data.voucherDesc,
          pendingAmount: data.pendingAmount,
          pendingCurrency: data.pendingCurrency,
          isPaid: data.isPaid,
        },
        include: {
          agency: { select: { id: true, name: true, companyName: true } },
          hotel: { select: { id: true, name: true } },
          staff: { select: { id: true, position: true, commissionRate: true, user: { select: { name: true } } } },
          createdByUser: { select: { name: true } },
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
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "kasa_yonetimi")
    if (!hasPerm) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }
  }

  const { id } = await params

  try {
    await prisma.cashEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 })
  }
}
