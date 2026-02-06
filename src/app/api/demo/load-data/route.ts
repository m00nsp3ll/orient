import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { subDays, addDays, addHours, setHours, setMinutes } from "date-fns"

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    // Mevcut demo randevuları sil
    // Önce appointment service'leri sil
    const demoAppointments = await prisma.appointment.findMany({
      where: { notes: { contains: "[DEMO]" } },
      select: { id: true }
    })

    if (demoAppointments.length > 0) {
      await prisma.$executeRaw`DELETE FROM "AppointmentService" WHERE "appointmentId" IN (SELECT id FROM "Appointment" WHERE notes LIKE '%[DEMO]%')`
      await prisma.appointment.deleteMany({
        where: { notes: { contains: "[DEMO]" } }
      })
    }

    // Servisleri al
    const services = await prisma.service.findMany({ where: { isActive: true } })
    if (services.length === 0) {
      return NextResponse.json({ error: "Önce hizmetler oluşturulmalı" }, { status: 400 })
    }

    // Acentaları al
    const agencies = await prisma.agency.findMany({ where: { isActive: true } })

    // Otelleri al
    const hotels = await prisma.hotel.findMany({ where: { isActive: true }, take: 20 })

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
        let startTime = setMinutes(setHours(date, hour), minute)

        const numServices = Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 2 : 3
        const selectedServices = [...services].sort(() => Math.random() - 0.5).slice(0, numServices)
        const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
        const endTime = addHours(startTime, totalDuration / 60)

        const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
        const isManual = Math.random() < 0.2 // %20 manuel giriş
        const agency = isManual ? null : agencies[Math.floor(Math.random() * agencies.length)]
        const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
        const customerPhone = `+90 5${Math.floor(Math.random() * 100).toString().padStart(2, '0')} ${Math.floor(Math.random() * 1000).toString().padStart(3, '0')} ${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

        appointments.push({
          serviceId: selectedServices[0].id,
          agencyId: agency?.id || null,
          hotelId: hotel?.id || null,
          pax,
          customerName,
          customerPhone,
          startTime,
          endTime,
          status: "COMPLETED", // Geçmiş randevular tamamlandı
          approvalStatus: "APPROVED",
          notes: isManual ? "[DEMO] Manuel rezervasyon" : `[DEMO] ${agency?.name || ""}`,
          selectedServices
        })
      }
    }

    // BUGÜN: 8-12 randevu (operasyon paneli için güzel görünsün)
    const todayAppointments = Math.floor(Math.random() * 5) + 8
    for (let i = 0; i < todayAppointments; i++) {
      const hour = Math.floor(Math.random() * 9) + 9
      const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
      let startTime = setMinutes(setHours(today, hour), minute)

      const numServices = Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 2 : 3
      const selectedServices = [...services].sort(() => Math.random() - 0.5).slice(0, numServices)
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
      const endTime = addHours(startTime, totalDuration / 60)

      const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
      const isManual = Math.random() < 0.15
      const agency = isManual ? null : agencies[Math.floor(Math.random() * agencies.length)]
      const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
      const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
      const customerPhone = `+90 5${Math.floor(Math.random() * 100).toString().padStart(2, '0')} ${Math.floor(Math.random() * 1000).toString().padStart(3, '0')} ${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

      // Bugünkü randevular: geçmiş saatler COMPLETED, gelecek saatler CONFIRMED/PENDING
      const now = new Date()
      let status
      if (startTime < now) {
        status = "COMPLETED"
      } else {
        status = Math.random() < 0.85 ? "CONFIRMED" : "PENDING"
      }

      appointments.push({
        serviceId: selectedServices[0].id,
        agencyId: agency?.id || null,
        hotelId: hotel?.id || null,
        pax,
        customerName,
        customerPhone,
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
        let startTime = setMinutes(setHours(date, hour), minute)

        const numServices = Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 2 : 3
        const selectedServices = [...services].sort(() => Math.random() - 0.5).slice(0, numServices)
        const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
        const endTime = addHours(startTime, totalDuration / 60)

        const pax = Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 2 : Math.floor(Math.random() * 4) + 2
        const isManual = Math.random() < 0.15
        const agency = isManual ? null : agencies[Math.floor(Math.random() * agencies.length)]
        const hotel = hotels.length > 0 ? hotels[Math.floor(Math.random() * hotels.length)] : null
        const customerName = customerNames[Math.floor(Math.random() * customerNames.length)]
        const customerPhone = `+90 5${Math.floor(Math.random() * 100).toString().padStart(2, '0')} ${Math.floor(Math.random() * 1000).toString().padStart(3, '0')} ${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

        // Gelecek randevular: %90 CONFIRMED, %10 PENDING
        const status = Math.random() < 0.9 ? "CONFIRMED" : "PENDING"

        appointments.push({
          serviceId: selectedServices[0].id,
          agencyId: agency?.id || null,
          hotelId: hotel?.id || null,
          pax,
          customerName,
          customerPhone,
          startTime,
          endTime,
          status,
          approvalStatus: "APPROVED",
          notes: isManual ? "[DEMO] Manuel rezervasyon" : `[DEMO] ${agency?.name || ""}`,
          selectedServices
        })
      }
    }

    // Randevuları veritabanına ekle
    let createdCount = 0
    for (const apt of appointments) {
      const { selectedServices, ...appointmentData } = apt

      await prisma.appointment.create({
        data: {
          ...appointmentData,
          services: {
            create: selectedServices.map((s: any) => ({
              serviceId: s.id,
              price: s.price * apt.pax,
              duration: s.duration
            }))
          }
        }
      })
      createdCount++
    }

    return NextResponse.json({
      success: true,
      message: `${createdCount} demo randevu oluşturuldu`,
      details: {
        totalAppointments: createdCount,
        dateRange: "Son 30 gün + Bugün + Önümüzdeki 14 gün",
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
