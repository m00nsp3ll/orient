import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { notifyDriverAssigned } from "@/lib/onesignal-server"
import { format } from "date-fns"
import { checkPermission } from "@/lib/permissions"

const updateTransferSchema = z.object({
  status: z.enum([
    "PENDING",
    "PICKING_UP",
    "AT_SPA",
    "IN_SERVICE",
    "DROPPING_OFF",
    "COMPLETED",
    "CANCELLED",
  ]).optional(),
  driverId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pickupTime: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  dropoffTime: z.string().optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  if (!["ADMIN", "STAFF", "DRIVER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  // STAFF kullanıcılar için operasyon_duzenleme yetkisi kontrolü
  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "operasyon_duzenleme")
    if (!hasPerm) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }
  }

  try {
    const { id } = await params
    const body = await req.json()
    const validatedData = updateTransferSchema.parse(body)

    // If driver, verify they own this transfer
    if (session.user.role === "DRIVER") {
      const driver = await prisma.driver.findUnique({
        where: { userId: session.user.id },
      })
      const transfer = await prisma.transfer.findUnique({
        where: { id },
      })
      if (!driver || transfer?.driverId !== driver.id) {
        return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
      }
    }

    const updateData: Record<string, unknown> = {}

    if (validatedData.status) {
      updateData.status = validatedData.status

      // Auto-set timestamps based on status
      const now = new Date()
      switch (validatedData.status) {
        case "PICKING_UP":
          updateData.pickupTime = now
          break
        case "AT_SPA":
          updateData.arrivalTime = now
          break
        case "DROPPING_OFF":
          updateData.departureTime = now
          break
        case "COMPLETED":
          updateData.dropoffTime = now
          break
      }
    }

    if (validatedData.driverId !== undefined) {
      updateData.driverId = validatedData.driverId
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes
    }

    // Manual time overrides
    if (validatedData.pickupTime) {
      updateData.pickupTime = new Date(validatedData.pickupTime)
    }
    if (validatedData.arrivalTime) {
      updateData.arrivalTime = new Date(validatedData.arrivalTime)
    }
    if (validatedData.departureTime) {
      updateData.departureTime = new Date(validatedData.departureTime)
    }
    if (validatedData.dropoffTime) {
      updateData.dropoffTime = new Date(validatedData.dropoffTime)
    }

    const transfer = await prisma.transfer.update({
      where: { id },
      data: updateData,
      include: {
        appointment: {
          include: {
            service: true,
            hotel: {
              include: {
                region: true,
              },
            },
            customer: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Transfer COMPLETED olduğunda appointment'ı da COMPLETED yap
    if (validatedData.status === "COMPLETED") {
      await prisma.appointment.update({
        where: { id: transfer.appointmentId },
        data: { status: "COMPLETED" },
      })
    }

    // Şoför yeni atandıysa bildirim gönder
    if (validatedData.driverId && transfer.driverId) {
      try {
        const customerName = transfer.appointment.customerName || "Misafir"
        const hotelName = transfer.appointment.hotel?.name || "Otel"
        const time = format(new Date(transfer.appointment.startTime), "HH:mm")

        await notifyDriverAssigned(
          transfer.driverId,
          customerName,
          hotelName,
          time
        )
      } catch (notifError) {
        console.error("Bildirim gönderilemedi:", notifError)
        // Bildirim hatası transfer güncellemeyi engellemez
      }
    }

    return NextResponse.json(transfer)
  } catch (error) {
    console.error("Transfer update error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Transfer güncellenemedi" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  if (!["ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const { id } = await params

    await prisma.transfer.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Transfer delete error:", error)
    return NextResponse.json(
      { error: "Transfer silinemedi" },
      { status: 500 }
    )
  }
}
