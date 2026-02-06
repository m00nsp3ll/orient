"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon, Building2, User, Search, X, Banknote, Plus, Trash2, Minus } from "lucide-react"
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
  serviceId: z.string().optional(), // Artık opsiyonel, sepetten alınacak
  date: z.date({
    message: "Tarih seçin",
  }),
  time: z.string().min(1, "Saat seçin"),
  notes: z.string().optional(),
  // Agency specific fields
  agencyId: z.string().optional(),
  hotelId: z.string().min(1, "Otel seçin"),
  pax: z.number().min(1, "En az 1 kişi seçin"),
  customerName: z.string().min(1, "Müşteri adı girin"),
  customerPhone: z.string().optional(),
  isRest: z.boolean().optional(),
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

  // Sepete hizmet ekle
  const addToCart = (service: Omit<CartItem, 'quantity'>) => {
    const pax = form.watch("pax") || 0
    const totalPackages = cart.reduce((sum, item) => sum + item.quantity, 0)

    // PAX kontrolü - toplam paket sayısı PAX'tan fazla olamaz
    if (totalPackages >= pax) {
      toast.error(`Maksimum ${pax} paket ekleyebilirsiniz`)
      return
    }

    const existingItem = cart.find(item => item.id === service.id)
    if (existingItem) {
      // Zaten varsa miktarı artır
      setCart(cart.map(item =>
        item.id === service.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
      toast.success(`${service.name} miktarı artırıldı`)
    } else {
      // Yeni hizmet ekle
      setCart([...cart, { ...service, quantity: 1 }])
      toast.success(`${service.name} sepete eklendi`)
    }
  }

  // Miktarı artır
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

  // Miktarı azalt
  const decreaseQuantity = (serviceId: string) => {
    setCart(cart.map(item => {
      if (item.id === serviceId) {
        if (item.quantity === 1) {
          return item // En az 1 olmalı, silmek için X butonu kullanılır
        }
        return { ...item, quantity: item.quantity - 1 }
      }
      return item
    }))
  }

  // Sepetten hizmet çıkar
  const removeFromCart = (serviceId: string) => {
    setCart(cart.filter(item => item.id !== serviceId))
    toast.success("Hizmet sepetten çıkarıldı")
  }

  // Toplam hesaplama
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
    },
  })

  // Fetch current user's agency if logged in as agency
  const { data: userAgency } = useQuery({
    queryKey: ["user-agency", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/agencies/me")
      if (!res.ok) throw new Error("Failed to fetch user agency")
      return res.json()
    },
    enabled: isAgency,
  })

  // Reset form when entry mode changes
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

  // Reset service when isRest changes
  useEffect(() => {
    if (isRest) {
      form.setValue("serviceId", "")
      setSelectedService(undefined)
    }
  }, [isRest, form])

  // Auto-populate agency ID for logged-in agency users
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

  // Filter hotels based on search
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
    queryKey: ["availability", selectedDate],
    queryFn: async () => {
      if (!selectedDate) return []
      const res = await fetch(
        `/api/availability?date=${format(selectedDate, "yyyy-MM-dd")}`
      )
      if (!res.ok) throw new Error("Failed to fetch availability")
      return res.json()
    },
    enabled: !!selectedDate,
  })

  const createAppointment = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      // Sepet kontrolü
      if (cart.length === 0) {
        throw new Error("Lütfen en az bir paket seçin")
      }

      const startTime = new Date(data.date)
      const [hours, minutes] = data.time.split(":")
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

      const payload: Record<string, unknown> = {
        serviceId: cart[0].id, // İlk hizmet ana hizmet olarak
        startTime: startTime.toISOString(),
        notes: isRest ? "REST" : (data.notes || null),
        isRest,
        hotelId: data.hotelId || null,
        pax: data.pax || 1,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        // Sepetteki tüm hizmetler
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
      <DialogContent className="w-full !max-w-[1200px] max-h-[90vh] overflow-y-auto">
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

            {/* 2 Kolonlu Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SOL KOLON - Müşteri Bilgileri */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Müşteri Bilgileri</h3>

                {/* Agency Mode Fields */}
                {(isAgency || (isAdmin && entryMode === "agency")) && (
                  <FormField
                    control={form.control}
                    name="agencyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Acenta</FormLabel>
                        {isAgency ? (
                          /* Agency user - show name as read-only */
                          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm">
                              {userAgency?.companyName || userAgency?.name || "Acenta"}
                            </span>
                          </div>
                        ) : (
                          /* Admin - show dropdown selector */
                          <Select
                            onValueChange={field.onChange}
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
                        )}
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

                <FormField
                  control={form.control}
                  name="pax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAX (Kişi Sayısı)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2 border rounded-lg p-2 bg-white">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => {
                              const currentPax = field.value || 0
                              if (currentPax > 0) {
                                field.onChange(currentPax - 1)
                              }
                            }}
                            disabled={!field.value || field.value === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 text-center">
                            <span className="text-2xl font-bold text-blue-600">
                              {field.value || 0}
                            </span>
                            <span className="text-sm text-gray-500 ml-1">kişi</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => {
                              const currentPax = field.value || 0
                              field.onChange(currentPax + 1)
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
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

                {/* Tarih ve Saat */}
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
                        disabled={!selectedDate}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !selectedDate
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
              </div>

              {/* SAĞ KOLON - Paket Seçimleri */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-sm text-gray-700">Programlar</h3>
                  {form.watch("pax") > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {form.watch("pax")} pax için
                    </Badge>
                  )}
                </div>

                {/* PAX Uyarısı */}
                {(!form.watch("pax") || form.watch("pax") === 0) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <User className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700 font-medium">
                      Paket seçmeden önce lütfen PAX (kişi sayısı) girin
                    </span>
                  </div>
                )}

                {/* Tarih ve Saat Uyarısı */}
                {(!selectedDate || !form.watch("time")) && form.watch("pax") > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">
                      Program seçmeden önce lütfen tarih ve saat seçin
                    </span>
                  </div>
                )}

                {/* Hizmet Seçim Dropdown + Ekle Butonu */}
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => {
                      setSelectedService(value)
                    }}
                    value={selectedService}
                    disabled={!form.watch("pax") || form.watch("pax") === 0 || !selectedDate || !form.watch("time") || getTotalPackages() >= (form.watch("pax") || 0)}
                  >
                    <SelectTrigger className="flex-1">
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
                        // Seçili programı temizleme - kullanıcı isterse aynı programı tekrar ekleyebilir
                        // setSelectedService(undefined)
                      }
                    }}
                    disabled={!selectedService || !form.watch("pax") || form.watch("pax") === 0 || !selectedDate || !form.watch("time") || getTotalPackages() >= (form.watch("pax") || 0)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Sepet Listesi */}
                {cart.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Seçilen Paketler</Label>
                      <Badge variant="secondary">{getTotalPackages()} paket</Badge>
                    </div>

                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category.name}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              {item.duration} dk • {item.price}₺
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 border rounded-lg">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => decreaseQuantity(item.id)}
                              disabled={item.quantity === 1}
                            >
                              <span className="text-lg">−</span>
                            </Button>
                            <span className="min-w-8 text-center font-medium text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => increaseQuantity(item.id)}
                              disabled={getTotalPackages() >= (form.watch("pax") || 0)}
                            >
                              <span className="text-lg">+</span>
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Toplam Özet */}
                    <div className="border-t pt-3 mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Toplam Süre:</span>
                        <span className="font-medium">{getTotalDuration()} dakika</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Paket Toplamı:</span>
                        <span className="font-medium">{getTotalPrice()}₺</span>
                      </div>
                      {(form.watch("pax") || 0) > 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            PAX ({form.watch("pax")} kişi):
                          </span>
                          <span className="font-medium text-blue-600">
                            {getPaxTotal()}₺
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">Toplam Tutar:</span>
                        <span className="font-bold text-lg text-blue-600">
                          {getPaxTotal()}₺
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {cart.length === 0 && (
                  <div className="text-center py-8 text-gray-500 border rounded-lg border-dashed">
                    Henüz paket seçilmedi
                  </div>
                )}
              </div>
            </div>

            {/* Eski serviceId field'ı kaldırıldı */}
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <input type="hidden" {...field} value={cart[0]?.id || ""} />
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
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
