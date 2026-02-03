import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, regionId, isActive, address, lat, lng, googleMapsUrl, distanceToMarina } = body

    const hotel = await prisma.hotel.update({
      where: { id },
      data: {
        name,
        regionId,
        isActive,
        address,
        lat,
        lng,
        googleMapsUrl,
        distanceToMarina,
      },
      include: {
        region: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(hotel)
  } catch {
    return NextResponse.json({ error: "Otel güncellenemedi" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    await prisma.hotel.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Otel silinemedi" }, { status: 500 })
  }
}
