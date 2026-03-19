import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { subDays, addDays, addHours, setHours, setMinutes, startOfDay } from "date-fns"

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    // Mevcut demo randevuları sil
    const demoAppointments = await prisma.appointment.findMany({
      where: { notes: { contains: "[DEMO]" } },
      select: { id: true }
    })

    if (demoAppointments.length > 0) {
      const demoIds = demoAppointments.map(a => a.id)
      await prisma.agencyTransaction.deleteMany({
        where: { appointmentId: { in: demoIds } }
      })
      await prisma.$executeRaw`DELETE FROM "AppointmentService" WHERE "appointmentId" IN (SELECT id FROM "Appointment" WHERE notes LIKE '%[DEMO]%')`
      await prisma.appointment.deleteMany({
        where: { notes: { contains: "[DEMO]" } }
      })
    }

    // Eski demo kasa girişlerini sil
    await prisma.cashEntry.deleteMany({
      where: { description: { contains: "[DEMO]" } }
    })

    // Servisleri al
    const services = await prisma.service.findMany({ where: { isActive: true } })
    if (services.length === 0) {
      return NextResponse.json({ error: "Önce hizmetler oluşturulmalı" }, { status: 400 })
    }

    // Acentaları al (pass fiyatlarıyla birlikte)
    const agencies = await prisma.agency.findMany({
      where: { isActive: true },
      include: {
        allowedServices: true,
      },
    })

    // Otelleri al — her aktif bölgeden en az birkaç otel
    const activeRegions = await prisma.region.findMany({ where: { isActive: true } })
    const hotels: any[] = []
    for (const region of activeRegions) {
      const regionHotels = await prisma.hotel.findMany({
        where: { isActive: true, regionId: region.id },
        take: 5,
      })
      hotels.push(...regionHotels)
    }

    // Personelleri al (kasa demo için)
    const staffMembers = await prisma.staff.findMany({
      where: { isActive: true },
      include: { user: true },
    })

    // Müşteri isimleri (uluslararası)
    const customerNames = [
      "Hans Müller", "Anna Schmidt", "Peter Weber", "Maria Fischer", "Thomas Braun",
      "Elena Petrov", "Alexander Ivanov", "Olga Smirnova", "Dmitry Volkov", "Natasha Kozlova",
      "John Smith", "Emma Wilson", "Michael Brown", "Sophie Johnson", "David Taylor",
      "Ahmet Yılmaz", "Fatma Kaya", "Mehmet Demir", "Ayşe Çelik", "Mustafa Öztürk",
      "Pierre Dubois", "Marie Laurent", "Jean Bernard", "Isabelle Martin", "François Petit",
      "Lars Johansson", "Ingrid Andersson", "Erik Lindgren", "Astrid Eriksson", "Olaf Svensson"
    ]

    const appointments: any[] = []
    const today = new Date()

    // GEÇMİŞ: Son 30 gün
    for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
      const date = subDays(today, dayOffset)
      const dayOfWeek = date.getDay()
      const appointmentsPerDay = dayOfWeek === 0 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 8) + 4

      for (let i = 0; i < appointmentsPerDay; i++) {
        const hour = Math.floor(Math.random() * 9) + 9
        const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
        const startTime = setMinutes(setHours(date, hour), minute)
        const selectedServices = [...services].sort(() => Math.random() - 0.5).slice(0, 1)
        const endTime = addHours(startTime, 1)

        const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
        const isManual = Math.random() < 0.2
        const agency = isManual ? null : agencies[Math.floor(Math.random() * agencies.length)]
        const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
        const roomNumber = `${Math.floor(Math.random() * 500) + 100}`

        appointments.push({
          serviceId: selectedServices[0].id,
          agencyId: agency?.id || null,
          hotelId: hotel?.id || null,
          pax,
          customerName,
          roomNumber,
          startTime,
          endTime,
          status: "COMPLETED",
          approvalStatus: "APPROVED",
          notes: isManual ? "[DEMO] Manuel rezervasyon" : `[DEMO] ${agency?.name || ""}`,
          selectedServices
        })
      }
    }

    // BUGÜN: 8-12 randevu
    const todayAppointments = Math.floor(Math.random() * 5) + 8
    for (let i = 0; i < todayAppointments; i++) {
      const hour = Math.floor(Math.random() * 9) + 9
      const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
      const startTime = setMinutes(setHours(today, hour), minute)
      const selectedServices = [...services].sort(() => Math.random() - 0.5).slice(0, 1)
      const endTime = addHours(startTime, 1)

      const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
      const isManual = Math.random() < 0.15
      const agency = isManual ? null : agencies[Math.floor(Math.random() * agencies.length)]
      const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
      const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
      const roomNumber = `${Math.floor(Math.random() * 500) + 100}`

      const now = new Date()
      const status = startTime < now
        ? "COMPLETED"
        : Math.random() < 0.85 ? "CONFIRMED" : "PENDING"

      appointments.push({
        serviceId: selectedServices[0].id,
        agencyId: agency?.id || null,
        hotelId: hotel?.id || null,
        pax,
        customerName,
        roomNumber,
        startTime,
        endTime,
        status,
        approvalStatus: "APPROVED",
        notes: isManual ? "[DEMO] Manuel rezervasyon" : `[DEMO] ${agency?.name || ""}`,
        selectedServices
      })
    }

    // GELECEK: Önümüzdeki 14 gün
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const date = addDays(today, dayOffset)
      const dayOfWeek = date.getDay()
      const appointmentsPerDay = dayOfWeek === 0 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 6) + 3

      for (let i = 0; i < appointmentsPerDay; i++) {
        const hour = Math.floor(Math.random() * 9) + 9
        const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
        const startTime = setMinutes(setHours(date, hour), minute)
        const selectedServices = [...services].sort(() => Math.random() - 0.5).slice(0, 1)
        const endTime = addHours(startTime, 1)

        const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
        const isManual = Math.random() < 0.15
        const agency = isManual ? null : agencies[Math.floor(Math.random() * agencies.length)]
        const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
        const roomNumber = `${Math.floor(Math.random() * 500) + 100}`
        const status = Math.random() < 0.9 ? "CONFIRMED" : "PENDING"

        appointments.push({
          serviceId: selectedServices[0].id,
          agencyId: agency?.id || null,
          hotelId: hotel?.id || null,
          pax,
          customerName,
          roomNumber,
          startTime,
          endTime,
          status,
          approvalStatus: "APPROVED",
          notes: isManual ? "[DEMO] Manuel rezervasyon" : `[DEMO] ${agency?.name || ""}`,
          selectedServices
        })
      }
    }

    // PENDING_APPROVAL: Sunway acentasından onay bekleyen rezervasyonlar
    const sunwayAgency = agencies.find(a => a.name === "Sunway Travel" || a.code === "SWT001")
    if (sunwayAgency) {
      const pendingCustomers = [
        { name: "Klaus Wagner", pax: 2, hour: 10, minute: 0 },
        { name: "Sarah Thompson", pax: 3, hour: 11, minute: 30 },
        { name: "Marco Rossi", pax: 1, hour: 14, minute: 0 },
        { name: "Yuki Tanaka", pax: 4, hour: 15, minute: 30 },
      ]

      for (const cust of pendingCustomers) {
        const date = addDays(today, Math.floor(Math.random() * 3) + 1)
        const startTime = setMinutes(setHours(date, cust.hour), cust.minute)
        const service = services[Math.floor(Math.random() * services.length)]
        const endTime = addHours(startTime, 1)
        const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null

        appointments.push({
          serviceId: service.id,
          agencyId: sunwayAgency.id,
          hotelId: hotel?.id || null,
          pax: cust.pax,
          customerName: cust.name,
          roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
          startTime,
          endTime,
          status: "PENDING",
          approvalStatus: "PENDING_APPROVAL",
          notes: `[DEMO] ${sunwayAgency.name}`,
          selectedServices: [service],
        })
      }
    }

    // =============================================
    // RANDEVULARI OLUŞTUR
    // =============================================
    let createdCount = 0
    let appointmentErrors = 0

    for (const apt of appointments) {
      try {
        const { selectedServices, ...rest } = apt

        const agency = apt.agencyId ? agencies.find(a => a.id === apt.agencyId) : null
        const getPassPrice = (serviceId: string) => {
          if (!agency) return null
          const agencyService = agency.allowedServices.find((as: any) => as.serviceId === serviceId)
          return agencyService?.passPrice ?? null
        }

        // %25 ihtimalle REST ödeme
        const isRest = !!(agency && Math.random() < 0.25)
        const restCurrencies = ["TRY", "EUR", "USD", "GBP"]
        const restCurrency = isRest ? restCurrencies[Math.floor(Math.random() * restCurrencies.length)] : undefined
        const restAmount = isRest
          ? (restCurrency === "TRY"
            ? Math.floor(Math.random() * 3000) + 500
            : Math.floor(Math.random() * 150) + 20)
          : undefined

        createdCount++
        const voucherNo = `V-${String(createdCount).padStart(4, "0")}`

        const appointment = await prisma.appointment.create({
          data: {
            customerName: rest.customerName,
            roomNumber: rest.roomNumber,
            serviceId: rest.serviceId,
            hotelId: rest.hotelId,
            agencyId: rest.agencyId,
            startTime: rest.startTime,
            endTime: rest.endTime,
            pax: rest.pax,
            status: rest.status,
            approvalStatus: rest.approvalStatus,
            notes: rest.notes,
            restAmount: restAmount ?? null,
            restCurrency: restCurrency ?? null,
            voucherNo,
            services: {
              create: selectedServices.map((s: any) => {
                const passPrice = getPassPrice(s.id)
                return {
                  serviceId: s.id,
                  price: passPrice ?? s.price,
                }
              })
            }
          }
        })

        // Acenta cari kaydı oluştur
        if (agency) {
          const totalPassPrice = selectedServices.reduce((sum: number, s: any) => {
            const passPrice = getPassPrice(s.id)
            return sum + (passPrice ?? s.price)
          }, 0)

          await prisma.agencyTransaction.create({
            data: {
              agencyId: agency.id,
              appointmentId: appointment.id,
              type: "DEBIT",
              amount: totalPassPrice,
              currency: agency.currency || "EUR",
              description: `[DEMO] Rezervasyon - ${apt.customerName}`,
            },
          })

          if (isRest && restAmount && restCurrency) {
            await prisma.agencyTransaction.create({
              data: {
                agencyId: agency.id,
                appointmentId: appointment.id,
                type: "CREDIT",
                amount: restAmount,
                currency: restCurrency,
                description: `[DEMO] REST - ${apt.customerName} (${restCurrency})`,
              },
            })
          }
        }
      } catch (aptError) {
        appointmentErrors++
        console.error("Demo appointment create error:", aptError)
      }
    }

    // =============================================
    // KASA DEMO DATA (randevu hatalarından bağımsız)
    // =============================================
    const expenseDescriptions = [
      "Temizlik malzemesi", "Su faturası", "Elektrik faturası", "Personel yemek",
      "Kırtasiye", "Çay/kahve", "Havlu yıkama", "Araç yakıt", "Tamir bakım",
      "Ofis gideri", "İnternet faturası", "Market alışverişi"
    ]
    const creditDescriptions = [
      "Kredi kartı terminali", "Pos cihazı ödemesi", "Banka kredi taksiti"
    ]
    const receptionDescriptions = [
      "Walk-in müşteri", "Resepsiyon satış", "Direkt müşteri", "Online rezervasyon"
    ]
    const serviceNames = services.map(s => s.name)

    let kasaCount = 0

    // Son 7 gün için kasa girişleri (sunum için zengin veri)
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const kasaDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset)

      let voucherNo = 1

      // Acenta gelirleri (3-8 adet/gün)
      const agencyIncomeCount = Math.floor(Math.random() * 6) + 3
      for (let i = 0; i < agencyIncomeCount; i++) {
        if (agencies.length === 0) break
        const agency = agencies[Math.floor(Math.random() * agencies.length)]
        const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
        const cur = agency.currency || "EUR"
        const paxCount = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
        const basePrice = cur === "GBP" ? (Math.floor(Math.random() * 120) + 40)
          : cur === "USD" ? (Math.floor(Math.random() * 150) + 50)
          : (Math.floor(Math.random() * 130) + 45)

        await prisma.cashEntry.create({
          data: {
            date: kasaDate,
            voucherNo: voucherNo++,
            agencyId: agency.id,
            hotelId: hotel?.id || null,
            roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
            serviceName: serviceNames[Math.floor(Math.random() * serviceNames.length)] || "Paket",
            pax: paxCount,
            agencyIncomeAmount: basePrice * paxCount,
            agencyIncomeCurrency: cur,
            description: `[DEMO] ${agency.name} geliri`,
            createdBy: session.user.id,
          },
        })
        kasaCount++
      }

      // Resepsiyon gelirleri (1-3 adet/gün)
      const receptionCount = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < receptionCount; i++) {
        const cur = ["EUR", "TRY", "USD", "GBP"][Math.floor(Math.random() * 4)]
        const amount = cur === "TRY" ? (Math.floor(Math.random() * 2000) + 500)
          : cur === "GBP" ? (Math.floor(Math.random() * 80) + 25)
          : (Math.floor(Math.random() * 100) + 30)

        await prisma.cashEntry.create({
          data: {
            date: kasaDate,
            voucherNo: voucherNo++,
            receptionIncomeAmount: amount,
            receptionIncomeCurrency: cur,
            description: `[DEMO] ${receptionDescriptions[Math.floor(Math.random() * receptionDescriptions.length)]}`,
            createdBy: session.user.id,
          },
        })
        kasaCount++
      }

      // Giderler (2-4 adet/gün)
      const expCount = Math.floor(Math.random() * 3) + 2
      for (let i = 0; i < expCount; i++) {
        const isEurExpense = Math.random() < 0.15
        const cur = isEurExpense ? "EUR" : "TRY"
        const amount = isEurExpense
          ? Math.floor(Math.random() * 50) + 10
          : Math.floor(Math.random() * 800) + 50

        await prisma.cashEntry.create({
          data: {
            date: kasaDate,
            voucherNo: voucherNo++,
            expenseAmount: amount,
            expenseCurrency: cur,
            description: `[DEMO] ${expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)]}`,
            createdBy: session.user.id,
          },
        })
        kasaCount++
      }

      // Kredi kartı geliri (1-3 adet/gün)
      const ccCount = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < ccCount; i++) {
        const cur = ["TRY", "EUR", "USD", "GBP"][Math.floor(Math.random() * 4)]
        const amount = cur === "TRY" ? (Math.floor(Math.random() * 5000) + 1000)
          : cur === "GBP" ? (Math.floor(Math.random() * 200) + 50)
          : (Math.floor(Math.random() * 300) + 80)

        await prisma.cashEntry.create({
          data: {
            date: kasaDate,
            voucherNo: voucherNo++,
            creditCardAmount: amount,
            creditCardCurrency: cur,
            description: `[DEMO] Kredi kartı ödemesi (${cur})`,
            createdBy: session.user.id,
          },
        })
        kasaCount++
      }

      // Personel satışları (2-4 adet/gün) — prim hesaplaması için
      if (staffMembers.length > 0) {
        const staffIncomeCount = Math.floor(Math.random() * 3) + 2
        for (let i = 0; i < staffIncomeCount; i++) {
          const staff = staffMembers[Math.floor(Math.random() * staffMembers.length)]
          const cur = ["EUR", "USD", "GBP", "TRY"][Math.floor(Math.random() * 4)]
          const amount = cur === "TRY" ? (Math.floor(Math.random() * 3000) + 500)
            : cur === "GBP" ? (Math.floor(Math.random() * 100) + 30)
            : (Math.floor(Math.random() * 120) + 40)

          await prisma.cashEntry.create({
            data: {
              date: kasaDate,
              voucherNo: voucherNo++,
              staffId: staff.id,
              staffIncomeAmount: amount,
              staffIncomeCurrency: cur,
              description: `[DEMO] ${staff.user.name} satışı`,
              createdBy: session.user.id,
            },
          })
          kasaCount++
        }
      }

      // Kredi/borç ödemesi (0-1 adet/gün)
      if (Math.random() < 0.4) {
        const amount = Math.floor(Math.random() * 1500) + 500

        await prisma.cashEntry.create({
          data: {
            date: kasaDate,
            voucherNo: voucherNo++,
            creditAmount: amount,
            creditCurrency: "TRY",
            description: `[DEMO] ${creditDescriptions[Math.floor(Math.random() * creditDescriptions.length)]}`,
            createdBy: session.user.id,
          },
        })
        kasaCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${createdCount} demo randevu ve ${kasaCount} kasa girişi oluşturuldu`,
      details: {
        totalAppointments: createdCount,
        appointmentErrors,
        totalCashEntries: kasaCount,
        dateRange: "Son 30 gün + Bugün + Önümüzdeki 14 gün",
        kasaRange: "Son 7 gün",
        agencies: agencies.map(a => a.name),
        services: services.map(s => s.name)
      }
    })

  } catch (error) {
    console.error("Demo data error:", error)
    return NextResponse.json(
      { error: "Demo veriler oluşturulamadı", details: String(error) },
      { status: 500 }
    )
  }
}
