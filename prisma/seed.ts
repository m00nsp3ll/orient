import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10)
  const admin = await prisma.user.upsert({
    where: { email: "admin@orientspa.com" },
    update: {},
    create: {
      email: "admin@orientspa.com",
      password: adminPassword,
      name: "Admin User",
      phone: "0532 123 4567",
      role: "ADMIN",
    },
  })
  console.log("Admin user created:", admin.email)

  // Create staff users
  const staffPassword = await bcrypt.hash("staff123", 10)

  const staff1User = await prisma.user.upsert({
    where: { email: "ayse@orientspa.com" },
    update: {},
    create: {
      email: "ayse@orientspa.com",
      password: staffPassword,
      name: "Ayşe Yılmaz",
      phone: "0533 234 5678",
      role: "STAFF",
    },
  })

  const staff2User = await prisma.user.upsert({
    where: { email: "mehmet@orientspa.com" },
    update: {},
    create: {
      email: "mehmet@orientspa.com",
      password: staffPassword,
      name: "Mehmet Kaya",
      phone: "0534 345 6789",
      role: "STAFF",
    },
  })

  // Create staff records
  const staff1 = await prisma.staff.upsert({
    where: { userId: staff1User.id },
    update: {},
    create: {
      userId: staff1User.id,
      specializations: ["Masaj", "Cilt Bakımı"],
      isActive: true,
    },
  })

  const staff2 = await prisma.staff.upsert({
    where: { userId: staff2User.id },
    update: {},
    create: {
      userId: staff2User.id,
      specializations: ["Masaj", "Aromaterapi"],
      isActive: true,
    },
  })

  console.log("Staff created:", staff1User.name, staff2User.name)

  // Create working hours for staff (Monday to Saturday, 09:00-18:00)
  for (const staff of [staff1, staff2]) {
    for (let day = 1; day <= 6; day++) {
      await prisma.workingHours.upsert({
        where: {
          staffId_dayOfWeek: {
            staffId: staff.id,
            dayOfWeek: day,
          },
        },
        update: {},
        create: {
          staffId: staff.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "18:00",
          isActive: true,
        },
      })
    }
  }
  console.log("Working hours created")

  // Create service categories
  const massageCategory = await prisma.serviceCategory.upsert({
    where: { id: "massage-cat" },
    update: {},
    create: {
      id: "massage-cat",
      name: "Masaj",
      description: "Rahatlama ve terapi masajları",
      order: 1,
    },
  })

  const skinCareCategory = await prisma.serviceCategory.upsert({
    where: { id: "skincare-cat" },
    update: {},
    create: {
      id: "skincare-cat",
      name: "Cilt Bakımı",
      description: "Profesyonel cilt bakım uygulamaları",
      order: 2,
    },
  })

  console.log("Categories created")

  // Create services
  const services = [
    {
      name: "Klasik Masaj",
      description: "Geleneksel rahatlama masajı",
      duration: 60,
      price: 500,
      categoryId: massageCategory.id,
    },
    {
      name: "Aromaterapi Masajı",
      description: "Aromatik yağlarla yapılan rahatlatıcı masaj",
      duration: 75,
      price: 650,
      categoryId: massageCategory.id,
    },
    {
      name: "Taş Masajı",
      description: "Sıcak taşlarla yapılan terapi masajı",
      duration: 90,
      price: 800,
      categoryId: massageCategory.id,
    },
    {
      name: "Yüz Bakımı",
      description: "Profesyonel yüz temizleme ve bakım",
      duration: 45,
      price: 400,
      categoryId: skinCareCategory.id,
    },
    {
      name: "Anti-Aging Bakım",
      description: "Yaşlanma karşıtı özel bakım",
      duration: 60,
      price: 700,
      categoryId: skinCareCategory.id,
    },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: service.name.toLowerCase().replace(/\s+/g, "-"),
        ...service,
      },
    })
  }
  console.log("Services created")

  // Create a sample customer
  const customerPassword = await bcrypt.hash("customer123", 10)
  const customer = await prisma.user.upsert({
    where: { email: "musteri@example.com" },
    update: {},
    create: {
      email: "musteri@example.com",
      password: customerPassword,
      name: "Ahmet Demir",
      phone: "0535 456 7890",
      role: "CUSTOMER",
    },
  })
  console.log("Sample customer created:", customer.email)

  // Create a sample agency
  const agencyPassword = await bcrypt.hash("agency123", 10)
  const agencyUser = await prisma.user.upsert({
    where: { email: "acenta@example.com" },
    update: {},
    create: {
      email: "acenta@example.com",
      password: agencyPassword,
      name: "Test Acenta",
      phone: "0536 567 8901",
      role: "AGENCY",
    },
  })

  await prisma.agency.upsert({
    where: { userId: agencyUser.id },
    update: {},
    create: {
      userId: agencyUser.id,
      name: "Test Turizm A.Ş.",
      companyName: "Test Turizm A.Ş.",
      address: "İstanbul, Türkiye",
      code: "TEST001",
      isActive: true,
    },
  })
  console.log("Sample agency created:", agencyUser.email)

  // Create Alanya regions
  const regions = [
    "Kleopatra",
    "Damlataş",
    "Atatürk Anıtı",
    "Çenger",
    "Konaklı",
    "Mahmutlar",
    "Oba",
    "Kestel",
    "Kargıcak",
    "Tosmur",
    "Cikcilli",
    "Avsallar",
    "Türkler",
    "Okurcalar",
    "Payallar",
    "İncekum",
  ]

  const regionMap: Record<string, string> = {}
  for (const regionName of regions) {
    const region = await prisma.region.upsert({
      where: { name: regionName },
      update: {},
      create: { name: regionName, isActive: true },
    })
    regionMap[regionName] = region.id
  }

  // Also create Alanya Merkez as inactive (for backward compat)
  const alanyaMerkez = await prisma.region.upsert({
    where: { name: "Alanya Merkez" },
    update: { isActive: false },
    create: { name: "Alanya Merkez", isActive: false },
  })
  regionMap["Alanya Merkez"] = alanyaMerkez.id

  // Set pickupTimeRegionId references
  // Payallar → Okurcalar
  await prisma.region.update({
    where: { id: regionMap["Payallar"] },
    data: { pickupTimeRegionId: regionMap["Okurcalar"] },
  })
  // Cikcilli → Tosmur
  await prisma.region.update({
    where: { id: regionMap["Cikcilli"] },
    data: { pickupTimeRegionId: regionMap["Tosmur"] },
  })

  console.log("Regions created:", regions.length)

  // Seed RegionSessionTimes
  const sessionTimesMap: Record<string, string[]> = {
    "Çenger": ["08:20", "13:30"],
    "Okurcalar": ["08:30", "13:50", "15:50"],
    "İncekum": ["08:40", "14:00", "16:00"],
    "Avsallar": ["08:50", "14:10", "16:10"],
    "Türkler": ["09:00", "11:00", "14:20", "16:20"],
    "Konaklı": ["09:10", "11:10", "14:30", "16:30"],
    "Kargıcak": ["13:50"],
    "Mahmutlar": ["09:30", "14:00"],
    "Kestel": ["09:40", "14:10"],
    "Tosmur": ["09:45", "14:15", "16:15"],
    "Oba": ["09:50", "14:20", "16:20"],
    "Atatürk Anıtı": ["10:00", "12:00", "14:00", "16:00"],
    "Damlataş": ["09:00", "11:00", "13:00", "14:00", "16:00", "17:00"],
    "Kleopatra": ["09:10", "11:10", "13:10", "14:10", "16:10", "17:10"],
  }

  for (const [regionName, times] of Object.entries(sessionTimesMap)) {
    const regionId = regionMap[regionName]
    if (!regionId) continue
    for (const time of times) {
      await prisma.regionSessionTime.upsert({
        where: { regionId_time: { regionId, time } },
        update: {},
        create: { regionId, time, isActive: true },
      })
    }
  }
  console.log("Session times seeded")

  // Create Alanya hotels with regions (from OpenStreetMap)
  const alanyaHotels = [
    { name: "Club Paradiso Hotel", region: "Kargıcak" },
    { name: "Orient Palace", region: "Kargıcak" },
    { name: "Sunset Beach", region: "Kargıcak" },
    { name: "Sunshine Hotel", region: "Kargıcak" },
    { name: "Green Life Hotel", region: "Kargıcak" },
    { name: "Club Hotel Anjeliq", region: "Konaklı" },
    { name: "Club Hotel Mirabelle", region: "Konaklı" },
    { name: "White City Beach Hotel", region: "Konaklı" },
    { name: "Senza Garden Holiday Club", region: "Konaklı" },
    { name: "Kemal Bay Hotel", region: "Konaklı" },
    { name: "Pascha Bay", region: "Konaklı" },
    { name: "Hotel Aria", region: "Konaklı" },
    { name: "Royal Garden", region: "Konaklı" },
    { name: "Xeno Eftalia Resort", region: "Konaklı" },
    { name: "Larissa Holiday Beach Club", region: "Konaklı" },
    { name: "Bayar Garden Beach", region: "Konaklı" },
    { name: "Grand Okan", region: "Damlataş" },
    { name: "Grand Zaman Garden", region: "Damlataş" },
    { name: "Kleopatra Atlas Hotel", region: "Kleopatra" },
    { name: "Kleopatra Ramira", region: "Kleopatra" },
    { name: "Kleopatra Royal Palm", region: "Kleopatra" },
    { name: "Kleopatra Beach Yıldız Otel", region: "Kleopatra" },
    { name: "Kleopatra Life Hotel", region: "Kleopatra" },
    { name: "Kleopatra Suit Hotel", region: "Kleopatra" },
    { name: "Kleopatra Palmera Beach", region: "Kleopatra" },
    { name: "Sunpark Ocean", region: "Damlataş" },
    { name: "Elysse Hotel", region: "Damlataş" },
    { name: "Alladin Beach", region: "Damlataş" },
    { name: "Royal Palm", region: "Damlataş" },
    { name: "Glaros Hotel", region: "Damlataş" },
    { name: "Ramira Joy Hotel", region: "Atatürk Anıtı" },
    { name: "Vega Green", region: "Atatürk Anıtı" },
    { name: "Margarita Hotel", region: "Atatürk Anıtı" },
    { name: "Akman Beach", region: "Atatürk Anıtı" },
    { name: "Fougere Apart Hotel", region: "Atatürk Anıtı" },
    { name: "Europa Beach Hotel", region: "Tosmur" },
    { name: "Luna Playa", region: "Tosmur" },
    { name: "Blue Sky Hotel", region: "Tosmur" },
    { name: "White Gold Hotel & Spa", region: "Tosmur" },
    { name: "Avena Hotel & Spa", region: "Tosmur" },
    { name: "Monte Carlo Hotel Beach", region: "Tosmur" },
    { name: "Club Bayar Beach Hotel", region: "Tosmur" },
    { name: "Angel Beach", region: "Tosmur" },
    { name: "Elysee Hotel", region: "Oba" },
    { name: "Oba Star Hotel", region: "Oba" },
    { name: "Mesut Hotel", region: "Oba" },
    { name: "Hotel Kahya Resort & Spa", region: "Mahmutlar" },
    { name: "Club Sea Time", region: "Mahmutlar" },
    { name: "Club Sun Heaven", region: "Mahmutlar" },
    { name: "Sunside Beach Hotel", region: "Mahmutlar" },
    { name: "Albahir Deluxe Resort & Spa", region: "Mahmutlar" },
    { name: "Club Tess Hotel", region: "Mahmutlar" },
    { name: "Yetkin Hotel", region: "Mahmutlar" },
    { name: "Club Insula Resort & Spa", region: "Mahmutlar" },
    { name: "Palmeras Beach Hotel & Spa", region: "Mahmutlar" },
    { name: "Saphir Hotel", region: "Mahmutlar" },
    { name: "The Garden Beach Hotel", region: "Mahmutlar" },
    { name: "Konak Tatil Sitesi", region: "Mahmutlar" },
    { name: "Long Beach Resort Hotel & Spa", region: "Avsallar" },
    { name: "Kirman Belazur Resort & Spa", region: "Avsallar" },
    { name: "Kirman Sidemarin Beach & Spa", region: "Avsallar" },
    { name: "Granada Luxury Beach", region: "Avsallar" },
    { name: "Lonicera Resort & Spa", region: "İncekum" },
    { name: "MC Arancia Resort", region: "İncekum" },
    { name: "Oz Hotels Incekum Beach", region: "İncekum" },
    { name: "Utopia World Hotel", region: "İncekum" },
  ]

  for (const hotel of alanyaHotels) {
    const regionId = regionMap[hotel.region]
    if (regionId) {
      await prisma.hotel.upsert({
        where: { id: hotel.name.toLowerCase().replace(/[^a-z0-9]/g, "-") },
        update: {},
        create: {
          id: hotel.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          name: hotel.name,
          regionId: regionId,
          isActive: true,
        },
      })
    }
  }
  console.log("Alanya hotels created:", alanyaHotels.length)

  // Create drivers
  const driverPassword = await bcrypt.hash("driver123", 10)

  const driver1User = await prisma.user.upsert({
    where: { email: "ahmet.sofor@orientspa.com" },
    update: {},
    create: {
      email: "ahmet.sofor@orientspa.com",
      password: driverPassword,
      name: "Ahmet Şoför",
      phone: "0532 111 2233",
      role: "DRIVER",
    },
  })

  const driver1 = await prisma.driver.upsert({
    where: { userId: driver1User.id },
    update: {},
    create: {
      userId: driver1User.id,
      phone: "0532 111 2233",
      isActive: true,
    },
  })

  const driver2User = await prisma.user.upsert({
    where: { email: "ali.sofor@orientspa.com" },
    update: {},
    create: {
      email: "ali.sofor@orientspa.com",
      password: driverPassword,
      name: "Ali Şoför",
      phone: "0533 444 5566",
      role: "DRIVER",
    },
  })

  const driver2 = await prisma.driver.upsert({
    where: { userId: driver2User.id },
    update: {},
    create: {
      userId: driver2User.id,
      phone: "0533 444 5566",
      isActive: true,
    },
  })

  console.log("Drivers created:", driver1User.name, driver2User.name)

  // Create today's appointments with transfers for testing
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get some hotels and services for appointments
  const testHotels = await prisma.hotel.findMany({ take: 5 })
  const testServices = await prisma.service.findMany({ take: 3 })

  if (testHotels.length > 0 && testServices.length > 0) {
    const todayAppointments = [
      { customerName: "Müller", hour: 9, minute: 30, pax: 2, hotelIdx: 0, serviceIdx: 0, driverId: driver1.id, status: "PENDING" as const },
      { customerName: "Smith", hour: 10, minute: 0, pax: 4, hotelIdx: 1, serviceIdx: 1, driverId: driver2.id, status: "PICKING_UP" as const },
      { customerName: "Yılmaz", hour: 10, minute: 30, pax: 1, hotelIdx: 2, serviceIdx: 0, driverId: driver1.id, status: "AT_SPA" as const },
      { customerName: "Johnson", hour: 11, minute: 0, pax: 3, hotelIdx: 3, serviceIdx: 2, driverId: null, status: "PENDING" as const },
      { customerName: "Kaya", hour: 12, minute: 30, pax: 2, hotelIdx: 4, serviceIdx: 1, driverId: null, status: "PENDING" as const },
      { customerName: "Garcia", hour: 14, minute: 0, pax: 1, hotelIdx: 0, serviceIdx: 0, driverId: driver2.id, status: "PENDING" as const },
    ]

    for (const apt of todayAppointments) {
      const startTime = new Date(today)
      startTime.setHours(apt.hour, apt.minute, 0, 0)

      const service = testServices[apt.serviceIdx % testServices.length]
      const hotel = testHotels[apt.hotelIdx % testHotels.length]

      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + service.duration)

      const appointment = await prisma.appointment.create({
        data: {
          customerName: apt.customerName,
          pax: apt.pax,
          hotelId: hotel.id,
          serviceId: service.id,
          startTime,
          endTime,
          status: "CONFIRMED",
        },
      })

      // Create transfer with arrival time for AT_SPA status
      const transferData: {
        appointmentId: string
        driverId: string | null
        status: "PENDING" | "PICKING_UP" | "AT_SPA" | "IN_SERVICE" | "DROPPING_OFF" | "COMPLETED" | "CANCELLED"
        arrivalTime?: Date
      } = {
        appointmentId: appointment.id,
        driverId: apt.driverId,
        status: apt.status,
      }

      if (apt.status === "AT_SPA") {
        transferData.arrivalTime = new Date()
      }

      await prisma.transfer.create({ data: transferData })

      console.log(`Today's appointment created: ${apt.customerName} - ${apt.hour}:${apt.minute.toString().padStart(2, "0")}`)
    }
  }

  console.log("\n✅ Seeding completed!")
  console.log("\nTest accounts:")
  console.log("Admin: admin@orientspa.com / admin123")
  console.log("Staff: ayse@orientspa.com / staff123")
  console.log("Staff: mehmet@orientspa.com / staff123")
  console.log("Customer: musteri@example.com / customer123")
  console.log("Agency: acenta@example.com / agency123")
  console.log("Driver: ahmet.sofor@orientspa.com / driver123")
  console.log("Driver: ali.sofor@orientspa.com / driver123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
