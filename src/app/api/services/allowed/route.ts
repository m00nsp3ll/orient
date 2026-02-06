import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Acentanın satış yapabileceği hizmetleri getir
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  // Admin ve Staff tüm hizmetleri görebilir
  if (["ADMIN", "STAFF"].includes(session.user.role)) {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(services)
  }

  // Acenta ise sadece atanan hizmetleri görebilir
  if (session.user.role === "AGENCY") {
    const agency = await prisma.agency.findUnique({
      where: { userId: session.user.id },
    })

    if (!agency) {
      return NextResponse.json({ error: "Acenta bulunamadı" }, { status: 404 })
    }

    // Acentaya atanan hizmetleri getir
    const agencyServices = await prisma.agencyService.findMany({
      where: { agencyId: agency.id },
      include: {
        service: {
          include: { category: true },
        },
      },
    })

    // Eğer hiç hizmet atanmamışsa, tüm hizmetleri göster (default davranış)
    if (agencyServices.length === 0) {
      const services = await prisma.service.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: "asc" },
      })
      return NextResponse.json(services)
    }

    // Sadece atanan hizmetleri döndür - Pass fiyatlarını kullan
    const services = agencyServices
      .filter(as => as.service.isActive)
      .map(as => ({
        ...as.service,
        price: as.passPrice ?? as.service.price, // Pass fiyatı varsa onu kullan
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(services)
  }

  // Diğer roller için tüm hizmetler
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(services)
}
