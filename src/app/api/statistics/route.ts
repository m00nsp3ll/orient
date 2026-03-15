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
        hotel: { select: { name: true, region: { select: { name: true } } } },
        services: {
          include: {
            service: true,
          },
        },
      },
    })

    // Toplam istatistikler
    const totalAppointments = appointments.length
    const totalPax = appointments.reduce((sum, apt) => sum + (apt.pax || 1), 0)

    // Para birimi bazlı toplam gelir
    const revenueByCurrency: Record<string, number> = {}
    appointments.forEach(apt => {
      const currency = apt.agency?.currency || "EUR"
      const servicesTotal = apt.services.reduce((s: number, item: any) => s + item.price, 0)
      revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + servicesTotal
    })

    // Acenta bazlı istatistikler
    const agencyStats = appointments.reduce((acc: any[], apt) => {
      if (!apt.agency) {
        // Manuel giriş — base service currency
        const manualIndex = acc.findIndex(a => a.id === "manual")
        const revenue = apt.services.reduce((s: number, item: any) => s + item.price, 0)
        const currency = apt.service?.currency || "EUR"

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
            currency,
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
            currency: apt.agency.currency || "EUR",
          })
        }
      }
      return acc
    }, [])

    // Program bazlı istatistikler (currency bazlı)
    const serviceStats = appointments.reduce((acc: any[], apt) => {
      const currency = apt.agency?.currency || apt.service?.currency || "EUR"
      apt.services.forEach((item: any) => {
        const key = `${item.serviceId}_${currency}`
        const index = acc.findIndex(s => s.key === key)

        if (index >= 0) {
          acc[index].count += 1
          acc[index].revenue += item.price
        } else {
          acc.push({
            key,
            id: item.serviceId,
            name: item.service.name,
            count: 1,
            revenue: item.price,
            currency,
          })
        }
      })
      return acc
    }, [])

    // Günlük trend (para birimi bazlı)
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

      const dayRevenueByCurrency: Record<string, number> = {}
      dayAppointments.forEach(apt => {
        const currency = apt.agency?.currency || "EUR"
        const total = apt.services.reduce((s: number, item: any) => s + item.price, 0)
        dayRevenueByCurrency[currency] = (dayRevenueByCurrency[currency] || 0) + total
      })

      dailyStats.unshift({
        date: day.toISOString().split('T')[0],
        count: dayAppointments.length,
        revenueByCurrency: dayRevenueByCurrency,
        pax: dayAppointments.reduce((sum, apt) => sum + (apt.pax || 1), 0),
      })
    }

    // Kasa verileri (günlük gelir/gider)
    const cashEntries = await prisma.cashEntry.findMany({
      where: {
        date: { gte: start, lte: end },
      },
    })

    const kasaByCurrency: Record<string, { income: number; expense: number; creditCard: number }> = {}
    for (const entry of cashEntries) {
      if (entry.agencyIncomeAmount && entry.agencyIncomeCurrency) {
        const cur = entry.agencyIncomeCurrency
        if (!kasaByCurrency[cur]) kasaByCurrency[cur] = { income: 0, expense: 0, creditCard: 0 }
        kasaByCurrency[cur].income += entry.agencyIncomeAmount
      }
      if (entry.receptionIncomeAmount && entry.receptionIncomeCurrency) {
        const cur = entry.receptionIncomeCurrency
        if (!kasaByCurrency[cur]) kasaByCurrency[cur] = { income: 0, expense: 0, creditCard: 0 }
        kasaByCurrency[cur].income += entry.receptionIncomeAmount
      }
      if (entry.expenseAmount && entry.expenseCurrency) {
        const cur = entry.expenseCurrency
        if (!kasaByCurrency[cur]) kasaByCurrency[cur] = { income: 0, expense: 0, creditCard: 0 }
        kasaByCurrency[cur].expense += entry.expenseAmount
      }
      if (entry.creditAmount && entry.creditCurrency) {
        const cur = entry.creditCurrency
        if (!kasaByCurrency[cur]) kasaByCurrency[cur] = { income: 0, expense: 0, creditCard: 0 }
        kasaByCurrency[cur].expense += entry.creditAmount
      }
      if (entry.creditCardAmount && entry.creditCardCurrency) {
        const cur = entry.creditCardCurrency
        if (!kasaByCurrency[cur]) kasaByCurrency[cur] = { income: 0, expense: 0, creditCard: 0 }
        kasaByCurrency[cur].creditCard += entry.creditCardAmount
      }
    }

    // Günlük kasa trendi
    const kasaDailyTrend: any[] = []
    for (let i = 0; i <= Math.min(daysDiff, 90); i++) {
      const day = subDays(end, i)
      const dayKey = day.toISOString().split("T")[0]
      const dayEntries = cashEntries.filter(e => e.date.toISOString().split("T")[0] === dayKey)
      if (dayEntries.length === 0) continue

      let income = 0, expense = 0, creditCard = 0
      for (const e of dayEntries) {
        if (e.agencyIncomeAmount) income += e.agencyIncomeAmount
        if (e.receptionIncomeAmount) income += e.receptionIncomeAmount
        if (e.expenseAmount) expense += e.expenseAmount
        if (e.creditAmount) expense += e.creditAmount
        if (e.creditCardAmount) creditCard += e.creditCardAmount
      }
      kasaDailyTrend.unshift({ date: dayKey, income, expense, creditCard, net: income + creditCard - expense, count: dayEntries.length })
    }

    return NextResponse.json({
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      summary: {
        totalAppointments,
        revenueByCurrency,
        totalPax,
      },
      byAgency: agencyStats.sort((a, b) => b.revenue - a.revenue),
      byService: serviceStats.sort((a, b) => b.count - a.count),
      dailyTrend: dailyStats,
      customers: appointments.map(a => ({
        id: a.id,
        agencyName: a.agency?.companyName || a.agency?.name || "-",
        customerName: a.customerName || "-",
        pax: a.pax || 0,
        childCount: a.childCount || 0,
        time: a.startTime,
        voucherNo: a.voucherNo || "-",
        hotelName: a.hotel?.name || "-",
        serviceName: a.service?.name || "-",
        status: a.status,
        notes: a.notes,
        restAmount: a.restAmount,
        restCurrency: a.restCurrency,
        price: a.services.reduce((s: number, item: any) => s + item.price, 0),
        currency: a.service?.currency || "EUR",
      })),
      kasa: {
        byCurrency: kasaByCurrency,
        dailyTrend: kasaDailyTrend,
      },
    })
  } catch (error) {
    console.error("Statistics fetch error:", error)
    return NextResponse.json(
      { error: "İstatistikler alınamadı" },
      { status: 500 }
    )
  }
}
