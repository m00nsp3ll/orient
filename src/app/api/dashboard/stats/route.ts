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

  const [todayAppointments, pendingAppointments, completedToday, totalPax] =
    await Promise.all([
      prisma.appointment.count({
        where: {
          startTime: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
          approvalStatus: "APPROVED",
        },
      }),
      prisma.appointment.count({
        where: { approvalStatus: "PENDING_APPROVAL" },
      }),
      prisma.appointment.count({
        where: {
          startTime: { gte: dayStart, lte: dayEnd },
          status: "COMPLETED",
        },
      }),
      prisma.appointment.aggregate({
        where: {
          startTime: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
          approvalStatus: "APPROVED",
        },
        _sum: {
          pax: true,
          childCount: true,
        },
      }),
    ])

  return NextResponse.json({
    todayAppointments,
    pendingAppointments,
    completedToday,
    totalPax: totalPax._sum.pax || 0,
    totalChildCount: totalPax._sum.childCount || 0,
  })
}
