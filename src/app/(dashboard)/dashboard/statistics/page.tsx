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
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, Calendar as CalendarIcon, DollarSign, Building2, Package, BarChart3, X } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function StatisticsPage() {
  const [mounted, setMounted] = useState(false)
  const [period, setPeriod] = useState("day")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedAgency, setSelectedAgency] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: stats, isLoading } = useQuery({
    queryKey: ["statistics", period, selectedDate, startDate, endDate, selectedAgency, selectedService],
    queryFn: async () => {
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

  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const res = await fetch("/api/agencies")
      if (!res.ok) throw new Error("Acentalar yüklenemedi")
      return res.json()
    },
  })

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services")
      if (!res.ok) throw new Error("Hizmetler yüklenemedi")
      return res.json()
    },
  })

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount)

  const periodLabels: Record<string, string> = {
    day: "Bugün",
    week: "Bu Hafta",
    month: "Bu Ay",
    year: "Bu Yıl",
    custom: "Özel Aralık",
  }

  // Günlük trend bar chart için max değer
  const trendDays = stats?.dailyTrend?.slice(-7) || []
  const maxRevenue = Math.max(...trendDays.map((d: any) => d.revenue), 1)

  // Acenta tablosu için max gelir
  const maxAgencyRevenue = Math.max(...(stats?.byAgency?.map((a: any) => a.revenue) || [1]), 1)

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İstatistikler</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gelir ve satış istatistiklerini görüntüleyin</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm px-3 py-1">
          {selectedDate
            ? format(selectedDate, "dd MMM yyyy", { locale: tr })
            : periodLabels[period] || period}
        </Badge>
      </div>

      {/* Filtreler */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center">
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Filtreler</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Dönem */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dönem</Label>
            <Select value={period} onValueChange={(value) => {
              setPeriod(value)
              if (value !== "custom") { setStartDate(""); setEndDate("") }
              setSelectedDate(undefined)
            }}>
              <SelectTrigger className="h-9 bg-white border-slate-200 shadow-sm">
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

          {/* Belirli Bir Gün */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Belirli Bir Gün</Label>
            <div className="flex gap-1">
              {mounted ? (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-9 justify-start text-left font-normal text-sm bg-white border-slate-200 shadow-sm",
                        !selectedDate && "text-muted-foreground",
                        selectedDate && "border-blue-300 bg-blue-50 text-blue-700"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {selectedDate ? format(selectedDate, "dd MMM yyyy", { locale: tr }) : "Gün seçin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => { setSelectedDate(date); setDatePickerOpen(false) }}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Button variant="outline" className="flex-1 h-9 justify-start text-left font-normal text-muted-foreground text-sm bg-white border-slate-200" disabled>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />Gün seçin
                </Button>
              )}
              {selectedDate && (
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600" onClick={() => setSelectedDate(undefined)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Özel Tarih Aralığı */}
          {period === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Başlangıç</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm bg-white border-slate-200 shadow-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bitiş</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm bg-white border-slate-200 shadow-sm" />
              </div>
            </>
          )}

          {/* Acenta */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Acenta</Label>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger className="h-9 bg-white border-slate-200 shadow-sm">
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

          {/* Program */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Program</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="h-9 bg-white border-slate-200 shadow-sm">
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
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : stats ? (
        <>
          {/* Özet Kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Toplam Gelir */}
            <Card className="border border-emerald-200 shadow-sm bg-emerald-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Toplam Gelir</p>
                </div>
                <div className="text-2xl font-bold text-emerald-800">{formatCurrency(stats.summary.totalRevenue)}</div>
                <p className="text-emerald-600 text-xs mt-1">{stats.summary.totalAppointments} randevu</p>
              </CardContent>
            </Card>

            {/* Toplam Randevu */}
            <Card className="border border-blue-200 shadow-sm bg-blue-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Toplam Randevu</p>
                </div>
                <div className="text-2xl font-bold text-blue-800">{stats.summary.totalAppointments}</div>
                <p className="text-blue-600 text-xs mt-1">Ort: {formatCurrency(stats.summary.averagePerAppointment)}</p>
              </CardContent>
            </Card>

            {/* Toplam PAX */}
            <Card className="border border-violet-200 shadow-sm bg-violet-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-violet-600" />
                  </div>
                  <p className="text-xs font-medium text-violet-700 uppercase tracking-wide">Toplam PAX</p>
                </div>
                <div className="text-2xl font-bold text-violet-800">{stats.summary.totalPax}</div>
                <p className="text-violet-600 text-xs mt-1">Toplam kişi sayısı</p>
              </CardContent>
            </Card>

            {/* En Popüler */}
            <Card className="border border-orange-200 shadow-sm bg-orange-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                  </div>
                  <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">En Popüler</p>
                </div>
                <div className="text-xl font-bold text-orange-800 leading-tight">{stats.byService[0]?.name || "-"}</div>
                <p className="text-orange-600 text-xs mt-1">{stats.byService[0]?.count || 0} adet satış</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Acenta Bazlı */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-violet-100 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-700">Acenta Bazlı Gelir</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {stats.byAgency.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Veri yok</div>
                ) : (
                  <div className="space-y-3">
                    {stats.byAgency.map((agency: any, idx: number) => {
                      const dotColors = [
                        "bg-violet-400", "bg-blue-400", "bg-emerald-400",
                        "bg-orange-400", "bg-rose-400", "bg-cyan-400",
                      ]
                      const barColors = [
                        "bg-violet-200", "bg-blue-200", "bg-emerald-200",
                        "bg-orange-200", "bg-rose-200", "bg-cyan-200",
                      ]
                      const barWidth = Math.max((agency.revenue / maxAgencyRevenue) * 100, 2)
                      return (
                        <div key={agency.id || idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={cn("h-2 w-2 rounded-full shrink-0", dotColors[idx % dotColors.length])} />
                              <span className="font-medium text-gray-800 truncate max-w-[150px]">{agency.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-right shrink-0">
                              <span className="text-xs text-gray-500">{agency.count} rdv • {agency.pax} pax</span>
                              <span className="font-bold text-gray-800 w-24 text-right">{formatCurrency(agency.revenue)}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", barColors[idx % barColors.length])}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Program Bazlı */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-emerald-100 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-700">Program Bazlı Satışlar</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {stats.byService.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Veri yok</div>
                ) : (
                  <div className="space-y-3">
                    {stats.byService.map((service: any, idx: number) => {
                      const maxSvc = Math.max(...stats.byService.map((s: any) => s.revenue), 1)
                      const barWidth = Math.max((service.revenue / maxSvc) * 100, 2)
                      const badgeColors = [
                        "bg-emerald-100 text-emerald-700", "bg-teal-100 text-teal-700", "bg-cyan-100 text-cyan-700",
                        "bg-sky-100 text-sky-700", "bg-indigo-100 text-indigo-700", "bg-purple-100 text-purple-700",
                      ]
                      const barColors = [
                        "bg-emerald-200", "bg-teal-200", "bg-cyan-200",
                        "bg-sky-200", "bg-indigo-200", "bg-purple-200",
                      ]
                      return (
                        <div key={service.id || idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", badgeColors[idx % badgeColors.length])}>
                                #{idx + 1}
                              </span>
                              <span className="font-medium text-gray-800 truncate max-w-[130px]">{service.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-right">
                              <div className="text-right">
                                <div className="font-bold text-gray-800">{formatCurrency(service.revenue)}</div>
                                <div className="text-[10px] text-gray-400">{service.count} adet • ort {formatCurrency(service.revenue / service.count)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", barColors[idx % barColors.length])}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Günlük Trend - en altta */}
          {trendDays.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-700">Günlük Trend</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendDays.map((day: any, idx: number) => {
                    const barWidth = Math.max((day.revenue / maxRevenue) * 100, 2)
                    const isToday = format(new Date(day.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                    const barColors = ["bg-blue-200", "bg-emerald-200", "bg-violet-200", "bg-orange-200"]
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <div className="w-28 shrink-0 text-right">
                          <span className={cn("text-xs font-medium", isToday ? "text-blue-600" : "text-gray-600")}>
                            {format(new Date(day.date), "dd MMM", { locale: tr })}
                          </span>
                          {isToday && <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">bugün</span>}
                        </div>
                        <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
                          <div
                            className={cn("h-full rounded transition-all duration-500", barColors[idx % barColors.length])}
                            style={{ width: `${barWidth}%` }}
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
                            {day.count} randevu • {day.pax} pax
                          </span>
                        </div>
                        <div className="w-28 shrink-0 text-right font-semibold text-sm text-gray-700">
                          {formatCurrency(day.revenue)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
