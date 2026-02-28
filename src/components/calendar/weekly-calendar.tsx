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
} from "date-fns"
import { tr } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Banknote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  approvalStatus: string
  customerName?: string
  notes?: string
  restAmount?: number | null
  restCurrency?: string | null
  customer: { id: string; name: string; email: string; phone?: string } | null
  service: { name: string; duration: number; price: number }
  staff: { user: { name: string } } | null
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
  const [currentDate, setCurrentDate] = useState(new Date())

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

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

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {format(weekStart, "d MMM", { locale: tr })} -{" "}
          {format(weekEnd, "d MMM yyyy", { locale: tr })}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
          >
            Bugün
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-center text-sm text-gray-500 border-r" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 text-center border-r last:border-r-0",
                  isSameDay(day, new Date()) && "bg-primary/5"
                )}
              >
                <div className="text-sm font-medium">
                  {format(day, "EEEE", { locale: tr })}
                </div>
                <div
                  className={cn(
                    "text-2xl font-bold",
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
              <div key={hour} className="grid grid-cols-8 border-b">
                <div className="p-2 text-right text-sm text-gray-500 border-r pr-3">
                  {hour}:00
                </div>
                {days.map((day) => {
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
                        "min-h-[60px] p-1 border-r last:border-r-0 cursor-pointer hover:bg-gray-50",
                        isSameDay(day, new Date()) && "bg-primary/5"
                      )}
                      onClick={() =>
                        onSlotClick?.(day, `${hour.toString().padStart(2, "0")}:00`)
                      }
                    >
                      {hourAppointments.map((apt) => {
                        const isRest = apt.notes?.includes("REST")
                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              "text-xs p-1 rounded border mb-1 cursor-pointer",
                              getStatusColor(apt.status)
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick?.(apt)
                            }}
                          >
                            <div className="font-medium truncate flex items-center gap-1">
                              {isRest && <Banknote className="h-2.5 w-2.5 shrink-0 text-red-500" />}
                              {apt.customerName || apt.customer?.name || "-"}
                            </div>
                            <div className="truncate opacity-75">
                              {apt.service.name}
                            </div>
                            <div className="text-[10px] flex items-center justify-between">
                              <span>
                                {format(new Date(apt.startTime), "HH:mm")} -{" "}
                                {format(new Date(apt.endTime), "HH:mm")}
                              </span>
                              {isRest && apt.restAmount && apt.restCurrency && (
                                <span className="font-bold text-red-600">
                                  {apt.restAmount} {apt.restCurrency}
                                </span>
                              )}
                            </div>
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
