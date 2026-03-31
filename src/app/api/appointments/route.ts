import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getSessionTimesForHotel } from "@/lib/region-utils"
import { checkPermission } from "@/lib/permissions"

const appointmentSchema = z.object({
  customerId: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  serviceId: z.string(),
  startTime: z.string().transform((str) => new Date(str)),
  notes: z.string().optional().nullable(),
  isRest: z.boolean().optional(),
  restAmount: z.number().optional(),
  restCurrency: z.string().optional(),
  voucherNo: z.string().optional().nullable(),
  // Agency specific fields
  agencyId: z.string().optional().nullable(),
  hotelId: z.string().optional().nullable(),
  pax: z.number().optional().nullable(),
  childCount: z.number().optional().nullable(),
  customerName: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
  // Sepet sistemi için
  services: z.array(z.object({
    id: z.string(),
    price: z.number(),
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
    if (!agency) {
      return NextResponse.json([])
    }
    where.agencyId = agency.id
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
          name: true,
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
      services: {
        include: {
          service: { select: { id: true, name: true, price: true, currency: true } },
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

  // STAFF kullanıcılar için operasyon_duzenleme yetkisi kontrolü
  if (session.user.role === "STAFF") {
    const hasPermission = await checkPermission(session.user.role, session.user.id, "operasyon_duzenleme")
    if (!hasPermission) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }
  }

  try {
    const body = await req.json()
    const validatedData = appointmentSchema.parse(body)

    // REST validation: restAmount ve restCurrency zorunlu
    if (validatedData.isRest) {
      if (!validatedData.restAmount || validatedData.restAmount <= 0) {
        return NextResponse.json(
          { error: "REST seçildiğinde tutar girilmelidir" },
          { status: 400 }
        )
      }
      if (!validatedData.restCurrency) {
        return NextResponse.json(
          { error: "REST seçildiğinde para birimi seçilmelidir" },
          { status: 400 }
        )
      }
    }

    // Sepete eklenen hizmetleri hazırla
    let servicesToSave = []

    if (validatedData.services && validatedData.services.length > 0) {
      servicesToSave = validatedData.services
    } else {
      const service = await prisma.service.findUnique({
        where: { id: validatedData.serviceId },
      })

      if (!service) {
        return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 404 })
      }

      servicesToSave = [{
        id: service.id,
        price: service.price,
      }]
    }

    // endTime = startTime + 1 saat (sabit, süre artık takip edilmiyor)
    const endTime = new Date(validatedData.startTime)
    endTime.setMinutes(endTime.getMinutes() + 60)

    // Validate session time against region's allowed times
    if (validatedData.hotelId) {
      const allowedTimes = await getSessionTimesForHotel(validatedData.hotelId)
      if (allowedTimes.length > 0) {
        const appointmentHour = validatedData.startTime.getHours().toString().padStart(2, "0")
        const appointmentMin = validatedData.startTime.getMinutes().toString().padStart(2, "0")
        const appointmentTime = `${appointmentHour}:${appointmentMin}`
        if (!allowedTimes.includes(appointmentTime)) {
          return NextResponse.json(
            { error: `Bu bölge için izin verilen saatler: ${allowedTimes.join(", ")}` },
            { status: 400 }
          )
        }
      }
    }

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
        childCount: validatedData.childCount || undefined,
        customerName: validatedData.customerName || undefined,
        roomNumber: validatedData.roomNumber || undefined,
        restAmount: validatedData.isRest ? validatedData.restAmount : undefined,
        restCurrency: validatedData.isRest ? validatedData.restCurrency : undefined,
        voucherNo: validatedData.voucherNo || undefined,
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
