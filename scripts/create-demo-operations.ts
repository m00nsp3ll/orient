import { PrismaClient, TransferStatus } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * DEMO OPERATIONS DATA
 * Bu dosya demo operasyon verilerini içerir.
 * Kullanım: npx tsx scripts/create-demo-operations.ts
 */

async function main() {
  console.log("🧹 Bugünkü transferler ve randevular temizleniyor...")

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Bugünkü transferleri sil
  await prisma.transfer.deleteMany({
    where: {
      appointment: {
        startTime: {
          gte: today,
          lt: tomorrow,
        },
      },
    },
  })

  // Bugünkü randevuları sil
  await prisma.appointment.deleteMany({
    where: {
      startTime: {
        gte: today,
        lt: tomorrow,
      },
    },
  })

  console.log("✅ Temizlik tamamlandı")

  // Demo acentalar oluştur
  console.log("🏢 Demo acentalar oluşturuluyor...")

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
      console.log(`   ↪ ${agency.name} zaten mevcut`)
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
      console.log(`   ✅ ${agency.name} oluşturuldu`)
    }
  }

  console.log(`✅ ${createdAgencies.length} acenta hazır`)

  // Hizmetleri al
  const services = await prisma.service.findMany({
    orderBy: { duration: "asc" },
  })

  if (services.length === 0) {
    console.error("❌ Hizmet bulunamadı!")
    return
  }

  // Otelleri al (adresi olanlar)
  const hotels = await prisma.hotel.findMany({
    where: {
      isActive: true,
      lat: { not: null },
      lng: { not: null },
    },
    include: {
      region: true,
    },
    take: 30,
  })

  if (hotels.length === 0) {
    console.error("❌ Adresli otel bulunamadı!")
    return
  }

  console.log(`✅ ${hotels.length} adresli otel bulundu`)

  // Demo müşteriler ve randevular
  console.log("📅 Demo operasyon verileri oluşturuluyor...")

  const demoCustomers = [
    { name: "Ahmet Yılmaz", phone: "+90 532 111 1111", status: "PENDING", time: "09:00", pax: 2, service: 0, agency: 0 },
    { name: "Mehmet Demir", phone: "+90 532 222 2222", status: "PENDING", time: "09:30", pax: 1, service: 1, agency: 1, rest: true },
    { name: "Ayşe Kaya", phone: "+90 532 333 3333", status: "PENDING", time: "10:00", pax: 3, service: 2, agency: 0 },
    { name: "Fatma Şahin", phone: "+90 532 444 4444", status: "PENDING", time: "10:30", pax: 2, service: 0, agency: 2 },
    { name: "Ali Çelik", phone: "+90 532 555 5555", status: "PENDING", time: "11:00", pax: 4, service: 1, agency: 1 },

    { name: "Zeynep Arslan", phone: "+90 532 666 6666", status: "AT_SPA", time: "08:00", pax: 2, service: 2, agency: 3 },
    { name: "Hasan Yıldız", phone: "+90 532 777 7777", status: "AT_SPA", time: "08:30", pax: 1, service: 0, agency: 0, rest: true },

    { name: "Elif Öztürk", phone: "+90 532 888 8888", status: "IN_SERVICE", time: "07:30", pax: 2, service: 1, agency: 1 },
    { name: "Mustafa Aydın", phone: "+90 532 999 9999", status: "IN_SERVICE", time: "07:00", pax: 3, service: 2, agency: 2 },

    { name: "Selin Kara", phone: "+90 533 111 1111", status: "DROPPING_OFF", time: "06:00", pax: 2, service: 0, agency: 3 },
    { name: "Burak Şen", phone: "+90 533 222 2222", status: "DROPPING_OFF", time: "06:30", pax: 1, service: 1, agency: 0, rest: true },
    { name: "Deniz Taş", phone: "+90 533 333 3333", status: "DROPPING_OFF", time: "07:00", pax: 4, service: 2, agency: 1 },

    { name: "Cem Yalçın", phone: "+90 533 444 4444", status: "COMPLETED", time: "05:00", pax: 2, service: 0, agency: 2 },
    { name: "Özge Polat", phone: "+90 533 555 5555", status: "COMPLETED", time: "05:30", pax: 3, service: 1, agency: 3, rest: true },
  ]

  let count = 0

  for (const customer of demoCustomers) {
    // Rastgele otel seç
    const hotel = hotels[Math.floor(Math.random() * hotels.length)]
    const service = services[customer.service % services.length]
    const agency = createdAgencies[customer.agency % createdAgencies.length]

    // Saat hesapla
    const [hours, minutes] = customer.time.split(":").map(Number)
    const startTime = new Date(today)
    startTime.setHours(hours, minutes, 0, 0)

    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + service.duration)

    // Randevu oluştur
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
        notes: customer.rest ? "REST - Ödeme Kapıda" : null,
      },
    })

    // Transfer oluştur
    const transfer = await prisma.transfer.create({
      data: {
        appointmentId: appointment.id,
        status: customer.status as TransferStatus,
        arrivalTime: ["IN_SERVICE", "DROPPING_OFF", "COMPLETED"].includes(customer.status) ? startTime : null,
        dropoffTime: customer.status === "COMPLETED" ? new Date(endTime.getTime() + 30 * 60000) : null, // +30 dk bırakış süresi
      },
    })

    count++
    console.log(`   ${count}. ${customer.name} - ${customer.status} (${customer.time}) - ${agency.name}`)
  }

  console.log(`✅ ${count} demo operasyon kaydı oluşturuldu`)
  console.log("🎉 Demo operasyon hazır!")
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
