import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { TransferStatus } from "@prisma/client"

/**
 * Demo operasyon verilerini yükle
 * Bugünkü transferleri ve randevuları siler, demo datayı oluşturur
 */
export async function POST(request: Request) {
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

    // 2. Seçili günün randevularını sil
    await prisma.appointment.deleteMany({
      where: {
        startTime: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    })

    // 3. Demo acentalar oluştur (varsa kullan)
    const agencies = [
      { name: "Sunway Travel", code: "SWT001", commission: 15 },
      { name: "Blue Sky Tourism", code: "BST002", commission: 20 },
      { name: "Golden Tours", code: "GLT003", commission: 18 },
      { name: "Paradise Holidays", code: "PRH004", commission: 12 },
    ]

    const createdAgencies = []
    for (const agency of agencies) {
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

    // 4. Hizmetleri al
    const services = await prisma.service.findMany({
      orderBy: { duration: "asc" },
    })

    if (services.length === 0) {
      return NextResponse.json(
        { error: "Hizmet bulunamadı! Lütfen önce hizmet ekleyin." },
        { status: 400 }
      )
    }

    // 5. Otelleri al
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

    // 6. Demo müşteriler
    const demoCustomers = [
      { name: "Ahmet Yılmaz",  phone: "+90 532 111 1111", status: "PENDING",      time: "09:00", pax: 2, service: 0, agency: 0 },
      { name: "Mehmet Demir",  phone: "+90 532 222 2222", status: "PENDING",      time: "09:30", pax: 1, service: 1, agency: 1, rest: true,  restAmount: 150, restCurrency: "EUR" },
      { name: "Ayşe Kaya",    phone: "+90 532 333 3333", status: "PENDING",      time: "10:00", pax: 3, service: 2, agency: 0 },
      { name: "Fatma Şahin",  phone: "+90 532 444 4444", status: "PENDING",      time: "10:30", pax: 2, service: 0, agency: 2 },
      { name: "Ali Çelik",    phone: "+90 532 555 5555", status: "PENDING",      time: "11:00", pax: 4, service: 1, agency: 1 },

      { name: "Zeynep Arslan", phone: "+90 532 666 6666", status: "AT_SPA",      time: "08:00", pax: 2, service: 2, agency: 3 },
      { name: "Hasan Yıldız",  phone: "+90 532 777 7777", status: "AT_SPA",      time: "08:30", pax: 1, service: 0, agency: 0, rest: true, restAmount: 80, restCurrency: "USD" },

      { name: "Elif Öztürk",   phone: "+90 532 888 8888", status: "IN_SERVICE",  time: "07:30", pax: 2, service: 1, agency: 1 },
      { name: "Mustafa Aydın", phone: "+90 532 999 9999", status: "IN_SERVICE",  time: "07:00", pax: 3, service: 2, agency: 2 },

      { name: "Selin Kara",    phone: "+90 533 111 1111", status: "DROPPING_OFF", time: "06:00", pax: 2, service: 0, agency: 3 },
      { name: "Burak Şen",     phone: "+90 533 222 2222", status: "DROPPING_OFF", time: "06:30", pax: 1, service: 1, agency: 0, rest: true, restAmount: 200, restCurrency: "GBP" },
      { name: "Deniz Taş",     phone: "+90 533 333 3333", status: "DROPPING_OFF", time: "07:00", pax: 4, service: 2, agency: 1 },

      { name: "Cem Yalçın",    phone: "+90 533 444 4444", status: "COMPLETED",   time: "05:00", pax: 2, service: 0, agency: 2 },
      { name: "Özge Polat",    phone: "+90 533 555 5555", status: "COMPLETED",   time: "05:30", pax: 3, service: 1, agency: 3, rest: true, restAmount: 2500, restCurrency: "TRY" },
    ]

    // 7. Randevular ve transferler oluştur
    for (const customer of demoCustomers) {
      const hotel = hotels[Math.floor(Math.random() * hotels.length)]
      const service = services[customer.service % services.length]
      const agency = createdAgencies[customer.agency % createdAgencies.length]

      const [hours, minutes] = customer.time.split(":").map(Number)
      const startTime = new Date(targetDate)
      startTime.setHours(hours, minutes, 0, 0)

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + service.duration)

      const appointment = await prisma.appointment.create({
        data: {
          customerName: customer.name,
          customerPhone: customer.phone,
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
        },
      })

      // AppointmentService tablosunu doldur
      await prisma.appointmentService.createMany({
        data: Array.from({ length: customer.pax }).map(() => ({
          appointmentId: appointment.id,
          serviceId: service.id,
          price: service.price,
          duration: service.duration,
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

    // 8. Sunway Travel'dan 5 adet onay bekleyen rezervasyon ekle
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
        endTime.setMinutes(endTime.getMinutes() + service.duration)

        const appointment = await prisma.appointment.create({
          data: {
            customerName: customer.name,
            customerPhone: customer.phone,
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
          },
        })

        // AppointmentService tablosunu doldur
        await prisma.appointmentService.createMany({
          data: Array.from({ length: customer.pax }).map(() => ({
            appointmentId: appointment.id,
            serviceId: service.id,
            price: service.price,
            duration: service.duration,
          })),
          skipDuplicates: true,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${demoCustomers.length} operasyon + 5 onay bekleyen rezervasyon oluşturuldu`,
      count: demoCustomers.length + 5,
    })
  } catch (error) {
    console.error("Demo data yükleme hatası:", error)
    return NextResponse.json(
      { error: "Demo data yüklenemedi" },
      { status: 500 }
    )
  }
}
