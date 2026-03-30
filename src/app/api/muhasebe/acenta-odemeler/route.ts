import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const agencyId = searchParams.get("agencyId")
  if (!agencyId) return NextResponse.json({ error: "agencyId gerekli" }, { status: 400 })

  const startDateStr = searchParams.get("startDate")
  const endDateStr   = searchParams.get("endDate")

  const where: any = {
    accountCode: `CARI_ACENTA_${agencyId}`,
  }

  if (startDateStr && endDateStr) {
    const [sy, sm, sd] = startDateStr.split("-").map(Number)
    const [ey, em, ed] = endDateStr.split("-").map(Number)
    where.date = {
      gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
      lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
    }
  }

  const entries = await prisma.accountingEntry.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      cashEntry: { select: { voucherNo: true, info: true } },
      createdByUser: { select: { name: true } },
    },
  })

  const enriched = entries.map(e => ({
    ...e,
    createdByName: (e as any).createdByUser?.name ?? null,
  }))

  return NextResponse.json(enriched)
}
