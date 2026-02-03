import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addMinutes, format, parse, isAfter, isBefore, startOfDay, endOfDay } from "date-fns"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get("staffId")
  const serviceId = searchParams.get("serviceId")
  const date = searchParams.get("date")

  if (!serviceId || !date) {
    return NextResponse.json(
      { error: "serviceId ve date parametreleri gerekli" },
      { status: 400 }
    )
  }

  // Parse date in local timezone (avoid UTC issues)
  const [year, month, day] = date.split("-").map(Number)
  const selectedDate = new Date(year, month - 1, day)
  const dayOfWeek = selectedDate.getDay()

  // Get service duration
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  })

  if (!service) {
    return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 404 })
  }

  // Get quotas for this day
  const quotas = await prisma.timeSlotQuota.findMany({
    where: {
      dayOfWeek,
      isActive: true,
    },
    orderBy: { startTime: "asc" },
  })

  // Get all appointments for this date (for quota check)
  const dayStart = startOfDay(selectedDate)
  const dayEnd = endOfDay(selectedDate)

  const allAppointments = await prisma.appointment.findMany({
    where: {
      status: { not: "CANCELLED" },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: "asc" },
  })

  // If staffId is provided, also check staff-specific availability
  let workingHours = null
  let staffAppointments: typeof allAppointments = []
  let blockedTimes: { startTime: Date; endTime: Date }[] = []

  if (staffId) {
    workingHours = await prisma.workingHours.findUnique({
      where: {
        staffId_dayOfWeek: {
          staffId,
          dayOfWeek,
        },
      },
    })

    if (!workingHours || !workingHours.isActive) {
      return NextResponse.json([])
    }

    staffAppointments = allAppointments.filter(apt => apt.staffId === staffId)

    blockedTimes = await prisma.blockedTime.findMany({
      where: {
        staffId,
        startTime: { lte: dayEnd },
        endTime: { gte: dayStart },
      },
    })
  }

  // Generate time slots
  const slots: { startTime: string; endTime: string; available: boolean; remainingQuota: number; usedQuota: number; maxQuota: number }[] = []
  const slotDuration = 30

  // Use working hours if staff selected, otherwise use default 09:00-18:00
  const workStart = parse(workingHours?.startTime || "09:00", "HH:mm", selectedDate)
  const workEnd = parse(workingHours?.endTime || "18:00", "HH:mm", selectedDate)

  let currentSlot = workStart

  while (isBefore(addMinutes(currentSlot, service.duration), workEnd) ||
         format(addMinutes(currentSlot, service.duration), "HH:mm") === format(workEnd, "HH:mm")) {
    const slotEnd = addMinutes(currentSlot, service.duration)
    const slotTimeStr = format(currentSlot, "HH:mm")

    // Check if slot is in the past (only for today)
    const now = new Date()
    const isToday = selectedDate.getFullYear() === now.getFullYear() &&
                    selectedDate.getMonth() === now.getMonth() &&
                    selectedDate.getDate() === now.getDate()

    // Compare hours and minutes directly for today
    const [slotHour, slotMin] = slotTimeStr.split(":").map(Number)
    const nowHour = now.getHours()
    const nowMin = now.getMinutes()
    const isPast = isToday && (slotHour < nowHour || (slotHour === nowHour && slotMin <= nowMin))

    // Check quota for this time slot
    const quota = quotas.find(q => q.startTime === slotTimeStr)
    const maxQuota = quota?.maxQuota ?? 999 // No limit if no quota defined

    // Count appointments in this time slot
    const appointmentsInSlot = allAppointments.filter(apt => {
      const aptTime = format(new Date(apt.startTime), "HH:mm")
      return aptTime === slotTimeStr
    })
    const currentCount = appointmentsInSlot.length
    const remainingQuota = Math.max(0, maxQuota - currentCount)
    const quotaFull = remainingQuota === 0

    // Check for staff-specific conflicts (if staffId provided)
    let hasConflict = false
    let isBlocked = false

    if (staffId) {
      hasConflict = staffAppointments.some((apt) => {
        return (
          (isAfter(currentSlot, apt.startTime) || format(currentSlot, "HH:mm:ss") === format(apt.startTime, "HH:mm:ss")) &&
          isBefore(currentSlot, apt.endTime)
        ) || (
          isAfter(slotEnd, apt.startTime) &&
          (isBefore(slotEnd, apt.endTime) || format(slotEnd, "HH:mm:ss") === format(apt.endTime, "HH:mm:ss"))
        ) || (
          (isBefore(currentSlot, apt.startTime) || format(currentSlot, "HH:mm:ss") === format(apt.startTime, "HH:mm:ss")) &&
          (isAfter(slotEnd, apt.endTime) || format(slotEnd, "HH:mm:ss") === format(apt.endTime, "HH:mm:ss"))
        )
      })

      isBlocked = blockedTimes.some((block) => {
        return (
          (isAfter(currentSlot, block.startTime) && isBefore(currentSlot, block.endTime)) ||
          (isAfter(slotEnd, block.startTime) && isBefore(slotEnd, block.endTime)) ||
          (isBefore(currentSlot, block.startTime) && isAfter(slotEnd, block.endTime))
        )
      })
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
