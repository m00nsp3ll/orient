"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon, Building2, User, Search, X, Banknote, Plus, Trash2, Minus, Clock, MapPin, Phone, FileText } from "lucide-react"
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
  serviceId: z.string().optional(),
  date: z.date({
    message: "Tarih seçin",
  }),
  time: z.string().min(1, "Saat seçin"),
  notes: z.string().optional(),
  agencyId: z.string().optional(),
  hotelId: z.string().min(1, "Otel seçin"),
  pax: z.number().min(1, "En az 1 kişi seçin"),
  customerName: z.string().min(1, "Müşteri adı girin"),
  customerPhone: z.string().optional(),
  isRest: z.boolean().optional(),
  restAmount: z.number().optional(),
  restCurrency: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.isRest) {
    if (!data.restAmount || data.restAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REST seçildiğinde tutar girilmelidir",
        path: ["restAmount"],
      })
    }
    if (!data.restCurrency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REST seçildiğinde para birimi seçilmelidir",
        path: ["restCurrency"],
      })
    }
  }
})

type AppointmentFormData = z.infer<typeof appointmentSchema>

interface CartItem {
  id: string
  name: string
  price: number
  duration: number
  quantity: number
  category?: { name: string }
}

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
  const [selectedService, setSelectedService] = useState<string | undefined>(
    initialData?.serviceId
  )
  const [hotelSearch, setHotelSearch] = useState("")
  const [showHotelDropdown, setShowHotelDropdown] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState<{ id: string; name: string; region?: { name: string }; distanceToMarina?: number | null } | null>(null)
  const [isRest, setIsRest] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = (service: Omit<CartItem, 'quantity'>) => {
    const pax = form.watch("pax") || 0
    const totalPackages = cart.reduce((sum, item) => sum + item.quantity, 0)

    if (totalPackages >= pax) {
      toast.error(`Maksimum ${pax} paket ekleyebilirsiniz`)
      return
    }

    const existingItem = cart.find(item => item.id === service.id)
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === service.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
      toast.success(`${service.name} miktarı artırıldı`)
    } else {
      setCart([...cart, { ...service, quantity: 1 }])
      toast.success(`${service.name} sepete eklendi`)
    }
  }

  const increaseQuantity = (serviceId: string) => {
    const pax = form.watch("pax") || 0
    const totalPackages = cart.reduce((sum, item) => sum + item.quantity, 0)

    if (totalPackages >= pax) {
      toast.error(`Maksimum ${pax} paket ekleyebilirsiniz`)
      return
    }

    setCart(cart.map(item =>
      item.id === serviceId
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ))
  }

  const decreaseQuantity = (serviceId: string) => {
    setCart(cart.map(item => {
      if (item.id === serviceId) {
        if (item.quantity === 1) {
          return item
        }
        return { ...item, quantity: item.quantity - 1 }
      }
      return item
    }))
  }

  const removeFromCart = (serviceId: string) => {
    setCart(cart.filter(item => item.id !== serviceId))
    toast.success("Hizmet sepetten çıkarıldı")
  }

  const getTotalDuration = () => cart.reduce((sum, item) => sum + (item.duration * item.quantity), 0)
  const getTotalPrice = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const getTotalPackages = () => cart.reduce((sum, item) => sum + item.quantity, 0)
  const getPaxTotal = () => getTotalPrice()

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      customerId: initialData?.customerId || "",
      staffId: initialData?.staffId || "",
      serviceId: initialData?.serviceId || "",
      notes: "",
      agencyId: "",
      hotelId: "",
      pax: 0,
      customerName: "",
      customerPhone: "",
      isRest: false,
      restAmount: undefined,
      restCurrency: undefined,
    },
  })

  const { data: userAgency } = useQuery({
    queryKey: ["user-agency", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/agencies/me")
      if (!res.ok) throw new Error("Failed to fetch user agency")
      return res.json()
    },
    enabled: isAgency,
  })

  useEffect(() => {
    if (entryMode === "manual") {
      form.setValue("agencyId", "")
      form.setValue("hotelId", "")
      form.setValue("pax", 0)
      form.setValue("customerName", "")
      form.setValue("customerPhone", "")
      setSelectedHotel(null)
      setHotelSearch("")
    } else {
      form.setValue("customerId", "")
    }
  }, [entryMode, form])

  useEffect(() => {
    if (isRest) {
      form.setValue("serviceId", "")
      setSelectedService(undefined)
    } else {
      form.setValue("restAmount", undefined)
      form.setValue("restCurrency", undefined)
    }
  }, [isRest, form])

  useEffect(() => {
    if (isAgency && userAgency?.id) {
      form.setValue("agencyId", userAgency.id)
    }
  }, [isAgency, userAgency, form])

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

  const filteredHotels = hotels?.filter((hotel: { name: string }) =>
    hotel.name.toLowerCase().includes(hotelSearch.toLowerCase())
  ).slice(0, 10) || []

  const { data: services } = useQuery({
    queryKey: ["services-allowed"],
    queryFn: async () => {
      const res = await fetch("/api/services/allowed")
      if (!res.ok) throw new Error("Failed to fetch services")
      return res.json()
    },
  })

  const { data: availability } = useQuery({
    queryKey: ["availability", selectedDate, selectedHotel?.id],
    queryFn: async () => {
      if (!selectedDate) return []
      let url = `/api/availability?date=${format(selectedDate, "yyyy-MM-dd")}`
      if (selectedHotel?.id) {
        url += `&hotelId=${selectedHotel.id}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch availability")
      return res.json()
    },
    enabled: !!selectedDate && !!selectedHotel,
  })

  const createAppointment = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      if (cart.length === 0) {
        throw new Error("Lütfen en az bir paket seçin")
      }

      const startTime = new Date(data.date)
      const [hours, minutes] = data.time.split(":")
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

      const payload: Record<string, unknown> = {
        serviceId: cart[0].id,
        startTime: startTime.toISOString(),
        notes: isRest ? "REST" : (data.notes || null),
        isRest,
        restAmount: isRest ? data.restAmount : undefined,
        restCurrency: isRest ? data.restCurrency : undefined,
        hotelId: data.hotelId || null,
        pax: data.pax || 1,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        services: cart.map(item => ({
          id: item.id,
          price: item.price,
          duration: item.duration,
        })),
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
      queryClient.invalidateQueries({ queryKey: ["pending-appointments"] })
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["appointments", "today"] })
      toast.success("Randevu oluşturuldu")
      onOpenChange(false)
      form.reset()
      setEntryMode("manual")
      setIsRest(false)
      setSelectedHotel(null)
      setHotelSearch("")
      setCart([])
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
      <DialogContent className="w-full !max-w-[1200px] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Yeni Randevu</DialogTitle>
          </DialogHeader>

          {isAdmin && (
            <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as "manual" | "agency")} className="w-full mt-3">
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
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x">
              {/* SOL KOLON */}
              <div className="p-6 space-y-5">
                {/* Bolum 1: Otel & Misafir */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                    <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center">
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-sm text-blue-900">Otel & Misafir</h3>
                  </div>

                  {(isAgency || (isAdmin && entryMode === "agency")) && (
                    <FormField
                      control={form.control}
                      name="agencyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-gray-600">Acenta</FormLabel>
                          {isAgency ? (
                            <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                              <Building2 className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-sm">
                                {userAgency?.companyName || userAgency?.name || "Acenta"}
                              </span>
                            </div>
                          ) : (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10">
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
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="hotelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-gray-600">Otel</FormLabel>
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
                                className={cn("pl-10 h-10", selectedHotel && "bg-blue-50 border-blue-200 font-medium")}
                              />
                            </div>
                            {selectedHotel && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
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
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                                  onMouseDown={() => {
                                    setSelectedHotel(hotel)
                                    setHotelSearch("")
                                    setShowHotelDropdown(false)
                                    field.onChange(hotel.id)
                                    form.setValue("time", "")
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

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="pax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-gray-600">PAX (Kişi)</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-1 border rounded-lg h-10 bg-white">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  const currentPax = field.value || 0
                                  if (currentPax > 0) field.onChange(currentPax - 1)
                                }}
                                disabled={!field.value || field.value === 0}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <div className="flex-1 text-center">
                                <span className="text-lg font-bold text-blue-600">
                                  {field.value || 0}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => field.onChange((field.value || 0) + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-gray-600">Telefon</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                              <Input placeholder="0532 123 4567" className="pl-9 h-10" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-gray-600">Misafir Adı</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input placeholder="Misafir adı soyadı" className="pl-9 h-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Bolum 2: Tarih & Saat */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                    <div className="h-6 w-6 rounded bg-emerald-100 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-sm text-emerald-900">Tarih & Saat</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs font-medium text-gray-600">Tarih</FormLabel>
                          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full h-10 pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                    field.value && "bg-emerald-50 border-emerald-200 font-medium"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "dd MMM yyyy", { locale: tr })
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
                          <FormLabel className="text-xs font-medium text-gray-600">Saat</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedDate || !selectedHotel}
                          >
                            <FormControl>
                              <SelectTrigger className={cn("h-10", field.value && "bg-emerald-50 border-emerald-200 font-medium")}>
                                <SelectValue
                                  placeholder={
                                    !selectedHotel
                                      ? "Önce otel seçin"
                                      : !selectedDate
                                        ? "Önce tarih seçin"
                                        : availability?.filter((s: { available: boolean }) => s.available).length
                                          ? "Saat seçin"
                                          : "Müsait saat yok"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availability?.map(
                                (slot: { startTime: string; endTime?: string; available: boolean; usedQuota: number; maxQuota: number }) => (
                                  <SelectItem
                                    key={slot.startTime}
                                    value={slot.startTime}
                                    disabled={!slot.available}
                                  >
                                    <span className="flex items-center justify-between w-full gap-4">
                                      <span className={!slot.available ? "text-muted-foreground" : ""}>
                                        {slot.startTime}
                                      </span>
                                      {slot.maxQuota < 999 && (
                                        <Badge
                                          variant={!slot.available ? "secondary" : slot.maxQuota - slot.usedQuota <= 2 ? "destructive" : "outline"}
                                          className="text-xs ml-2"
                                        >
                                          ({slot.usedQuota}/{slot.maxQuota})
                                        </Badge>
                                      )}
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
                  </div>
                </div>

                {/* Bolum 3: REST */}
                <div className={cn(
                  "rounded-lg border-2 transition-all",
                  isRest
                    ? "border-rose-500 bg-rose-50 shadow-md"
                    : "border-red-200 bg-red-50"
                )}>
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => setIsRest(!isRest)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-lg",
                        isRest ? "bg-rose-200 text-rose-700" : "bg-red-100 text-red-400"
                      )}>
                        <Banknote className="h-4 w-4" />
                      </div>
                      <span className={cn(
                        "text-sm font-semibold",
                        isRest ? "text-rose-800" : "text-red-500"
                      )}>
                        REST - Ödeme Kapıda
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="isRest"
                      checked={isRest}
                      onChange={(e) => setIsRest(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 rounded border-red-300 text-rose-600 focus:ring-rose-500"
                    />
                  </div>

                  {isRest && (
                    <div className="px-3 pb-3 space-y-3 border-t border-rose-300 pt-3">
                      <FormField
                        control={form.control}
                        name="restCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-rose-700">Para Birimi</FormLabel>
                            <div style={{display: "flex", gap: "8px", width: "100%"}}>
                              {[
                                { value: "EUR", symbol: "€", bg: "bg-blue-600 hover:bg-blue-700", ring: "ring-blue-300" },
                                { value: "USD", symbol: "$", bg: "bg-emerald-600 hover:bg-emerald-700", ring: "ring-emerald-300" },
                                { value: "GBP", symbol: "£", bg: "bg-purple-600 hover:bg-purple-700", ring: "ring-purple-300" },
                                { value: "TRY", symbol: "₺", bg: "bg-orange-500 hover:bg-orange-600", ring: "ring-orange-300" },
                              ].map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  style={{flex: "1 1 0", minWidth: 0}}
                                  className={cn(
                                    "h-11 text-sm font-bold rounded-md transition-all border",
                                    field.value === c.value
                                      ? `${c.bg} text-white shadow-lg ring-2 ${c.ring}`
                                      : "bg-white text-gray-600 border-gray-200 shadow-sm"
                                  )}
                                  onClick={() => field.onChange(c.value)}
                                >
                                  {c.symbol} {c.value}
                                </button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="restAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-rose-700">Tutar</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={1}
                                  placeholder="0.00"
                                  className="h-11 text-lg font-semibold pl-3 pr-14 bg-white border-rose-200 focus:border-rose-400"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                />
                                {form.watch("restCurrency") && (
                                  <span className={cn(
                                    "absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold px-2 py-0.5 rounded",
                                    form.watch("restCurrency") === "EUR" ? "bg-blue-100 text-blue-700" :
                                    form.watch("restCurrency") === "USD" ? "bg-emerald-100 text-emerald-700" :
                                    form.watch("restCurrency") === "GBP" ? "bg-purple-100 text-purple-700" :
                                    "bg-orange-100 text-orange-700"
                                  )}>
                                    {form.watch("restCurrency") === "EUR" ? "\u20ac" : form.watch("restCurrency") === "USD" ? "$" : form.watch("restCurrency") === "GBP" ? "\u00a3" : "\u20ba"}
                                  </span>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Notlar */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        Notlar (Opsiyonel)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Randevu ile ilgili notlar..."
                          className="resize-none h-16"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* SAG KOLON - Paket Secimleri */}
              <div className="p-6 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between pb-2 border-b border-violet-100">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-violet-100 flex items-center justify-center">
                      <Plus className="h-3.5 w-3.5 text-violet-600" />
                    </div>
                    <h3 className="font-semibold text-sm text-violet-900">Programlar</h3>
                  </div>
                  {form.watch("pax") > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                      {getTotalPackages()}/{form.watch("pax")} pax
                    </Badge>
                  )}
                </div>

                {(!form.watch("pax") || form.watch("pax") === 0) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <User className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 font-medium">
                      Paket seçmeden önce lütfen PAX (kişi sayısı) girin
                    </span>
                  </div>
                )}

                {(!selectedDate || !form.watch("time")) && form.watch("pax") > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">
                      Program seçmeden önce lütfen tarih ve saat seçin
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => setSelectedService(value)}
                    value={selectedService}
                    disabled={!form.watch("pax") || form.watch("pax") === 0 || !selectedDate || !form.watch("time") || getTotalPackages() >= (form.watch("pax") || 0)}
                  >
                    <SelectTrigger className="flex-1 h-10">
                      <SelectValue placeholder={
                        !selectedDate || !form.watch("time")
                          ? "Önce tarih ve saat seçin"
                          : getTotalPackages() >= (form.watch("pax") || 0)
                            ? "Maksimum paket sayısına ulaşıldı"
                            : "Program seçin"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service: any) => (
                        <SelectItem key={service.id} value={service.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{service.name}</span>
                            <span className="ml-4 text-xs text-gray-500">
                              {service.duration} dk • {service.price}₺
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="h-10 bg-violet-600 hover:bg-violet-700"
                    onClick={() => {
                      if (!selectedService) {
                        toast.error("Lütfen bir program seçin")
                        return
                      }
                      const service = services?.find((s: any) => s.id === selectedService)
                      if (service) {
                        addToCart({
                          id: service.id,
                          name: service.name,
                          price: service.price,
                          duration: service.duration,
                          category: service.category,
                        })
                      }
                    }}
                    disabled={!selectedService || !form.watch("pax") || form.watch("pax") === 0 || !selectedDate || !form.watch("time") || getTotalPackages() >= (form.watch("pax") || 0)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {cart.length > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b">
                      <Label className="text-xs font-semibold text-gray-700">Seçilen Paketler</Label>
                      <Badge variant="secondary" className="text-xs">{getTotalPackages()} paket</Badge>
                    </div>

                    <div className="divide-y">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.category && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {item.category.name}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {item.duration} dk • {item.price}₺
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            <div className="flex items-center border rounded-lg">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => decreaseQuantity(item.id)}
                                disabled={item.quantity === 1}
                              >
                                <span className="text-sm">−</span>
                              </Button>
                              <span className="min-w-6 text-center font-semibold text-sm">
                                {item.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => increaseQuantity(item.id)}
                                disabled={getTotalPackages() >= (form.watch("pax") || 0)}
                              >
                                <span className="text-sm">+</span>
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 border-t px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Toplam Süre</span>
                        <span className="font-medium text-gray-700">{getTotalDuration()} dakika</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t">
                        <span className="font-semibold text-sm">Toplam Tutar</span>
                        <span className="font-bold text-lg text-blue-600">
                          {getPaxTotal()}₺
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {cart.length === 0 && (
                  <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg">
                    <Plus className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Henüz paket seçilmedi</p>
                  </div>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <input type="hidden" {...field} value={cart[0]?.id || ""} />
              )}
            />

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 px-6"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="h-10 px-8 bg-blue-600 hover:bg-blue-700"
                disabled={createAppointment.isPending}
              >
                {createAppointment.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
