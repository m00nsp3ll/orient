import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Kota verileri ekleniyor...")

  // Delete existing quotas
  await prisma.timeSlotQuota.deleteMany({})

  // Time slots from 09:00 to 18:00 (30 min intervals)
  const timeSlots = [
    { start: "09:00", end: "09:30" },
    { start: "09:30", end: "10:00" },
    { start: "10:00", end: "10:30" },
    { start: "10:30", end: "11:00" },
    { start: "11:00", end: "11:30" },
    { start: "11:30", end: "12:00" },
    { start: "12:00", end: "12:30" },
    { start: "12:30", end: "13:00" },
    { start: "13:00", end: "13:30" },
    { start: "13:30", end: "14:00" },
    { start: "14:00", end: "14:30" },
    { start: "14:30", end: "15:00" },
    { start: "15:00", end: "15:30" },
    { start: "15:30", end: "16:00" },
    { start: "16:00", end: "16:30" },
    { start: "16:30", end: "17:00" },
    { start: "17:00", end: "17:30" },
    { start: "17:30", end: "18:00" },
  ]

  // Days 0-6 (Sunday-Saturday)
  const days = [0, 1, 2, 3, 4, 5, 6]

  const quotas = []
  for (const day of days) {
    for (const slot of timeSlots) {
      quotas.push({
        dayOfWeek: day,
        startTime: slot.start,
        endTime: slot.end,
        maxQuota: 5,
        isActive: true,
      })
    }
  }

  await prisma.timeSlotQuota.createMany({
    data: quotas,
  })

  console.log(`✓ ${quotas.length} kota eklendi (7 gün x 18 saat = 126 kota)`)
  console.log("Her saat için maksimum 5 kişi kotası tanımlandı")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
