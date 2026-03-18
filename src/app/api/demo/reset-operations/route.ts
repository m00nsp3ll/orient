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

    // Driver'ları al (transfer statüleri için)
    const drivers = await prisma.driver.findMany({
      where: { isActive: true },
    })

    // 8. Session-times'dan tüm seans saatlerini çek
    const regionSessionTimes = await prisma.regionSessionTime.findMany({
      where: { isActive: true },
      select: { time: true },
    })
    const sessionTimeSet = new Set(regionSessionTimes.map(st => st.time))
    const sessionSlots = Array.from(sessionTimeSet).sort()

    // Fallback: session-time yoksa sabit saatler
    const timeSlots = sessionSlots.length > 0
      ? sessionSlots
      : ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "14:00", "15:00"]

    // Müşteri isimleri havuzu
    const customerNames = [
      "Hans Müller", "Anna Schmidt", "Peter Weber", "Maria Fischer", "Thomas Braun",
      "Elena Petrov", "Alexander Ivanov", "Olga Smirnova", "Dmitry Volkov", "Natasha Kozlova",
      "John Smith", "Emma Wilson", "Michael Brown", "Sophie Johnson", "David Taylor",
      "Ahmet Yılmaz", "Fatma Kaya", "Mehmet Demir", "Ayşe Çelik", "Mustafa Öztürk",
      "Pierre Dubois", "Marie Laurent", "Jean Bernard", "Isabelle Martin", "François Petit",
      "Lars Johansson", "Ingrid Andersson", "Erik Lindgren", "Astrid Eriksson", "Olaf Svensson",
      "Giuseppe Rossi", "Chiara Bianchi", "Luca Ferrari", "Sakura Tanaka", "Yuki Nakamura",
      "Carlos Garcia", "Isabella Martinez", "Roberto Silva", "Chen Wei", "Li Mei",
    ]

    const notesPool = [
      "VIP müşteri", "Bebek arabası var", "Çocuklar 3 ve 5 yaşında", "İkiz çocuklar",
      "Bebek koltuğu gerekli", "Grubun 1 üyesi engelli", "Çocuklar 2 ve 7 yaşında",
      "Yaşlı misafir var", "Alerjisi var", "Geç alınış isteniyor", null, null, null, null, null,
    ]

    const voucherPrefixes = ["SWT", "BST", "GLT", "PRH", "VIP", "RES"]

    // 9. Her saat dilimi için 3-6 randevu oluştur (200+ kişilik yoğun operasyon)
    let count = 0
    let nameIdx = 0
    const now = new Date()
    const currentHour = now.getHours()

    for (const timeSlot of timeSlots) {
      const appointmentsPerSlot = Math.floor(Math.random() * 4) + 3 // 3-6 randevu

      for (let i = 0; i < appointmentsPerSlot; i++) {
        const hotel = hotels[Math.floor(Math.random() * hotels.length)]
        const agency = createdAgencies[Math.floor(Math.random() * createdAgencies.length)]
        const serviceCount = Math.random() < 0.3 && services.length > 1 ? 2 : 1
        const firstIdx = Math.floor(Math.random() * services.length)
        const selectedServiceIndices = serviceCount === 2
          ? [firstIdx, (firstIdx + 1 + Math.floor(Math.random() * (services.length - 1))) % services.length]
          : [firstIdx]
        const primaryService = services[selectedServiceIndices[0]]

        const [hours, minutes] = timeSlot.split(":").map(Number)
        const startTime = new Date(targetDate)
        startTime.setHours(hours, minutes, 0, 0)

        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + 60)

        count++
        const customerName = customerNames[nameIdx % customerNames.length]
        nameIdx++

        // Daha fazla 3-5 kişilik gruplar
        const pax = Math.random() < 0.15 ? 1 : Math.random() < 0.35 ? 2 : Math.floor(Math.random() * 3) + 3
        const childCount = Math.random() < 0.35 ? Math.floor(Math.random() * 3) + 1 : 0

        // ~%20 iptal edilmiş randevu
        const isCancelled = Math.random() < 0.2

        // %20 REST (iptal edilmeyenler için)
        const isRest = !isCancelled && Math.random() < 0.2
        const restCurrencies = ["TRY", "EUR", "USD", "GBP"]
        const restCurrency = isRest ? restCurrencies[Math.floor(Math.random() * restCurrencies.length)] : null
        const restAmount = isRest
          ? (restCurrency === "TRY" ? Math.floor(Math.random() * 3000) + 500 : Math.floor(Math.random() * 150) + 30)
          : null

        const prefix = voucherPrefixes[Math.floor(Math.random() * voucherPrefixes.length)]
        const voucherNo = `${prefix}-${String(1000 + count)}`

        const note = notesPool[Math.floor(Math.random() * notesPool.length)]

        const selectedServices = selectedServiceIndices.map(idx => services[idx])

        const appointment = await prisma.appointment.create({
          data: {
            customerName,
            roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
            serviceId: primaryService.id,
            hotelId: hotel.id,
            agencyId: agency.id,
            startTime,
            endTime,
            pax,
            childCount,
            status: isCancelled ? "CANCELLED" : "CONFIRMED",
            approvalStatus: isCancelled ? "APPROVED" : "APPROVED",
            notes: note,
            restAmount,
            restCurrency,
            voucherNo,
          },
        })

        for (const svc of selectedServices) {
          await prisma.appointmentService.create({
            data: {
              appointmentId: appointment.id,
              serviceId: svc.id,
              price: svc.price,
            },
          })
        }

        // İptal edilmiş randevulara transfer oluşturma
        if (!isCancelled) {
          // Saate göre transfer statüsü belirle
          let transferStatus: TransferStatus
          let transferDriverId: string | undefined = undefined
          let transferDropoffTime: Date | undefined = undefined

          if (hours < currentHour - 2) {
            transferStatus = "COMPLETED"
            transferDropoffTime = new Date(startTime)
            transferDropoffTime.setMinutes(transferDropoffTime.getMinutes() + 90)
          } else if (hours < currentHour - 1) {
            transferStatus = "DROPPING_OFF"
            if (drivers.length > 0) {
              transferDriverId = drivers[Math.floor(Math.random() * drivers.length)].id
            }
          } else if (hours < currentHour) {
            transferStatus = "IN_SERVICE"
            if (drivers.length > 0) {
              transferDriverId = drivers[Math.floor(Math.random() * drivers.length)].id
            }
          } else if (hours === currentHour) {
            transferStatus = "PICKING_UP"
            if (drivers.length > 0) {
              transferDriverId = drivers[Math.floor(Math.random() * drivers.length)].id
            }
          } else {
            transferStatus = "PENDING"
          }

          await prisma.transfer.create({
            data: {
              appointmentId: appointment.id,
              status: transferStatus,
              driverId: transferDriverId || null,
              dropoffTime: transferDropoffTime || null,
            },
          })
        }
      }
    }

    // 10. Sunway Travel'dan onay bekleyen (her 3. saat dilimine 1 adet)
    const sunwayAgency = createdAgencies.find(a => a.code === "SWT001")

    if (sunwayAgency) {
      const pendingNames = ["Emre Kılıç", "Derya Aydın", "Gökhan Şen", "Hülya Koç", "İsmail Yurt"]
      const pendingSlots = timeSlots.filter((_, idx) => idx % 3 === 0).slice(0, 5)

      for (let pi = 0; pi < pendingSlots.length; pi++) {
        const slot = pendingSlots[pi]
        const hotel = hotels[Math.floor(Math.random() * hotels.length)]
        const serviceIdx = pi % services.length
        const primaryService = services[serviceIdx]

        const [hours, mins] = slot.split(":").map(Number)
        const startTime = new Date(targetDate)
        startTime.setHours(hours, mins, 0, 0)

        const endTime = new Date(startTime)
        endTime.setMinutes(endTime.getMinutes() + 60)

        count++
        const pax = Math.floor(Math.random() * 4) + 2
        const childCount = Math.random() < 0.4 ? Math.floor(Math.random() * 2) + 1 : 0
        const isRest = pi === 3 // 1 tanesi REST olsun
        const selectedServices = pi % 2 === 1 && services.length > 1
          ? [services[serviceIdx], services[(serviceIdx + 1) % services.length]]
          : [primaryService]

        const appointment = await prisma.appointment.create({
          data: {
            customerName: pendingNames[pi % pendingNames.length],
            roomNumber: `${Math.floor(Math.random() * 500) + 100}`,
            serviceId: primaryService.id,
            hotelId: hotel.id,
            agencyId: sunwayAgency.id,
            startTime,
            endTime,
            pax,
            childCount,
            status: "CONFIRMED",
            approvalStatus: "PENDING_APPROVAL",
            notes: pi === 0 ? "Bebek koltuğu gerekli" : pi === 2 ? "Çocuklar 2 ve 7 yaşında" : null,
            restAmount: isRest ? 120 : null,
            restCurrency: isRest ? "EUR" : null,
            voucherNo: `SWT-${2001 + pi}`,
          },
        })

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

        // Personel kredi kartı gelirleri (1-2 adet/gün) — prim hem nakit hem KK'dan görünsün
        const staffCCCount = Math.floor(Math.random() * 2) + 1
        for (let i = 0; i < staffCCCount; i++) {
          const staff = staffMembers[Math.floor(Math.random() * staffMembers.length)]
          const cur = ["EUR", "USD", "TRY"][Math.floor(Math.random() * 3)]
          const amount = cur === "TRY" ? (Math.floor(Math.random() * 2000) + 500)
            : (Math.floor(Math.random() * 100) + 30)

          await prisma.cashEntry.create({
            data: {
              date: kasaDate,
              voucherNo: voucherNo++,
              staffId: staff.id,
              creditCardAmount: amount,
              creditCardCurrency: cur,
              description: `[DEMO] ${staff.user.name} kredi kartı satışı`,
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
