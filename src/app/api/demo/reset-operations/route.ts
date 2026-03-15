import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TransferStatus } from "@prisma/client"

/**
 * Demo operasyon verilerini yükle
 * Bugünkü transferleri ve randevuları siler, demo datayı oluşturur
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  try {
    const { date } = await request.json()

    const targetDate = date ? new Date(date) : new Date()
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // 1. Seçili günün transferlerini sil
    await prisma.transfer.deleteMany({
      where: {
        appointment: {
          startTime: {
            gte: targetDate,
            lt: nextDay,
          },
        },
      },
    })

    // 2. Seçili günün AppointmentService kayıtlarını sil
    const todayApts = await prisma.appointment.findMany({
      where: { startTime: { gte: targetDate, lt: nextDay } },
      select: { id: true },
    })
    if (todayApts.length > 0) {
      await prisma.appointmentService.deleteMany({
        where: { appointmentId: { in: todayApts.map(a => a.id) } },
      })
    }

    // 3. Seçili günün randevularını sil
    await prisma.appointment.deleteMany({
      where: {
        startTime: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    })

    // 4. Eski demo kasa girişlerini sil
    await prisma.cashEntry.deleteMany({
      where: { description: { contains: "[DEMO]" } },
    })

    // 5. Demo acentalar oluştur (varsa kullan)
    const agencyDefs = [
      { name: "Sunway Travel", code: "SWT001", commission: 15 },
      { name: "Blue Sky Tourism", code: "BST002", commission: 20 },
      { name: "Golden Tours", code: "GLT003", commission: 18 },
      { name: "Paradise Holidays", code: "PRH004", commission: 12 },
    ]

    const createdAgencies = []
    for (const agency of agencyDefs) {
      const existing = await prisma.agency.findUnique({
        where: { code: agency.code },
      })

      if (existing) {
        createdAgencies.push(existing)
      } else {
        const created = await prisma.agency.create({
          data: {
            name: agency.name,
            code: agency.code,
            commission: agency.commission,
            contactName: "Demo Contact",
            phone: "+90 555 000 0000",
            email: `info@${agency.code.toLowerCase()}.com`,
            isActive: true,
          },
        })
        createdAgencies.push(created)
      }
    }

    // 6. Hizmetleri al
    const services = await prisma.service.findMany({
      orderBy: { name: "asc" },
    })

    if (services.length === 0) {
      return NextResponse.json(
        { error: "Hizmet bulunamadı! Lütfen önce hizmet ekleyin." },
        { status: 400 }
      )
    }

    // 7. Otelleri al
    const hotels = await prisma.hotel.findMany({
      where: { isActive: true },
      include: { region: true },
      take: 30,
    })

    if (hotels.length === 0) {
      return NextResponse.json(
        { error: "Otel bulunamadı! Lütfen önce otel ekleyin." },
        { status: 400 }
      )
    }

    // Tüm acentaları al (kasa girişleri için)
    const allAgencies = await prisma.agency.findMany({ where: { isActive: true } })

    // Personelleri al (kasa demo için)
    const staffMembers = await prisma.staff.findMany({
      where: { isActive: true },
      include: { user: true },
    })

    // 8. Demo müşteriler
    const demoCustomers = [
      { name: "Ahmet Yılmaz",  phone: "+90 532 111 1111", status: "PENDING",      time: "09:00", pax: 2, service: 0, agency: 0 },
      { name: "Mehmet Demir",  phone: "+90 532 222 2222", status: "PENDING",      time: "09:30", pax: 1, service: 1, agency: 1, rest: true,  restAmount: 150, restCurrency: "EUR" },
      { name: "Ayşe Kaya",    phone: "+90 532 333 3333", status: "PENDING",      time: "10:00", pax: 3, service: 2, agency: 0 },
      { name: "Fatma Şahin",  phone: "+90 532 444 4444", status: "PENDING",      time: "10:30", pax: 2, service: 0, agency: 2 },
      { name: "Ali Çelik",    phone: "+90 532 555 5555", status: "PENDING",      time: "11:00", pax: 4, service: 1, agency: 1 },

      { name: "Zeynep Arslan", phone: "+90 532 666 6666", status: "IN_SERVICE",  time: "08:00", pax: 2, service: 2, agency: 3 },
      { name: "Hasan Yıldız",  phone: "+90 532 777 7777", status: "IN_SERVICE",  time: "08:30", pax: 1, service: 0, agency: 0, rest: true, restAmount: 80, restCurrency: "USD" },

      { name: "Elif Öztürk",   phone: "+90 532 888 8888", status: "IN_SERVICE",  time: "07:30", pax: 2, service: 1, agency: 1 },
      { name: "Mustafa Aydın", phone: "+90 532 999 9999", status: "IN_SERVICE",  time: "07:00", pax: 3, service: 2, agency: 2 },

      { name: "Selin Kara",    phone: "+90 533 111 1111", status: "DROPPING_OFF", time: "06:00", pax: 2, service: 0, agency: 3 },
      { name: "Burak Şen",     phone: "+90 533 222 2222", status: "DROPPING_OFF", time: "06:30", pax: 1, service: 1, agency: 0, rest: true, restAmount: 200, restCurrency: "GBP" },
      { name: "Deniz Taş",     phone: "+90 533 333 3333", status: "DROPPING_OFF", time: "07:00", pax: 4, service: 2, agency: 1 },

      { name: "Cem Yalçın",    phone: "+90 533 444 4444", status: "COMPLETED",   time: "05:00", pax: 2, service: 0, agency: 2 },
      { name: "Özge Polat",    phone: "+90 533 555 5555", status: "COMPLETED",   time: "05:30", pax: 3, service: 1, agency: 3, rest: true, restAmount: 2500, restCurrency: "TRY" },
    ]

    // 9. Randevular ve transferler oluştur
    let count = 0
    for (const customer of demoCustomers) {
      const hotel = hotels[Math.floor(Math.random() * hotels.length)]
      const service = services[customer.service % services.length]
      const agency = createdAgencies[customer.agency % createdAgencies.length]

      const [hours, minutes] = customer.time.split(":").map(Number)
      const startTime = new Date(targetDate)
      startTime.setHours(hours, minutes, 0, 0)

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + 60)

      count++
      const voucherNo = `V-${String(count).padStart(4, "0")}`

      const appointment = await prisma.appointment.create({
        data: {
          customerName: customer.name,
          roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
          serviceId: service.id,
          hotelId: hotel.id,
          agencyId: agency.id,
          startTime,
          endTime,
          pax: customer.pax,
          status: "CONFIRMED",
          approvalStatus: "APPROVED",
          notes: customer.rest ? "REST" : null,
          restAmount: customer.rest ? (customer as any).restAmount : null,
          restCurrency: customer.rest ? (customer as any).restCurrency : null,
          voucherNo,
        },
      })

      // AppointmentService tablosunu doldur
      await prisma.appointmentService.createMany({
        data: Array.from({ length: customer.pax }).map(() => ({
          appointmentId: appointment.id,
          serviceId: service.id,
          price: service.price,
        })),
        skipDuplicates: true,
      })

      await prisma.transfer.create({
        data: {
          appointmentId: appointment.id,
          status: customer.status as TransferStatus,
          arrivalTime: ["IN_SERVICE", "COMPLETED"].includes(customer.status) ? startTime : null,
          dropoffTime: customer.status === "COMPLETED" ? new Date(endTime.getTime() + 30 * 60000) : null,
        },
      })
    }

    // 10. Sunway Travel'dan 5 adet onay bekleyen rezervasyon ekle
    const sunwayAgency = createdAgencies.find(a => a.code === "SWT001")

    if (sunwayAgency) {
      const pendingCustomers = [
        { name: "Emre Kılıç",   phone: "+90 541 111 2233", time: "12:00", pax: 2, service: 0 },
        { name: "Derya Aydın",  phone: "+90 542 222 3344", time: "13:00", pax: 3, service: 1 },
        { name: "Gökhan Şen",   phone: "+90 543 333 4455", time: "14:00", pax: 4, service: 0 },
        { name: "Hülya Koç",    phone: "+90 544 444 5566", time: "15:00", pax: 2, service: 1, rest: true, restAmount: 120, restCurrency: "EUR" },
        { name: "İsmail Yurt",  phone: "+90 545 555 6677", time: "16:00", pax: 5, service: 0 },
      ]

      for (const customer of pendingCustomers) {
        const hotel = hotels[Math.floor(Math.random() * hotels.length)]
        const service = services[customer.service % services.length]

        const [hours, minutes] = customer.time.split(":").map(Number)
        const startTime = new Date(targetDate)
        startTime.setHours(hours, minutes, 0, 0)

        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + 60)

        count++
        const voucherNo = `V-${String(count).padStart(4, "0")}`

        const appointment = await prisma.appointment.create({
          data: {
            customerName: customer.name,
            roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
            serviceId: service.id,
            hotelId: hotel.id,
            agencyId: sunwayAgency.id,
            startTime,
            endTime,
            pax: customer.pax,
            status: "CONFIRMED",
            approvalStatus: "PENDING_APPROVAL",
            notes: (customer as any).rest ? "REST" : null,
            restAmount: (customer as any).rest ? (customer as any).restAmount : null,
            restCurrency: (customer as any).rest ? (customer as any).restCurrency : null,
            voucherNo,
          },
        })

        // AppointmentService tablosunu doldur
        await prisma.appointmentService.createMany({
          data: Array.from({ length: customer.pax }).map(() => ({
            appointmentId: appointment.id,
            serviceId: service.id,
            price: service.price,
          })),
          skipDuplicates: true,
        })
      }
    }

    // =============================================
    // 11. KASA DEMO DATA (son 7 gün)
    // =============================================
    const userId = session?.user?.id || "system"
    const serviceNames = services.map(s => s.name)
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

    let kasaCount = 0
    const agenciesForKasa = allAgencies.length > 0 ? allAgencies : createdAgencies

    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const kasaDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - dayOffset)

      let voucherNo = 1

      // Acenta gelirleri (3-8 adet/gün)
      const agencyIncomeCount = Math.floor(Math.random() * 6) + 3
      for (let i = 0; i < agencyIncomeCount; i++) {
        const agency = agenciesForKasa[Math.floor(Math.random() * agenciesForKasa.length)]
        const hotel = hotels[Math.floor(Math.random() * hotels.length)]
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
            hotelId: hotel.id,
            roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
            serviceName: serviceNames[Math.floor(Math.random() * serviceNames.length)] || "Paket",
            pax: paxCount,
            agencyIncomeAmount: basePrice * paxCount,
            agencyIncomeCurrency: cur,
            description: `[DEMO] ${agency.name} geliri`,
            createdBy: userId,
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
            createdBy: userId,
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
            createdBy: userId,
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
            createdBy: userId,
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
              createdBy: userId,
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
            createdBy: userId,
          },
        })
        kasaCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${count} operasyon + ${kasaCount} kasa girişi oluşturuldu`,
      count,
      kasaCount,
    })
  } catch (error) {
    console.error("Demo data yükleme hatası:", error)
    return NextResponse.json(
      { error: "Demo data yüklenemedi", details: String(error) },
      { status: 500 }
    )
  }
}
