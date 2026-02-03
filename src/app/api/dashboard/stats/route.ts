import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay } from "date-fns"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const today = new Date()
  const dayStart = startOfDay(today)
  const dayEnd = endOfDay(today)

  const [todayAppointments, pendingAppointments, completedToday, totalCustomers] =
    await Promise.all([
      prisma.appointment.count({
        where: {
          startTime: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.appointment.count({
        where: { status: "PENDING" },
      }),
      prisma.appointment.count({
        where: {
          startTime: { gte: dayStart, lte: dayEnd },
          status: "COMPLETED",
        },
      }),
      prisma.user.count({
        where: { role: "CUSTOMER" },
      }),
    ])

  return NextResponse.json({
    todayAppointments,
    pendingAppointments,
    completedToday,
    totalCustomers,
  })
}
