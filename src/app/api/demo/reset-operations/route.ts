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

    // 8. Demo müşteriler — childCount, REST (restAmount bazlı), çoklu paket
    const demoCustomers: {
      name: string; status: string; time: string; pax: number; childCount: number
      serviceIndices: number[]; agency: number; restAmount?: number; restCurrency?: string
      notes?: string; voucherNo?: string
    }[] = [
      // PENDING — alınmayı bekleyenler
      { name: "Hans Müller",    status: "PENDING",    time: "09:00", pax: 2, childCount: 1, serviceIndices: [0],    agency: 0, voucherNo: "SWT-1001" },
      { name: "Anna Schmidt",   status: "PENDING",    time: "09:30", pax: 1, childCount: 0, serviceIndices: [1],    agency: 1, restAmount: 150, restCurrency: "EUR" },
      { name: "Pierre Dubois",  status: "PENDING",    time: "10:00", pax: 3, childCount: 2, serviceIndices: [0, 1], agency: 0, notes: "Çocuklar 3 ve 5 yaşında" },
      { name: "Elena Petrov",   status: "PENDING",    time: "10:30", pax: 2, childCount: 0, serviceIndices: [0],    agency: 2, voucherNo: "GLT-4422" },
      { name: "John Smith",     status: "PENDING",    time: "11:00", pax: 4, childCount: 1, serviceIndices: [1, 0], agency: 1, notes: "VIP müşteri" },

      // IN_SERVICE — turda olanlar
      { name: "Sophie Johnson", status: "IN_SERVICE", time: "08:00", pax: 2, childCount: 0, serviceIndices: [0],    agency: 3 },
      { name: "Maria Fischer",  status: "IN_SERVICE", time: "08:30", pax: 1, childCount: 0, serviceIndices: [0],    agency: 0, restAmount: 80, restCurrency: "USD", voucherNo: "SWT-1055" },
      { name: "Ahmet Yılmaz",   status: "IN_SERVICE", time: "07:30", pax: 2, childCount: 1, serviceIndices: [1],    agency: 1, notes: "Bebek arabası var" },
      { name: "Lars Johansson", status: "IN_SERVICE", time: "07:00", pax: 3, childCount: 0, serviceIndices: [0, 1], agency: 2 },

      // DROPPING_OFF — bırakılıyor
      { name: "Fatma Kaya",     status: "DROPPING_OFF", time: "06:00", pax: 2, childCount: 1, serviceIndices: [0],  agency: 3, voucherNo: "PRH-7712" },
      { name: "Erik Lindgren",  status: "DROPPING_OFF", time: "06:30", pax: 1, childCount: 0, serviceIndices: [1],  agency: 0, restAmount: 200, restCurrency: "GBP" },
      { name: "Olga Smirnova", status: "DROPPING_OFF", time: "07:00", pax: 4, childCount: 2, serviceIndices: [0, 1], agency: 1, notes: "İkiz çocuklar" },

      // COMPLETED — tamamlanan
      { name: "Thomas Braun",   status: "COMPLETED",  time: "05:00", pax: 2, childCount: 0, serviceIndices: [0],    agency: 2 },
      { name: "Mehmet Demir",   status: "COMPLETED",  time: "05:30", pax: 3, childCount: 1, serviceIndices: [1, 0], agency: 3, restAmount: 2500, restCurrency: "TRY", voucherNo: "PRH-9901" },
    ]

    // 9. Randevular ve transferler oluştur
    let count = 0
    for (const customer of demoCustomers) {
      const hotel = hotels[Math.floor(Math.random() * hotels.length)]
      const primaryService = services[customer.serviceIndices[0] % services.length]
      const agency = createdAgencies[customer.agency % createdAgencies.length]

      const [hours, minutes] = customer.time.split(":").map(Number)
      const startTime = new Date(targetDate)
      startTime.setHours(hours, minutes, 0, 0)

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + 60)

      count++
      const voucherNo = customer.voucherNo || `V-${String(count).padStart(4, "0")}`

      // Seçilen paketleri hazırla
      const selectedServices = customer.serviceIndices.map(idx => services[idx % services.length])

      const appointment = await prisma.appointment.create({
        data: {
          customerName: customer.name,
          roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
          serviceId: primaryService.id,
          hotelId: hotel.id,
          agencyId: agency.id,
          startTime,
          endTime,
          pax: customer.pax,
          childCount: customer.childCount,
          status: "CONFIRMED",
          approvalStatus: "APPROVED",
          notes: customer.notes || null,
          restAmount: customer.restAmount || null,
          restCurrency: customer.restCurrency || null,
          voucherNo,
        },
      })

      // AppointmentService — her seçilen paket için tek kayıt (unique constraint: appointmentId+serviceId)
      for (const svc of selectedServices) {
        await prisma.appointmentService.create({
          data: {
            appointmentId: appointment.id,
            serviceId: svc.id,
            price: svc.price,
          },
        })
      }

      await prisma.transfer.create({
        data: {
          appointmentId: appointment.id,
          status: customer.status as TransferStatus,
          arrivalTime: ["IN_SERVICE", "COMPLETED"].includes(customer.status) ? startTime : null,
          dropoffTime: customer.status === "COMPLETED" ? new Date(endTime.getTime() + 30 * 60000) : null,
        },
      })
    }

    // 10. Sunway Travel'dan onay bekleyen rezervasyonlar (farklı paket kombinasyonları)
    const sunwayAgency = createdAgencies.find(a => a.code === "SWT001")

    if (sunwayAgency) {
      const pendingCustomers = [
        { name: "Emre Kılıç",   time: "12:00", pax: 2, childCount: 1, serviceIndices: [0],    restAmount: undefined as number | undefined, restCurrency: undefined as string | undefined, notes: "Bebek koltuğu gerekli", voucherNo: "SWT-2001" },
        { name: "Derya Aydın",  time: "13:00", pax: 3, childCount: 0, serviceIndices: [1, 0], restAmount: undefined as number | undefined, restCurrency: undefined as string | undefined, notes: undefined as string | undefined, voucherNo: "SWT-2002" },
        { name: "Gökhan Şen",   time: "14:00", pax: 4, childCount: 2, serviceIndices: [0],    restAmount: undefined as number | undefined, restCurrency: undefined as string | undefined, notes: "Çocuklar 2 ve 7 yaşında", voucherNo: "SWT-2003" },
        { name: "Hülya Koç",    time: "15:00", pax: 2, childCount: 0, serviceIndices: [1],    restAmount: 120, restCurrency: "EUR", notes: undefined as string | undefined, voucherNo: "SWT-2004" },
        { name: "İsmail Yurt",  time: "16:00", pax: 5, childCount: 1, serviceIndices: [0, 1], restAmount: undefined as number | undefined, restCurrency: undefined as string | undefined, notes: "Grubun 1 üyesi engelli", voucherNo: "SWT-2005" },
      ]

      for (const customer of pendingCustomers) {
        const hotel = hotels[Math.floor(Math.random() * hotels.length)]
        const primaryService = services[customer.serviceIndices[0] % services.length]

        const [hours, mins] = customer.time.split(":").map(Number)
        const startTime = new Date(targetDate)
        startTime.setHours(hours, mins, 0, 0)

        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + 60)

        count++

        const selectedServices = customer.serviceIndices.map(idx => services[idx % services.length])

        const appointment = await prisma.appointment.create({
          data: {
            customerName: customer.name,
            roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
            serviceId: primaryService.id,
            hotelId: hotel.id,
            agencyId: sunwayAgency.id,
            startTime,
            endTime,
            pax: customer.pax,
            childCount: customer.childCount,
            status: "CONFIRMED",
            approvalStatus: "PENDING_APPROVAL",
            notes: customer.notes || null,
            restAmount: customer.restAmount || null,
            restCurrency: customer.restCurrency || null,
            voucherNo: customer.voucherNo,
          },
        })

        // AppointmentService — her seçilen paket için tek kayıt
        for (const svc of selectedServices) {
          await prisma.appointmentService.create({
            data: {
              appointmentId: appointment.id,
              serviceId: svc.id,
              price: svc.price,
            },
          })
        }
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
