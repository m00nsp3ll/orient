import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const regions = await prisma.region.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { hotels: true },
      },
    },
  })

  return NextResponse.json(regions)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: "Bölge adı gerekli" }, { status: 400 })
    }

    const region = await prisma.region.create({
      data: { name, isActive: true },
    })

    return NextResponse.json(region)
  } catch {
    return NextResponse.json({ error: "Bölge oluşturulamadı" }, { status: 500 })
  }
}
