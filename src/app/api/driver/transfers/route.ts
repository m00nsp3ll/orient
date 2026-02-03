import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"
import { startOfDay, endOfDay, parseISO } from "date-fns"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"

// Token doğrulama helper
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

export async function GET(req: NextRequest) {
  try {
    const auth = verifyToken(req)
    if (!auth || auth.role !== "DRIVER") {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get("date")

    let dateFilter = {}
    if (dateParam) {
      const date = parseISO(dateParam)
      dateFilter = {
        appointment: {
          startTime: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
      }
    }

    const transfers = await prisma.transfer.findMany({
      where: {
        driverId: auth.driverId,
        ...dateFilter,
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
      orderBy: {
        appointment: {
          startTime: "asc",
        },
      },
    })

    return NextResponse.json(transfers)
  } catch (error) {
    console.error("Driver transfers error:", error)
    return NextResponse.json(
      { message: "Transferler alınırken hata oluştu" },
      { status: 500 }
    )
  }
}
