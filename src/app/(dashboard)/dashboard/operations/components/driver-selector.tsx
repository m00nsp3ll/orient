"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Car } from "lucide-react"
import { cn } from "@/lib/utils"

interface Driver {
  id: string
  phone: string
  isActive: boolean
  user: {
    id: string
    name: string
  }
}

interface DriverSelectorProps {
  drivers: Driver[]
  value?: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
  compact?: boolean
  busyDriverIds?: string[]
  currentDriverId?: string | null
}

export function DriverSelector({
  drivers,
  value,
  onValueChange,
  disabled,
  compact = false,
  busyDriverIds = [],
  currentDriverId,
}: DriverSelectorProps) {
  // Aktif şoförler, yolda olanları çıkar (mevcut atanmış şoför hariç)
  const availableDrivers = drivers.filter((d) =>
    d.isActive &&
    (!busyDriverIds.includes(d.id) || d.id === currentDriverId)
  )
  const selectedDriver = drivers.find((d) => d.id === value)

  return (
    <Select
      value={value || "unassigned"}
      onValueChange={(val) => onValueChange(val === "unassigned" ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "w-full",
          compact ? "h-6 text-[11px] px-2" : "h-8 text-xs"
        )}
      >
        <div className="flex items-center gap-1">
          <Car className={cn("text-slate-400", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          <SelectValue placeholder="Şoför Seç">
            {selectedDriver ? selectedDriver.user.name : "Şoför Seç"}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned" className="text-xs">
          <span className="text-muted-foreground">Atanmamış</span>
        </SelectItem>
        {availableDrivers.map((driver) => (
          <SelectItem key={driver.id} value={driver.id} className="text-xs">
            {driver.user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
