import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const appointmentSchema = z.object({
  customerId: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  serviceId: z.string(),
  startTime: z.string().transform((str) => new Date(str)),
  notes: z.string().optional().nullable(),
  isRest: z.boolean().optional(),
  // Agency specific fields
  agencyId: z.string().optional().nullable(),
  hotelId: z.string().optional().nullable(),
  pax: z.number().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  // Sepet sistemi için
  services: z.array(z.object({
    id: z.string(),
    price: z.number(),
    duration: z.number(),
  })).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const staffId = searchParams.get("staffId")
  const status = searchParams.get("status")
  const approvalStatus = searchParams.get("approvalStatus")

  const where: Record<string, unknown> = {}

  if (startDate && endDate) {
    where.startTime = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    }
  }

  if (staffId) {
    where.staffId = staffId
  }

  if (status) {
    where.status = status
  }

  if (approvalStatus) {
    where.approvalStatus = approvalStatus
  }

  // Customers can only see their own appointments
  if (session.user.role === "CUSTOMER") {
    where.customerId = session.user.id
  }

  // Agencies can only see their own appointments
  if (session.user.role === "AGENCY") {
    const agency = await prisma.agency.findUnique({
      where: { userId: session.user.id },
    })
    if (agency) {
      where.agencyId = agency.id
    }
    // Acentalar approvalStatus parametresi belirtilmediyse sadece onaylanmış rezervasyonları görür
    if (!approvalStatus) {
      where.approvalStatus = "APPROVED"
    }
  } else {
    // Admin ve diğer kullanıcılar için: approvalStatus belirtilmemişse sadece onaylanmış rezervasyonları göster
    if (!approvalStatus) {
      where.approvalStatus = "APPROVED"
    }
  }

  const appointments = await prisma.appointment.findMany({
    where,
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
      agency: {
        select: {
          id: true,
          companyName: true,
          address: true,
          user: {
            select: { name: true, email: true, phone: true }
          }
        },
      },
      hotel: {
        include: {
          region: { select: { name: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  })

  return NextResponse.json(appointments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = appointmentSchema.parse(body)

    // Get service duration - toplam süreyi sepetten hesapla
    let totalDuration = 0
    let servicesToSave = []

    if (validatedData.services && validatedData.services.length > 0) {
      // Sepet sistemi - birden fazla hizmet
      totalDuration = validatedData.services.reduce((sum, s) => sum + s.duration, 0)
      servicesToSave = validatedData.services
    } else {
      // Eski sistem - tek hizmet
      const service = await prisma.service.findUnique({
        where: { id: validatedData.serviceId },
      })

      if (!service) {
        return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 404 })
      }

      totalDuration = service.duration
      servicesToSave = [{
        id: service.id,
        price: service.price,
        duration: service.duration,
      }]
    }

    const endTime = new Date(validatedData.startTime)
    endTime.setMinutes(endTime.getMinutes() + totalDuration)

    // Skip conflict check if no staffId
    if (validatedData.staffId) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          staffId: validatedData.staffId,
          status: { not: "CANCELLED" },
          OR: [
            {
              startTime: { lte: validatedData.startTime },
              endTime: { gt: validatedData.startTime },
            },
            {
              startTime: { lt: endTime },
              endTime: { gte: endTime },
            },
            {
              startTime: { gte: validatedData.startTime },
              endTime: { lte: endTime },
            },
          ],
        },
      })

      if (conflict) {
        return NextResponse.json(
          { error: "Bu zaman diliminde başka bir randevu var" },
          { status: 400 }
        )
      }
    }

    // Get agency ID if user is an agency or admin selected an agency
    let agencyId = validatedData.agencyId || null
    if (session.user.role === "AGENCY" && !agencyId) {
      const agency = await prisma.agency.findUnique({
        where: { userId: session.user.id },
      })
      agencyId = agency?.id || null
    }

    // Acenta rezervasyonları onay bekler, diğerleri otomatik onaylanır
    const approvalStatus = agencyId ? "PENDING_APPROVAL" : "APPROVED"

    const appointment = await prisma.appointment.create({
      data: {
        customerId: validatedData.customerId || undefined,
        staffId: validatedData.staffId || undefined,
        serviceId: validatedData.serviceId,
        startTime: validatedData.startTime,
        endTime,
        notes: validatedData.notes || undefined,
        agencyId: agencyId || undefined,
        hotelId: validatedData.hotelId || undefined,
        pax: validatedData.pax || undefined,
        customerName: validatedData.customerName || undefined,
        customerPhone: validatedData.customerPhone || undefined,
        status: session.user.role === "CUSTOMER" ? "PENDING" : "CONFIRMED",
        approvalStatus,
      },
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
        hotel: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    })

    // Sepetteki tüm hizmetleri AppointmentService tablosuna kaydet
    if (servicesToSave.length > 0) {
      await prisma.appointmentService.createMany({
        data: servicesToSave.map(s => ({
          appointmentId: appointment.id,
          serviceId: s.id,
          price: s.price,
          duration: s.duration,
        })),
      })
    }

    // Auto-create transfer record for appointments with hotel
    if (validatedData.hotelId && approvalStatus === "APPROVED") {
      await prisma.transfer.create({
        data: {
          appointmentId: appointment.id,
        },
      })
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error("Appointment creation error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    // Return actual error message for debugging
    const errorMessage = error instanceof Error ? error.message : "Randevu oluşturulamadı"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
