import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting region migration...")

  // 2a. Create new regions
  const newRegions = ["Kleopatra", "Damlataş", "Atatürk Anıtı", "Çenger"]
  const regionMap: Record<string, string> = {}

  for (const name of newRegions) {
    const region = await prisma.region.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    })
    regionMap[name] = region.id
    console.log(`Region created/found: ${name} (${region.id})`)
  }

  // Load existing regions
  const allRegions = await prisma.region.findMany()
  for (const r of allRegions) {
    regionMap[r.name] = r.id
  }

  // 2b. Move "Alanya Merkez" hotels to new regions
  const kleopatraRegionId = regionMap["Kleopatra"]
  const damlatasRegionId = regionMap["Damlataş"]
  const ataturkRegionId = regionMap["Atatürk Anıtı"]

  // Hotels starting with "Kleopatra" → Kleopatra region
  const kleopatraHotels = await prisma.hotel.findMany({
    where: {
      name: { startsWith: "Kleopatra" },
      region: { name: "Alanya Merkez" },
    },
  })
  for (const hotel of kleopatraHotels) {
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { regionId: kleopatraRegionId },
    })
    console.log(`  ${hotel.name} → Kleopatra`)
  }

  // Hardcoded mapping for Damlataş
  const damlatasHotelNames = [
    "Grand Okan",
    "Grand Zaman Garden",
    "Sunpark Ocean",
    "Elysse Hotel",
    "Alladin Beach",
    "Royal Palm",
    "Glaros Hotel",
  ]

  for (const hotelName of damlatasHotelNames) {
    const hotel = await prisma.hotel.findFirst({
      where: { name: hotelName, region: { name: "Alanya Merkez" } },
    })
    if (hotel) {
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: { regionId: damlatasRegionId },
      })
      console.log(`  ${hotelName} → Damlataş`)
    }
  }

  // Remaining Alanya Merkez hotels → Atatürk Anıtı
  const remainingHotels = await prisma.hotel.findMany({
    where: { region: { name: "Alanya Merkez" } },
  })
  for (const hotel of remainingHotels) {
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { regionId: ataturkRegionId },
    })
    console.log(`  ${hotel.name} → Atatürk Anıtı`)
  }

  // 2c. Set pickupTimeRegionId
  // Payallar → Okurcalar
  if (regionMap["Payallar"] && regionMap["Okurcalar"]) {
    await prisma.region.update({
      where: { id: regionMap["Payallar"] },
      data: { pickupTimeRegionId: regionMap["Okurcalar"] },
    })
    console.log("Payallar → uses Okurcalar session times")
  }

  // Cikcilli → Tosmur
  if (regionMap["Cikcilli"] && regionMap["Tosmur"]) {
    await prisma.region.update({
      where: { id: regionMap["Cikcilli"] },
      data: { pickupTimeRegionId: regionMap["Tosmur"] },
    })
    console.log("Cikcilli → uses Tosmur session times")
  }

  // 2d. Deactivate "Alanya Merkez"
  await prisma.region.updateMany({
    where: { name: "Alanya Merkez" },
    data: { isActive: false },
  })
  console.log("Alanya Merkez deactivated")

  // 2e. Seed session times for all regions
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
    if (!regionId) {
      console.warn(`Region not found: ${regionName}`)
      continue
    }

    for (const time of times) {
      await prisma.regionSessionTime.upsert({
        where: {
          regionId_time: { regionId, time },
        },
        update: {},
        create: {
          regionId,
          time,
          isActive: true,
        },
      })
    }
    console.log(`Session times seeded for ${regionName}: ${times.join(", ")}`)
  }

  console.log("\n✅ Region migration completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
