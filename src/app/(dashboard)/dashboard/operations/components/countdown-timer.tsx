"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  startTime: Date
  duration: number // in minutes
  className?: string
}

export function CountdownTimer({ startTime, duration, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    const calculateRemaining = () => {
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + duration)
      const now = new Date()
      const diff = endTime.getTime() - now.getTime()
      return Math.max(0, Math.floor(diff / 1000 / 60))
    }

    setRemaining(calculateRemaining())

    const interval = setInterval(() => {
      setRemaining(calculateRemaining())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [startTime, duration])

  const hours = Math.floor(remaining / 60)
  const minutes = remaining % 60

  const isLow = remaining <= 15
  const isCritical = remaining <= 5

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm font-medium",
        isCritical && "text-red-600",
        isLow && !isCritical && "text-orange-500",
        !isLow && "text-green-600",
        className
      )}
    >
      <span>⏱</span>
      <span>
        {hours > 0 ? `${hours}sa ${minutes}dk` : `${minutes}dk`}
      </span>
    </div>
  )
}
