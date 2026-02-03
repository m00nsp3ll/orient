import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
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
