import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServicePrim, THERAPIST_SERVICE_TYPES } from "@/lib/therapist-constants"
import { checkPermission } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = req.nextUrl.searchParams.get("date")
  if (!date) return NextResponse.json({ error: "date parametresi gerekli" }, { status: 400 })

  const dayStart = new Date(date + "T00:00:00.000Z")
  const dayEnd = new Date(date + "T23:59:59.999Z")

  const entries = await prisma.therapistEntry.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    include: { therapist: { select: { name: true } } },
  })

  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { date, entries } = await req.json() as {
    date: string
    entries: { therapistId: string; serviceType: string; count: number }[]
  }

  if (!date || !entries) {
    return NextResponse.json({ error: "date ve entries gerekli" }, { status: 400 })
  }

  const dayStart = new Date(date + "T00:00:00.000Z")
  const validCodes: string[] = THERAPIST_SERVICE_TYPES.map(s => s.code)

  const operations = entries
    .filter(e => validCodes.includes(e.serviceType) && e.count >= 0)
    .map(e => {
      const primPerUnit = getServicePrim(e.serviceType)
      return prisma.therapistEntry.upsert({
        where: {
          date_therapistId_serviceType: {
            date: dayStart,
            therapistId: e.therapistId,
            serviceType: e.serviceType,
          },
        },
        create: {
          date: dayStart,
          therapistId: e.therapistId,
          serviceType: e.serviceType,
          count: e.count,
          primAmount: e.count * primPerUnit,
          createdBy: session.user.id,
        },
        update: {
          count: e.count,
          primAmount: e.count * primPerUnit,
        },
      })
    })

  await prisma.$transaction(operations)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManage = await checkPermission(session.user.role, session.user.id, "terapistler_yonetim")
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { date } = await req.json() as { date: string }
  if (!date) return NextResponse.json({ error: "date parametresi gerekli" }, { status: 400 })

  const dayStart = new Date(date + "T00:00:00.000Z")
  const dayEnd = new Date(date + "T23:59:59.999Z")

  await prisma.therapistEntry.deleteMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
  })

  return NextResponse.json({ ok: true })
}
