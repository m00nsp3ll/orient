import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addMinutes, format, parse, isAfter, isBefore, startOfDay, endOfDay } from "date-fns"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get("staffId")
  const serviceId = searchParams.get("serviceId")
  const date = searchParams.get("date")
  const hotelId = searchParams.get("hotelId")

  if (!date) {
    return NextResponse.json({ error: "date parametresi gerekli" }, { status: 400 })
  }

  const [year, month, day] = date.split("-").map(Number)
  const selectedDate = new Date(year, month - 1, day)
  const dayOfWeek = selectedDate.getDay()

  let serviceDuration = 60
  if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } })
    if (!service) {
      return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 404 })
    }
    serviceDuration = service.duration
  }

  // Check if quota system is enabled
  const quotaSetting = await prisma.systemSetting.findUnique({ where: { key: "quotaEnabled" } })
  const quotaEnabled = quotaSetting?.value === "true"

  const dayStart = startOfDay(selectedDate)
  const dayEnd = endOfDay(selectedDate)

  const allAppointments = await prisma.appointment.findMany({
    where: {
      status: { not: "CANCELLED" },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: "asc" },
  })

  let workingHours = null
  let staffAppointments: typeof allAppointments = []
  let blockedTimes: { startTime: Date; endTime: Date }[] = []

  if (staffId) {
    workingHours = await prisma.workingHours.findUnique({
      where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
    })
    if (!workingHours || !workingHours.isActive) {
      return NextResponse.json([])
    }
    staffAppointments = allAppointments.filter(apt => apt.staffId === staffId)
    blockedTimes = await prisma.blockedTime.findMany({
      where: { staffId, startTime: { lte: dayEnd }, endTime: { gte: dayStart } },
    })
  }

  // If hotelId is provided, return region-based session times
  if (hotelId) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { regionId: true },
    })
    if (!hotel) {
      return NextResponse.json([])
    }

    // Resolve pickupTimeRegionId
    const region = await prisma.region.findUnique({
      where: { id: hotel.regionId },
      select: { pickupTimeRegionId: true },
    })
    const effectiveRegionId = region?.pickupTimeRegionId || hotel.regionId

    const sessionTimes = await prisma.regionSessionTime.findMany({
      where: { regionId: effectiveRegionId, isActive: true },
      orderBy: { time: "asc" },
    })

    if (sessionTimes.length === 0) {
      return generateDefaultSlots(selectedDate, serviceDuration, quotaEnabled, allAppointments, workingHours, staffId, staffAppointments, blockedTimes)
    }

    const slots: { startTime: string; available: boolean; remainingQuota: number; usedQuota: number; maxQuota: number }[] = []

    for (const st of sessionTimes) {
      const [slotHour, slotMin] = st.time.split(":").map(Number)
      const now = new Date()
      const isToday = selectedDate.getFullYear() === now.getFullYear() &&
                      selectedDate.getMonth() === now.getMonth() &&
                      selectedDate.getDate() === now.getDate()
      const isPast = isToday && (slotHour < now.getHours() || (slotHour === now.getHours() && slotMin <= now.getMinutes()))

      // Quota from RegionSessionTime.maxQuota
      const maxQuota = (quotaEnabled && st.maxQuota > 0) ? st.maxQuota : 999
      const appointmentsInSlot = allAppointments.filter(apt => format(new Date(apt.startTime), "HH:mm") === st.time)
      const currentCount = appointmentsInSlot.length
      const remainingQuota = Math.max(0, maxQuota - currentCount)
      const quotaFull = remainingQuota === 0

      let hasConflict = false
      let isBlocked = false

      if (staffId) {
        const slotStart = parse(st.time, "HH:mm", selectedDate)
        const slotEnd = addMinutes(slotStart, serviceDuration)

        hasConflict = staffAppointments.some((apt) =>
          ((isAfter(slotStart, apt.startTime) || format(slotStart, "HH:mm:ss") === format(apt.startTime, "HH:mm:ss")) && isBefore(slotStart, apt.endTime)) ||
          (isAfter(slotEnd, apt.startTime) && (isBefore(slotEnd, apt.endTime) || format(slotEnd, "HH:mm:ss") === format(apt.endTime, "HH:mm:ss"))) ||
          ((isBefore(slotStart, apt.startTime) || format(slotStart, "HH:mm:ss") === format(apt.startTime, "HH:mm:ss")) && (isAfter(slotEnd, apt.endTime) || format(slotEnd, "HH:mm:ss") === format(apt.endTime, "HH:mm:ss")))
        )

        isBlocked = blockedTimes.some((block) =>
          (isAfter(slotStart, block.startTime) && isBefore(slotStart, block.endTime)) ||
          (isAfter(slotEnd, block.startTime) && isBefore(slotEnd, block.endTime)) ||
          (isBefore(slotStart, block.startTime) && isAfter(slotEnd, block.endTime))
        )
      }

      slots.push({
        startTime: st.time,
        available: !isPast && !hasConflict && !isBlocked && !quotaFull,
        remainingQuota,
        usedQuota: currentCount,
        maxQuota,
      })
    }

    return NextResponse.json(slots)
  }

  return generateDefaultSlots(selectedDate, serviceDuration, quotaEnabled, allAppointments, workingHours, staffId, staffAppointments, blockedTimes)
}

