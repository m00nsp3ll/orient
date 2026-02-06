"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TrendingUp, Users, Calendar as CalendarIcon, DollarSign, Package } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function StatisticsPage() {
  const [mounted, setMounted] = useState(false)
  const [period, setPeriod] = useState("day") // Default: Bugün
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedAgency, setSelectedAgency] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // İstatistikleri getir
  const { data: stats, isLoading } = useQuery({
    queryKey: ["statistics", period, selectedDate, startDate, endDate, selectedAgency, selectedService],
    queryFn: async () => {
      // Eğer belirli bir gün seçiliyse, onu kullan
      let queryPeriod = period
      let queryStartDate = startDate
      let queryEndDate = endDate

      if (selectedDate) {
        queryPeriod = "single"
        queryStartDate = format(selectedDate, "yyyy-MM-dd")
        queryEndDate = format(selectedDate, "yyyy-MM-dd")
      } else if (period === "custom" && startDate && endDate) {
        queryStartDate = startDate
        queryEndDate = endDate
      }

      const params = new URLSearchParams({
        period: queryPeriod,
        ...(queryStartDate && queryEndDate && { startDate: queryStartDate, endDate: queryEndDate }),
        ...(selectedAgency !== "all" && { agencyId: selectedAgency }),
        ...(selectedService !== "all" && { serviceId: selectedService }),
      })

      const res = await fetch(`/api/statistics?${params}`)
      if (!res.ok) throw new Error("İstatistikler yüklenemedi")
      return res.json()
    },
  })

  // Acentaları getir
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const res = await fetch("/api/agencies")
      if (!res.ok) throw new Error("Acentalar yüklenemedi")
      return res.json()
    },
  })

  // Hizmetleri getir
  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services")
      if (!res.ok) throw new Error("Hizmetler yüklenemedi")
      return res.json()
    },
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">İstatistikler</h1>
        <p className="text-gray-500">Gelir ve satış istatistiklerini görüntüleyin</p>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Dönem Seçimi */}
            <div>
              <Label>Dönem</Label>
              <Select value={period} onValueChange={(value) => {
                setPeriod(value)
                if (value !== "custom") {
                  setStartDate("")
                  setEndDate("")
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Bugün</SelectItem>
                  <SelectItem value="week">Bu Hafta</SelectItem>
                  <SelectItem value="month">Bu Ay</SelectItem>
                  <SelectItem value="year">Bu Yıl</SelectItem>
                  <SelectItem value="custom">Özel Tarih Aralığı</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Belirli Bir Gün Seçici */}
            <div>
              <Label>Belirli Bir Gün</Label>
              {mounted && (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "dd MMM yyyy", { locale: tr })
                      ) : (
                        <span>Gün seçin</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date)
                        setDatePickerOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
              {!mounted && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-muted-foreground"
                  disabled
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>Gün seçin</span>
                </Button>
              )}
            </div>

            {/* Özel Tarih Aralığı */}
            {period === "custom" && (
              <>
                <div>
                  <Label>Başlangıç</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Bitiş</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Acenta Filtresi */}
            <div>
              <Label>Acenta</Label>
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {agencies.map((agency: any) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name || agency.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Program Filtresi */}
            <div>
              <Label>Program</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {services.map((service: any) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
      ) : stats ? (
        <>
          {/* Özet Kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Gelir</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.summary.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.summary.totalAppointments} randevu
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Randevu</CardTitle>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.totalAppointments}</div>
                <p className="text-xs text-muted-foreground">
                  Ort: {formatCurrency(stats.summary.averagePerAppointment)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam PAX</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.totalPax}</div>
                <p className="text-xs text-muted-foreground">
                  Kişi sayısı
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Popüler</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.byService[0]?.name || "-"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.byService[0]?.count || 0} adet
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Acenta Bazlı İstatistikler */}
          <Card>
            <CardHeader>
              <CardTitle>Acenta Bazlı Gelir</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acenta</TableHead>
                    <TableHead className="text-right">Randevu</TableHead>
                    <TableHead className="text-right">PAX</TableHead>
                    <TableHead className="text-right">Gelir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byAgency.map((agency: any) => (
                    <TableRow key={agency.id}>
                      <TableCell className="font-medium">{agency.name}</TableCell>
                      <TableCell className="text-right">{agency.count}</TableCell>
                      <TableCell className="text-right">{agency.pax}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(agency.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Program Bazlı İstatistikler */}
          <Card>
            <CardHeader>
              <CardTitle>Program Bazlı Satışlar</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Satış Adedi</TableHead>
                    <TableHead className="text-right">Toplam Gelir</TableHead>
                    <TableHead className="text-right">Ortalama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byService.map((service: any) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="text-right">{service.count}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(service.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(service.revenue / service.count)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Günlük Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Günlük Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.dailyTrend.slice(-7).map((day: any) => (
                  <div key={day.date} className="flex items-center justify-between p-2 border-b">
                    <div className="flex-1">
                      <div className="font-medium">
                        {format(new Date(day.date), "dd MMMM yyyy", { locale: tr })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {day.count} randevu • {day.pax} pax
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      {formatCurrency(day.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
