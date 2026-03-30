import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Manuel cari hareket ekle (cashEntry'siz, doğrudan AccountingEntry)
const manualEntrySchema = z.object({
  accountCode: z.string(),
  date: z.string(),
  debit: z.number().default(0),
  credit: z.number().default(0),
  currency: z.string(),
  description: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  agencyId: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = manualEntrySchema.parse(body)

    const [y, m, d] = data.date.split("-").map(Number)
    const date = new Date(y, m - 1, d, 12, 0, 0, 0)

    const entry = await prisma.accountingEntry.create({
      data: {
        accountCode: data.accountCode,
        date,
        debit: data.debit,
        credit: data.credit,
        amount: Math.max(data.debit, data.credit),
        currency: data.currency,
        description: data.description || null,
        staffId: data.staffId || null,
        agencyId: data.agencyId || null,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, id: entry.id })
  } catch (error: any) {
    console.error("[muhasebe/cari/entry] HATA:", error)
    return NextResponse.json({ error: error.message || "Kayıt oluşturulamadı" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id, ...rest } = body

    if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 })

    // Sadece cashEntryId'si olmayan (manuel) kayıtlar düzenlenebilir
    const existing = await prisma.accountingEntry.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    if (existing.cashEntryId) return NextResponse.json({ error: "Kasa kaynaklı hareket düzenlenemez" }, { status: 400 })

    const [y, m, d] = (rest.date as string).split("-").map(Number)
    const date = new Date(y, m - 1, d, 12, 0, 0, 0)

    const updated = await prisma.accountingEntry.update({
      where: { id },
      data: {
        date,
        debit: rest.debit ?? 0,
        credit: rest.credit ?? 0,
        amount: Math.max(rest.debit ?? 0, rest.credit ?? 0),
        currency: rest.currency,
        description: rest.description || null,
      },
    })

    return NextResponse.json({ success: true, id: updated.id })
  } catch (error: any) {
    console.error("[muhasebe/cari/entry PUT] HATA:", error)
    return NextResponse.json({ error: error.message || "Güncellenemedi" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 })

  const existing = await prisma.accountingEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
  if (existing.cashEntryId) return NextResponse.json({ error: "Kasa kaynaklı hareket silinemez" }, { status: 400 })

  await prisma.accountingEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