function generateDefaultSlots(
  selectedDate: Date,
  serviceDuration: number,
  quotaEnabled: boolean,
  allAppointments: { startTime: Date; endTime: Date; staffId: string | null }[],
  workingHours: { startTime: string; endTime: string } | null,
  staffId: string | null,
  staffAppointments: { startTime: Date; endTime: Date; staffId: string | null }[],
  blockedTimes: { startTime: Date; endTime: Date }[],
) {
  const slots: { startTime: string; endTime: string; available: boolean; remainingQuota: number; usedQuota: number; maxQuota: number }[] = []
  const slotDuration = 30

  const workStart = parse(workingHours?.startTime || "09:00", "HH:mm", selectedDate)
  const workEnd = parse(workingHours?.endTime || "18:00", "HH:mm", selectedDate)

  let currentSlot = workStart

  while (isBefore(addMinutes(currentSlot, serviceDuration), workEnd) ||
         format(addMinutes(currentSlot, serviceDuration), "HH:mm") === format(workEnd, "HH:mm")) {
    const slotEnd = addMinutes(currentSlot, serviceDuration)
    const slotTimeStr = format(currentSlot, "HH:mm")

    const now = new Date()
    const isToday = selectedDate.getFullYear() === now.getFullYear() &&
                    selectedDate.getMonth() === now.getMonth() &&
                    selectedDate.getDate() === now.getDate()
    const [slotHour, slotMin] = slotTimeStr.split(":").map(Number)
    const isPast = isToday && (slotHour < now.getHours() || (slotHour === now.getHours() && slotMin <= now.getMinutes()))

    // Default slots: no quota unless quotaEnabled + old TimeSlotQuota exists
    const maxQuota = 999
    const appointmentsInSlot = allAppointments.filter(apt => format(new Date(apt.startTime), "HH:mm") === slotTimeStr)
    const currentCount = appointmentsInSlot.length
    const remainingQuota = Math.max(0, maxQuota - currentCount)
    const quotaFull = remainingQuota === 0

    let hasConflict = false
    let isBlocked = false

    if (staffId) {
      hasConflict = staffAppointments.some((apt) =>
        ((isAfter(currentSlot, apt.startTime) || format(currentSlot, "HH:mm:ss") === format(apt.startTime, "HH:mm:ss")) && isBefore(currentSlot, apt.endTime)) ||
        (isAfter(slotEnd, apt.startTime) && (isBefore(slotEnd, apt.endTime) || format(slotEnd, "HH:mm:ss") === format(apt.endTime, "HH:mm:ss"))) ||
        ((isBefore(currentSlot, apt.startTime) || format(currentSlot, "HH:mm:ss") === format(apt.startTime, "HH:mm:ss")) && (isAfter(slotEnd, apt.endTime) || format(slotEnd, "HH:mm:ss") === format(apt.endTime, "HH:mm:ss")))
      )

      isBlocked = blockedTimes.some((block) =>
        (isAfter(currentSlot, block.startTime) && isBefore(currentSlot, block.endTime)) ||
        (isAfter(slotEnd, block.startTime) && isBefore(slotEnd, block.endTime)) ||
        (isBefore(currentSlot, block.startTime) && isAfter(slotEnd, block.endTime))
      )
    }

    slots.push({
      startTime: format(currentSlot, "HH:mm"),
      endTime: format(slotEnd, "HH:mm"),
      available: !isPast && !hasConflict && !isBlocked && !quotaFull,
      remainingQuota,
      usedQuota: currentCount,
      maxQuota,
    })

    currentSlot = addMinutes(currentSlot, slotDuration)
  }

  return NextResponse.json(slots)
}
