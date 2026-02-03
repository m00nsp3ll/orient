"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon, Building2, User, Search, X, Banknote } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const appointmentSchema = z.object({
  customerId: z.string().optional(),
  staffId: z.string().optional(),
  serviceId: z.string().min(1, "Program seçin"),
  date: z.date({ required_error: "Tarih seçin" }),
  time: z.string().min(1, "Saat seçin"),
  notes: z.string().optional(),
  // Agency specific fields
  agencyId: z.string().optional(),
  hotelId: z.string().optional(),
  pax: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  isRest: z.boolean().optional(),
})

type AppointmentFormData = z.infer<typeof appointmentSchema>

interface AppointmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: {
    customerId?: string
    staffId?: string
    serviceId?: string
    date?: Date
  }
}

export function AppointmentForm({
  open,
  onOpenChange,
  initialData,
}: AppointmentFormProps) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAgency = session?.user?.role === "AGENCY"
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "STAFF"

  const [entryMode, setEntryMode] = useState<"manual" | "agency">("manual")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialData?.date
  )
  const [selectedStaff, setSelectedStaff] = useState<string | undefined>(
    initialData?.staffId
  )
  const [selectedService, setSelectedService] = useState<string | undefined>(
    initialData?.serviceId
  )
  const [selectedAgency, setSelectedAgency] = useState<string | undefined>()
  const [hotelSearch, setHotelSearch] = useState("")
  const [showHotelDropdown, setShowHotelDropdown] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState<{ id: string; name: string; region?: { name: string }; distanceToMarina?: number | null } | null>(null)
  const [isRest, setIsRest] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      customerId: initialData?.customerId || "",
      staffId: initialData?.staffId || "",
      serviceId: initialData?.serviceId || "",
      notes: "",
      agencyId: "",
      hotelId: "",
      pax: "1",
      customerName: "",
      customerPhone: "",
      isRest: false,
    },
  })

  // Reset form when entry mode changes
  useEffect(() => {
    if (entryMode === "manual") {
      form.setValue("agencyId", "")
      form.setValue("hotelId", "")
      form.setValue("pax", "1")
      form.setValue("customerName", "")
      form.setValue("customerPhone", "")
      setSelectedAgency(undefined)
      setSelectedHotel(null)
      setHotelSearch("")
    } else {
      form.setValue("customerId", "")
    }
  }, [entryMode, form])

  // Reset service when isRest changes
  useEffect(() => {
    if (isRest) {
      form.setValue("serviceId", "")
      setSelectedService(undefined)
    }
  }, [isRest, form])

  const { data: customers } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      return res.json()
    },
    enabled: !isAgency && entryMode === "manual",
  })

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const res = await fetch("/api/agencies")
      if (!res.ok) throw new Error("Failed to fetch agencies")
      return res.json()
    },
    enabled: isAdmin && entryMode === "agency",
  })

  const { data: hotels } = useQuery({
    queryKey: ["hotels"],
    queryFn: async () => {
      const res = await fetch("/api/hotels")
      if (!res.ok) throw new Error("Failed to fetch hotels")
      return res.json()
    },
  })

  // Filter hotels based on search
  const filteredHotels = hotels?.filter((hotel: { name: string }) =>
    hotel.name.toLowerCase().includes(hotelSearch.toLowerCase())
  ).slice(0, 10) || []

  const { data: staff } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff")
      if (!res.ok) throw new Error("Failed to fetch staff")
      return res.json()
    },
  })

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services")
      if (!res.ok) throw new Error("Failed to fetch services")
      return res.json()
    },
  })

  const { data: availability } = useQuery({
    queryKey: ["availability", selectedService, selectedDate],
    queryFn: async () => {
      if (!selectedService || !selectedDate) return []
      const res = await fetch(
        `/api/availability?serviceId=${selectedService}&date=${format(selectedDate, "yyyy-MM-dd")}`
      )
      if (!res.ok) throw new Error("Failed to fetch availability")
      return res.json()
    },
    enabled: !!selectedService && !!selectedDate,
  })

  const createAppointment = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      const startTime = new Date(data.date)
      const [hours, minutes] = data.time.split(":")
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

      const payload: Record<string, unknown> = {
        serviceId: data.serviceId,
        startTime: startTime.toISOString(),
        notes: isRest ? "REST" : (data.notes || null),
        isRest,
        hotelId: data.hotelId || null,
        pax: data.pax ? parseInt(data.pax) : 1,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
      }

      if (isAgency || (isAdmin && entryMode === "agency")) {
        payload.agencyId = data.agencyId || null
      }

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Randevu oluşturulamadı")
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      toast.success("Randevu oluşturuldu")
      onOpenChange(false)
      form.reset()
      setEntryMode("manual")
      setIsRest(false)
      setSelectedHotel(null)
      setHotelSearch("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const onSubmit = (data: AppointmentFormData) => {
    createAppointment.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Yeni Randevu</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Admin Entry Mode Selector */}
            {isAdmin && (
              <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as "manual" | "agency")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Manuel Giriş
                  </TabsTrigger>
                  <TabsTrigger value="agency" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Acenta
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Agency Mode Fields (for Admin selecting agency or Agency user) */}
            {(isAgency || (isAdmin && entryMode === "agency")) && (
              /* Agency Selection (only for Admin in agency mode) */
              <FormField
                control={form.control}
                name="agencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acenta</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        setSelectedAgency(value)
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Acenta seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies?.map((agency: { id: string; companyName: string }) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Common Fields - Hotel, PAX, Customer Info */}
            <FormField
              control={form.control}
              name="hotelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Otel</FormLabel>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Otel ara..."
                          value={selectedHotel ? selectedHotel.name : hotelSearch}
                          onChange={(e) => {
                            setHotelSearch(e.target.value)
                            setShowHotelDropdown(e.target.value.length > 0)
                            if (selectedHotel) {
                              setSelectedHotel(null)
                              field.onChange("")
                            }
                          }}
                          onFocus={() => {
                            if (!selectedHotel && hotelSearch.length > 0) {
                              setShowHotelDropdown(true)
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowHotelDropdown(false), 200)}
                          className="pl-10"
                        />
                      </div>
                      {selectedHotel && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedHotel(null)
                            setHotelSearch("")
                            field.onChange("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {showHotelDropdown && filteredHotels.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredHotels.map((hotel: { id: string; name: string; region?: { name: string }; distanceToMarina?: number | null }) => (
                          <div
                            key={hotel.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                            onMouseDown={() => {
                              setSelectedHotel(hotel)
                              setHotelSearch("")
                              setShowHotelDropdown(false)
                              field.onChange(hotel.id)
                            }}
                          >
                            <span className="text-sm truncate">{hotel.name}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">{hotel.region?.name}</Badge>
                              {hotel.distanceToMarina && (
                                <span className="text-xs text-gray-500">{hotel.distanceToMarina} km</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showHotelDropdown && hotelSearch.length > 0 && filteredHotels.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg p-3 text-sm text-gray-500">
                        Otel bulunamadı
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAX (Kişi Sayısı)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Misafir Adı</FormLabel>
                    <FormControl>
                      <Input placeholder="Misafir adı" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Misafir Telefon (Opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="0532 123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rest Option - Ödeme Kapıda */}
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <input
                type="checkbox"
                id="isRest"
                checked={isRest}
                onChange={(e) => setIsRest(e.target.checked)}
                className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <Label htmlFor="isRest" className="text-sm font-medium cursor-pointer flex items-center gap-2 text-red-700">
                <Banknote className="h-4 w-4" />
                REST - Ödeme Kapıda
              </Label>
            </div>

            {/* Program Selection - Always visible */}
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value)
                      setSelectedService(value)
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Program seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services?.map(
                        (service: {
                          id: string
                          name: string
                          duration: number
                          price: number
                        }) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} ({service.duration} dk - {service.price}₺)
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Tarih</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: tr })
                          ) : (
                            <span>Tarih seçin</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date)
                          setSelectedDate(date)
                          setCalendarOpen(false)
                        }}
                        disabled={(date) => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          return date < today
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saat</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedService || !selectedDate}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedService || !selectedDate
                              ? "Önce program ve tarih seçin"
                              : availability?.filter((s: { available: boolean }) => s.available).length
                                ? "Saat seçin"
                                : "Müsait saat yok"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availability?.map(
                        (slot: { startTime: string; endTime: string; available: boolean; usedQuota: number; maxQuota: number }) => (
                          <SelectItem
                            key={slot.startTime}
                            value={slot.startTime}
                            disabled={!slot.available}
                          >
                            <span className="flex items-center justify-between w-full gap-4">
                              <span className={!slot.available ? "text-muted-foreground" : ""}>
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <Badge
                                variant={!slot.available ? "secondary" : slot.maxQuota - slot.usedQuota <= 2 ? "destructive" : "outline"}
                                className="text-xs ml-2"
                              >
                                ({slot.usedQuota}/{slot.maxQuota})
                              </Badge>
                            </span>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notlar (Opsiyonel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Randevu ile ilgili notlar..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={createAppointment.isPending}>
                {createAppointment.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
