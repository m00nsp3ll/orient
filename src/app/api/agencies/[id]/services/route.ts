import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Acentanın izin verilen hizmetlerini getir
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "STAFF", "AGENCY"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const params = await context.params
    const agencyId = params.id

    const allowedServices = await prisma.agencyService.findMany({
      where: { agencyId },
      include: {
        service: true,
      },
    })

    return NextResponse.json(
      allowedServices.map(as => ({
        ...as.service,
        passPrice: as.passPrice,
      }))
    )
  } catch (error) {
    console.error("Agency services fetch error:", error)
    return NextResponse.json(
      { error: "Hizmetler alınamadı" },
      { status: 500 }
    )
  }
}

// Acentanın izin verilen hizmetlerini güncelle
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const params = await context.params
    const agencyId = params.id
    const body = await req.json()

    console.log("Received body:", body)

    const { services } = body

    // Önce mevcut tüm ilişkileri sil
    await prisma.agencyService.deleteMany({
      where: { agencyId },
    })

    // Yeni hizmetleri ve Pass fiyatlarını ekle
    if (services && services.length > 0) {
      const data = services.map((s: { serviceId: string; passPrice: number | null }) => ({
        agencyId,
        serviceId: s.serviceId,
        passPrice: s.passPrice,
      }))

      console.log("Creating agency services:", data)

      await prisma.agencyService.createMany({
        data,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Agency services update error:", error)
    return NextResponse.json(
      { error: "Hizmetler güncellenemedi", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
