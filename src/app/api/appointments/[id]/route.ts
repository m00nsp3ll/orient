import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateAppointmentSchema = z.object({
  startTime: z.string().transform((str) => new Date(str)).optional(),
  staffId: z.string().optional(),
  serviceId: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  notes: z.string().optional(),
  childCount: z.number().optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true },
      },
      staff: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
      service: true,
    },
  })

  if (!appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 })
  }

  // Customers can only see their own appointments
  if (
    session.user.role === "CUSTOMER" &&
    appointment.customerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  return NextResponse.json(appointment)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = updateAppointmentSchema.parse(body)

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 })
    }

    // Customers can only cancel their own appointments
    if (session.user.role === "CUSTOMER") {
      if (existingAppointment.customerId !== session.user.id) {
        return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
      }
      if (validatedData.status && validatedData.status !== "CANCELLED") {
        return NextResponse.json(
          { error: "Sadece randevunuzu iptal edebilirsiniz" },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = { ...validatedData }

    // Recalculate end time if start time changes
    if (validatedData.startTime) {
      const startTime = validatedData.startTime
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + 60)
      updateData.endTime = endTime
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        staff: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        service: true,
        agency: { select: { id: true, name: true, companyName: true, currency: true } },
      },
    })

    // İptal edildiğinde acenta cari bakiyesini düşür
    if (validatedData.status === "CANCELLED" && existingAppointment.agencyId && existingAppointment.status !== "CANCELLED") {
      // Bu randevuya ait DEBIT transaction'ları bul
      const debitTransactions = await prisma.agencyTransaction.findMany({
        where: {
          appointmentId: id,
          type: "DEBIT",
        },
      })

      // Her DEBIT için ters CREDIT oluştur
      for (const debit of debitTransactions) {
        await prisma.agencyTransaction.create({
          data: {
            agencyId: debit.agencyId,
            appointmentId: id,
            type: "CREDIT",
            amount: debit.amount,
            currency: debit.currency,
            description: `İptal iadesi: ${debit.description || "Randevu iptal edildi"}`,
          },
        })
      }

      // REST CREDIT transaction'ları da tersine çevir (DEBIT olarak geri al)
      const creditTransactions = await prisma.agencyTransaction.findMany({
        where: {
          appointmentId: id,
          type: "CREDIT",
          description: { contains: "REST" },
        },
      })

      for (const credit of creditTransactions) {
        await prisma.agencyTransaction.create({
          data: {
            agencyId: credit.agencyId,
            appointmentId: id,
            type: "DEBIT",
            amount: credit.amount,
            currency: credit.currency,
            description: `İptal: REST iadesi geri alındı`,
          },
        })
      }
    }

    // İptal edildiğinde Transfer kaydını sil (operasyondan kaldır)
    if (validatedData.status === "CANCELLED" && existingAppointment.status !== "CANCELLED") {
      await prisma.transfer.deleteMany({
        where: { appointmentId: id },
      })
    }

    return NextResponse.json(appointment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Randevu güncellenemedi" },
      { status: 500 }
    )
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
    await prisma.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Randevu silinemedi" }, { status: 500 })
  }
}
