import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period") || "month" // day, week, month, custom
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const agencyId = searchParams.get("agencyId")
  const serviceId = searchParams.get("serviceId")

  try {
    // Tarih aralığını belirle
    let start: Date
    let end: Date

    if (period === "custom" && startDate && endDate) {
      start = startOfDay(new Date(startDate))
      end = endOfDay(new Date(endDate))
    } else if (period === "single" && startDate) {
      // Tek gün seçimi için
      start = startOfDay(new Date(startDate))
      end = endOfDay(new Date(startDate))
    } else if (period === "day") {
      start = startOfDay(new Date())
      end = endOfDay(new Date())
    } else if (period === "week") {
      start = startOfWeek(new Date(), { weekStartsOn: 1 })
      end = endOfWeek(new Date(), { weekStartsOn: 1 })
    } else if (period === "year") {
      start = new Date(new Date().getFullYear(), 0, 1) // 1 Ocak
      end = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59) // 31 Aralık
    } else {
      // month (default)
      start = startOfMonth(new Date())
      end = endOfMonth(new Date())
    }

    // Base query filters
    const whereClause: any = {
      startTime: {
        gte: start,
        lte: end,
      },
      status: {
        not: "CANCELLED",
      },
    }

    if (agencyId) {
      whereClause.agencyId = agencyId
    }

    if (serviceId) {
      whereClause.serviceId = serviceId
    }

    // Toplam randevu sayısı ve gelir
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        service: true,
        agency: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    })

    // Toplam istatistikler
    const totalAppointments = appointments.length
    const totalRevenue = appointments.reduce((sum, apt) => {
      // Sepetteki hizmetlerin toplam fiyatı
      const servicesTotal = apt.services.reduce((s: number, item: any) => s + item.price, 0)
      return sum + servicesTotal
    }, 0)

    const totalPax = appointments.reduce((sum, apt) => sum + (apt.pax || 1), 0)

    // Acenta bazlı istatistikler
    const agencyStats = appointments.reduce((acc: any[], apt) => {
      if (!apt.agency) {
        // Manuel giriş
        const manualIndex = acc.findIndex(a => a.id === "manual")
        const revenue = apt.services.reduce((s: number, item: any) => s + item.price, 0)

        if (manualIndex >= 0) {
          acc[manualIndex].count += 1
          acc[manualIndex].revenue += revenue
          acc[manualIndex].pax += apt.pax || 1
        } else {
          acc.push({
            id: "manual",
            name: "Manuel Giriş",
            count: 1,
            revenue: revenue,
            pax: apt.pax || 1,
          })
        }
      } else {
        const index = acc.findIndex(a => a.id === apt.agency!.id)
        const revenue = apt.services.reduce((s: number, item: any) => s + item.price, 0)

        if (index >= 0) {
          acc[index].count += 1
          acc[index].revenue += revenue
          acc[index].pax += apt.pax || 1
        } else {
          acc.push({
            id: apt.agency.id,
            name: apt.agency.name || apt.agency.companyName || "Bilinmeyen Acenta",
            count: 1,
            revenue: revenue,
            pax: apt.pax || 1,
          })
        }
      }
      return acc
    }, [])

    // Program bazlı istatistikler
    const serviceStats = appointments.reduce((acc: any[], apt) => {
      apt.services.forEach((item: any) => {
        const index = acc.findIndex(s => s.id === item.serviceId)

        if (index >= 0) {
          acc[index].count += 1
          acc[index].revenue += item.price
        } else {
          acc.push({
            id: item.serviceId,
            name: item.service.name,
            count: 1,
            revenue: item.price,
            duration: item.duration,
          })
        }
      })
      return acc
    }, [])

    // Günlük trend (son 30 gün veya seçilen aralık)
    const dailyStats: any[] = []
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    for (let i = 0; i <= Math.min(daysDiff, 90); i++) {
      const day = subDays(end, i)
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)

      const dayAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.startTime)
        return aptDate >= dayStart && aptDate <= dayEnd
      })

      const dayRevenue = dayAppointments.reduce((sum, apt) => {
        return sum + apt.services.reduce((s: number, item: any) => s + item.price, 0)
      }, 0)

      dailyStats.unshift({
        date: day.toISOString().split('T')[0],
        count: dayAppointments.length,
        revenue: dayRevenue,
        pax: dayAppointments.reduce((sum, apt) => sum + (apt.pax || 1), 0),
      })
    }

    return NextResponse.json({
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      summary: {
        totalAppointments,
        totalRevenue,
        totalPax,
        averagePerAppointment: totalAppointments > 0 ? totalRevenue / totalAppointments : 0,
      },
      byAgency: agencyStats.sort((a, b) => b.revenue - a.revenue),
      byService: serviceStats.sort((a, b) => b.count - a.count),
      dailyTrend: dailyStats,
    })
  } catch (error) {
    console.error("Statistics fetch error:", error)
    return NextResponse.json(
      { error: "İstatistikler alınamadı" },
      { status: 500 }
    )
  }
}
