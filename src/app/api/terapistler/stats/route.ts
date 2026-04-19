import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const startDate = req.nextUrl.searchParams.get("startDate")
  const endDate = req.nextUrl.searchParams.get("endDate")
  const therapistId = req.nextUrl.searchParams.get("therapistId")

  const where: any = {}
  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate + "T00:00:00.000Z"),
      lte: new Date(endDate + "T23:59:59.999Z"),
    }
  }
  if (therapistId) where.therapistId = therapistId

  const entries = await prisma.therapistEntry.findMany({
    where,
    include: { therapist: { select: { name: true } } },
  })

  // Group by therapist
  const byTherapist: Record<string, { name: string; totalPrim: number; totalCount: number; byService: Record<string, { count: number; prim: number }> }> = {}

  for (const e of entries) {
    if (!byTherapist[e.therapistId]) {
      byTherapist[e.therapistId] = { name: e.therapist.name, totalPrim: 0, totalCount: 0, byService: {} }
    }
    const t = byTherapist[e.therapistId]
    t.totalPrim += e.primAmount
    t.totalCount += e.count
    if (!t.byService[e.serviceType]) {
      t.byService[e.serviceType] = { count: 0, prim: 0 }
    }
    t.byService[e.serviceType].count += e.count
    t.byService[e.serviceType].prim += e.primAmount
  }

  // Grand totals
  const grandTotalPrim = Object.values(byTherapist).reduce((s, t) => s + t.totalPrim, 0)
  const grandTotalCount = Object.values(byTherapist).reduce((s, t) => s + t.totalCount, 0)

  return NextResponse.json({ byTherapist, grandTotalPrim, grandTotalCount })
}
