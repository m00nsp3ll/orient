import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const hotels = await prisma.hotel.findMany({
    where: { isActive: true },
    include: {
      region: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { region: { name: "asc" } },
      { name: "asc" },
    ],
  })

  return NextResponse.json(hotels)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "operasyon_duzenleme")
    if (!hasPerm) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, regionId } = body

    if (!name || !regionId) {
      return NextResponse.json({ error: "Otel adı ve bölge gerekli" }, { status: 400 })
    }

    const hotel = await prisma.hotel.create({
      data: { name, regionId, isActive: true },
      include: {
        region: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(hotel)
  } catch {
    return NextResponse.json({ error: "Otel oluşturulamadı" }, { status: 500 })
  }
}
