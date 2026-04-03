import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const params = await context.params
    const { action } = await req.json()

    if (!action || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        services: true,
        agency: { select: { id: true, currency: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 })
    }

    const appointment = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        approvalStatus: action === "approve" ? "APPROVED" : "REJECTED",
      },
      include: {
        agency: { select: { id: true, companyName: true, name: true } },
        service: true,
        hotel: { include: { region: { select: { name: true } } } },
      },
    })

    if (action === "approve") {
      // Transfer kaydı oluştur
      const existingTransfer = await prisma.transfer.findFirst({
        where: { appointmentId: params.id },
      })
      if (!existingTransfer) {
        await prisma.transfer.create({
          data: { appointmentId: params.id },
        })
      }
    }

    if (action === "reject") {
      // Reddedildiğinde bu randevuya ait tüm AgencyTransaction'ları sil
      await prisma.agencyTransaction.deleteMany({
        where: { appointmentId: params.id },
      })
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error("Approval error:", error)
    return NextResponse.json(
      { error: "İşlem gerçekleştirilemedi" },
      { status: 500 }
    )
  }
}

