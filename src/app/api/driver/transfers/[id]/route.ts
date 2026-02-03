import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"

function verifyToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      driverId: string
      role: string
    }
    return decoded
  } catch {
    return null
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyToken(req)
    if (!auth || auth.role !== "DRIVER") {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { id } = await params
    const { status } = await req.json()

    // Transfer'in bu şoföre ait olduğunu kontrol et
    const transfer = await prisma.transfer.findUnique({
      where: { id },
    })

    if (!transfer) {
      return NextResponse.json({ message: "Transfer bulunamadı" }, { status: 404 })
    }

    if (transfer.driverId !== auth.driverId) {
      return NextResponse.json({ message: "Bu transfer size ait değil" }, { status: 403 })
    }

    // Zaman damgalarını güncelle
    const now = new Date()
    const timestamps: Record<string, Date> = {}

    if (status === "PICKING_UP" && !transfer.pickupTime) {
      timestamps.pickupTime = now
    } else if (status === "AT_SPA" && !transfer.arrivalTime) {
      timestamps.arrivalTime = now
    } else if (status === "DROPPING_OFF" && !transfer.departureTime) {
      timestamps.departureTime = now
    } else if (status === "COMPLETED" && !transfer.dropoffTime) {
      timestamps.dropoffTime = now
    }

    const updatedTransfer = await prisma.transfer.update({
      where: { id },
      data: {
        status,
        ...timestamps,
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
      },
    })

    return NextResponse.json(updatedTransfer)
  } catch (error) {
    console.error("Driver transfer update error:", error)
    return NextResponse.json(
      { message: "Transfer güncellenirken hata oluştu" },
      { status: 500 }
    )
  }
}
