import { prisma } from "@/lib/prisma"

export async function getEffectiveSessionTimes(regionId: string): Promise<string[]> {
  // Check if this region has a pickupTimeRegionId (e.g. Payallar → Okurcalar)
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    select: { pickupTimeRegionId: true },
  })

  const effectiveRegionId = region?.pickupTimeRegionId || regionId

  const sessionTimes = await prisma.regionSessionTime.findMany({
    where: {
      regionId: effectiveRegionId,
      isActive: true,
    },
    orderBy: { time: "asc" },
    select: { time: true },
  })

  return sessionTimes.map((st) => st.time)
}

export async function getSessionTimesForHotel(hotelId: string): Promise<string[]> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { regionId: true },
  })

  if (!hotel) return []

  return getEffectiveSessionTimes(hotel.regionId)
}
