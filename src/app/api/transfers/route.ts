import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const transferSchema = z.object({
  appointmentId: z.string(),
  driverId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  if (!["ADMIN", "STAFF", "DRIVER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const status = searchParams.get("status")
  const driverId = searchParams.get("driverId")

  const where: Record<string, unknown> = {}

  if (date) {
    const startOfDay = new Date(date + "T00:00:00.000Z")
    const endOfDay = new Date(date + "T23:59:59.999Z")

    where.appointment = {
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    }
  }

  if (status) {
    where.status = status
  }

  if (driverId) {
    where.driverId = driverId
  }

  // Drivers can only see their own transfers
  if (session.user.role === "DRIVER") {
    const driver = await prisma.driver.findUnique({
      where: { userId: session.user.id },
    })
    if (driver) {
      where.driverId = driver.id
    }
  }

  const transfers = await prisma.transfer.findMany({
    where,
    include: {
      appointment: {
        include: {
          service: true,
          hotel: {
            include: {
              region: true,
            },
          },
          agency: {
            select: {
              id: true,
              name: true,
              code: true,
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
    orderBy: {
      appointment: {
        startTime: "asc",
      },
    },
  })

  return NextResponse.json(transfers)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const validatedData = transferSchema.parse(body)

    // Check if transfer already exists for this appointment
    const existingTransfer = await prisma.transfer.findFirst({
      where: { appointmentId: validatedData.appointmentId },
    })

    if (existingTransfer) {
      return NextResponse.json(
        { error: "Bu randevu için transfer zaten mevcut" },
        { status: 400 }
      )
    }

    const transfer = await prisma.transfer.create({
      data: {
        appointmentId: validatedData.appointmentId,
        driverId: validatedData.driverId || undefined,
        notes: validatedData.notes || undefined,
      },
      include: {
        appointment: {
          include: {
            service: true,
            hotel: {
              include: {
                region: true,
              },
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

    return NextResponse.json(transfer)
  } catch (error) {
    console.error("Transfer creation error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Transfer oluşturulamadı" },
      { status: 500 }
    )
  }
}
