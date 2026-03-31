import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { checkPermission } from "@/lib/permissions"

const virmanSchema = z.object({
  fromAccountCode: z.string(),
  toAccountCode: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  date: z.string(),
  description: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "muhasebe_view")
    if (!hasPerm) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  const virmans = await prisma.accountingEntry.findMany({
    where: { transferGroupId: { not: null }, cashEntryId: null },
    include: {
      staff: { include: { user: { select: { name: true } } } },
      agency: { select: { name: true, companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Virman çiftlerini groupId ile eşleştir
  const groups: Record<string, any[]> = {}
  for (const e of virmans) {
    if (!e.transferGroupId) continue
    if (!groups[e.transferGroupId]) groups[e.transferGroupId] = []
    groups[e.transferGroupId].push(e)
  }

  const result = Object.entries(groups).map(([groupId, entries]) => {
    const from = entries.find(e => e.credit > 0)
    const to = entries.find(e => e.debit > 0)
    return {
      transferGroupId: groupId,
      date: entries[0].date,
      fromAccountCode: from?.accountCode,
      toAccountCode: to?.accountCode,
      amount: entries[0].amount,
      currency: entries[0].currency,
      description: entries[0].description,
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "muhasebe_view")
    if (!hasPerm) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = virmanSchema.parse(body)
    const transferGroupId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const date = new Date(data.date)

    await prisma.$transaction(async (tx) => {
      await tx.accountingEntry.createMany({
        data: [
          {
            accountCode: data.fromAccountCode,
            credit: data.amount,
            debit: 0,
            amount: data.amount,
            currency: data.currency,
            date,
            description: data.description || `Virman → ${data.toAccountCode}`,
            transferGroupId,
            createdBy: session.user.id,
          },
          {
            accountCode: data.toAccountCode,
            debit: data.amount,
            credit: 0,
            amount: data.amount,
            currency: data.currency,
            date,
            description: data.description || `Virman ← ${data.fromAccountCode}`,
            transferGroupId,
            createdBy: session.user.id,
          },
        ],
      })
    })

    return NextResponse.json({ success: true, transferGroupId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Virman error:", error)
    return NextResponse.json({ error: "Virman işlemi başarısız" }, { status: 500 })
  }
}
