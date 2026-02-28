import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const regions = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        pickupTimeRegionId: true,
        pickupTimeRegion: {
          select: { id: true, name: true },
        },
        sessionTimes: {
          where: { isActive: true },
          orderBy: { time: "asc" },
          select: { id: true, regionId: true, time: true, isActive: true, maxQuota: true },
        },
        _count: {
          select: { hotels: true },
        },
      },
    })

    return NextResponse.json(regions)
  } catch (error) {
    console.error("GET /api/regions/session-times error:", error)
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await req.json()
    const { regionId, time } = body

    if (!regionId || !time) {
      return NextResponse.json({ error: "Bölge ve saat gerekli" }, { status: 400 })
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(time)) {
      return NextResponse.json({ error: "Geçersiz saat formatı (HH:mm)" }, { status: 400 })
    }

    const sessionTime = await prisma.regionSessionTime.upsert({
      where: { regionId_time: { regionId, time } },
      update: { isActive: true },
      create: { regionId, time, isActive: true },
    })

    return NextResponse.json(sessionTime)
  } catch (error) {
    console.error("POST /api/regions/session-times error:", error)
    return NextResponse.json({ error: "Seans saati eklenemedi" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await req.json()
    const { id, time, maxQuota } = body

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 })
    }

    const updateData: { time?: string; maxQuota?: number } = {}

    if (time !== undefined) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
      if (!timeRegex.test(time)) {
        return NextResponse.json({ error: "Geçersiz saat formatı (HH:mm)" }, { status: 400 })
      }
      updateData.time = time
    }

    if (maxQuota !== undefined) {
      updateData.maxQuota = parseInt(maxQuota)
    }

    const existing = await prisma.regionSessionTime.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    }

    if (updateData.time) {
      const duplicate = await prisma.regionSessionTime.findUnique({
        where: { regionId_time: { regionId: existing.regionId, time: updateData.time } },
      })
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json({ error: "Bu saat zaten mevcut" }, { status: 400 })
      }
    }

    const updated = await prisma.regionSessionTime.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/regions/session-times error:", error)
    return NextResponse.json({ error: "Seans saati güncellenemedi" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 })
    }

    await prisma.regionSessionTime.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/regions/session-times error:", error)
    return NextResponse.json({ error: "Seans saati silinemedi" }, { status: 500 })
  }
}
