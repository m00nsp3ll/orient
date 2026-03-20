"use client"

import { useMemo, useState, useEffect } from "react"
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns"
import { tr } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Banknote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-media-query"

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  approvalStatus: string
  customerName?: string
  pax?: number
  childCount?: number
  notes?: string
  restAmount?: number | null
  restCurrency?: string | null
  customer: { id: string; name: string; email: string; phone?: string } | null
  service: { name: string; price: number }
  staff: { user: { name: string } } | null
  agency?: { id: string; name: string; companyName: string | null } | null
}

interface WeeklyCalendarProps {
  appointments: Appointment[]
  onAppointmentClick?: (appointment: Appointment) => void
  onSlotClick?: (date: Date, time: string) => void
  onWeekChange?: (weekStart: Date, weekEnd: Date) => void
}

const hours = Array.from({ length: 12 }, (_, i) => i + 9) // 9:00 - 20:00

export function WeeklyCalendar({
  appointments,
  onAppointmentClick,
  onSlotClick,
  onWeekChange,
}: WeeklyCalendarProps) {
  const isMobile = useIsMobile()
  const [currentDate, setCurrentDate] = useState(new Date())

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Mobilde 3 günlük görünüm: seçili gün merkez
  const mobileDays = useMemo(() => {
    if (!isMobile) return days
    return [
      subDays(currentDate, 1),
      currentDate,
      addDays(currentDate, 1),
    ]
  }, [isMobile, currentDate, days])

  const visibleDays = isMobile ? mobileDays : days

  // Notify parent when week changes
  useEffect(() => {
    onWeekChange?.(weekStart, weekEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), weekEnd.getTime()])

  const appointmentsByDay = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {}
    appointments.forEach((apt) => {
      const dateKey = format(new Date(apt.startTime), "yyyy-MM-dd")
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(apt)
    })
    return grouped
  }, [appointments])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-blue-100 border-blue-300 text-blue-800"
      case "PENDING":
        return "bg-yellow-100 border-yellow-300 text-yellow-800"
      case "COMPLETED":
        return "bg-green-100 border-green-300 text-green-800"
      case "CANCELLED":
        return "bg-red-100 border-red-300 text-red-800"
      default:
        return "bg-gray-100 border-gray-300 text-gray-800"
    }
  }

  const handlePrev = () => {
    if (isMobile) {
      setCurrentDate(subDays(currentDate, 1))
    } else {
      setCurrentDate(subWeeks(currentDate, 1))
    }
  }

  const handleNext = () => {
    if (isMobile) {
      setCurrentDate(addDays(currentDate, 1))
    } else {
      setCurrentDate(addWeeks(currentDate, 1))
    }
  }

  // Grid columns: 1 (hour label) + number of visible days
  const gridCols = isMobile ? "grid-cols-4" : "grid-cols-8"

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b">
        <h2 className="text-sm md:text-lg font-semibold">
          {isMobile ? (
            format(currentDate, "d MMMM yyyy, EEEE", { locale: tr })
          ) : (
            <>
              {format(weekStart, "d MMM", { locale: tr })} -{" "}
              {format(weekEnd, "d MMM yyyy", { locale: tr })}
            </>
          )}
        </h2>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Bugün
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className={isMobile ? "" : "min-w-[800px]"}>
          {/* Day Headers */}
          <div className={cn("grid border-b", gridCols)}>
            <div className="p-2 text-center text-sm text-gray-500 border-r" />
            {visibleDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 text-center border-r last:border-r-0",
                  isSameDay(day, new Date()) && "bg-primary/5"
                )}
              >
                <div className="text-xs md:text-sm font-medium">
                  {isMobile
                    ? format(day, "EEE", { locale: tr })
                    : format(day, "EEEE", { locale: tr })}
                </div>
                <div
                  className={cn(
                    "text-lg md:text-2xl font-bold",
                    isSameDay(day, new Date()) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className={cn("grid border-b", gridCols)}>
                <div className="p-1 md:p-2 text-right text-xs md:text-sm text-gray-500 border-r pr-1 md:pr-3">
                  {hour}:00
                </div>
                {visibleDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd")
                  const dayAppointments = appointmentsByDay[dateKey] || []
                  const hourAppointments = dayAppointments.filter((apt) => {
                    const aptHour = new Date(apt.startTime).getHours()
                    return aptHour === hour
                  })

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[50px] md:min-h-[60px] p-0.5 md:p-1 border-r last:border-r-0 cursor-pointer hover:bg-gray-50",
                        isSameDay(day, new Date()) && "bg-primary/5"
                      )}
                      onClick={() =>
                        onSlotClick?.(day, `${hour.toString().padStart(2, "0")}:00`)
                      }
                    >
                      {hourAppointments.map((apt) => {
                        const isRest = apt.restAmount != null && apt.restAmount > 0
                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              "text-[10px] md:text-xs p-0.5 md:p-1 rounded border mb-0.5 md:mb-1 cursor-pointer overflow-hidden",
                              getStatusColor(apt.status)
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick?.(apt)
                            }}
                          >
                            <div className="font-medium truncate flex items-center gap-0.5">
                              {isRest && <Banknote className="h-2.5 w-2.5 shrink-0 text-red-500" />}
                              <span className="truncate">
                                {apt.agency?.companyName || apt.agency?.name || apt.customerName || apt.customer?.name || "-"}
                              </span>
                            </div>
                            <div className="truncate opacity-75">
                              {isMobile
                                ? `${apt.pax || ""}${apt.childCount ? `+${apt.childCount}` : ""} PAX`
                                : `${apt.service.name}${apt.pax && apt.pax > 0 ? ` • ${apt.pax}${apt.childCount ? `+${apt.childCount}` : ""} PAX` : ""}`}
                            </div>
                            {!isMobile && (
                              <div className="text-[10px] flex items-center justify-between">
                                <span>
                                  {format(new Date(apt.startTime), "HH:mm")}
                                </span>
                                {isRest && apt.restAmount && apt.restCurrency && (
                                  <span className="font-bold text-red-600">
                                    {apt.restAmount} {apt.restCurrency}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
