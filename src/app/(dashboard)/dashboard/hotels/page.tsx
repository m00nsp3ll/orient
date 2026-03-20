"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2, Check, X, Hotel, MapPin, Navigation, Search, Map as MapIcon, AlertTriangle } from "lucide-react"
import { useIsMobile } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { LocationPickerModal } from "@/components/maps/location-picker-modal"

interface Region {
  id: string
  name: string
  _count?: { hotels: number }
}

interface HotelData {
  id: string
  name: string
  address: string | null
  googleMapsUrl: string | null
  lat: number | null
  lng: number | null
  distanceToMarina: number | null
  regionId: string
  isActive: boolean
  region: { id: string; name: string }
}

export default function HotelsPage() {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRegionDialog, setShowRegionDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState({ name: "", regionId: "" })
  const [newHotel, setNewHotel] = useState({ name: "", regionId: "" })
  const [newRegion, setNewRegion] = useState("")
  const [selectedRegion, setSelectedRegion] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [selectedHotelForLocation, setSelectedHotelForLocation] = useState<HotelData | null>(null)
  const [showNoAddress, setShowNoAddress] = useState(false)
  const [showJunk, setShowJunk] = useState(false)

  const { data: hotels = [], isLoading: hotelsLoading } = useQuery<HotelData[]>({
    queryKey: ["hotels"],
    queryFn: async () => {
      const res = await fetch("/api/hotels")
      if (!res.ok) throw new Error("Failed to fetch hotels")
      return res.json()
    },
  })

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: async () => {
      const res = await fetch("/api/regions")
      if (!res.ok) throw new Error("Failed to fetch regions")
      return res.json()
    },
  })

  const createHotel = useMutation({
    mutationFn: async (data: { name: string; regionId: string }) => {
      const res = await fetch("/api/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Otel oluşturulamadı")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotels"] })
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      setShowAddDialog(false)
      setNewHotel({ name: "", regionId: "" })
      toast.success("Otel eklendi")
    },
    onError: () => {
      toast.error("Otel eklenemedi")
    },
  })

  const updateHotel = useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string
      name?: string
      regionId?: string
      address?: string
      lat?: number
      lng?: number
      googleMapsUrl?: string
      distanceToMarina?: number
    }) => {
      const res = await fetch(`/api/hotels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Otel güncellenemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotels"] })
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      setEditingId(null)
      toast.success("Otel güncellendi")
    },
    onError: () => {
      toast.error("Otel güncellenemedi")
    },
  })

  const deleteHotel = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hotels/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Otel silinemedi")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotels"] })
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      toast.success("Otel silindi")
    },
    onError: () => {
      toast.error("Otel silinemedi")
    },
  })

  const createRegion = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Bölge oluşturulamadı")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      setShowRegionDialog(false)
      setNewRegion("")
      toast.success("Bölge eklendi")
    },
    onError: () => {
      toast.error("Bölge eklenemedi")
    },
  })


  const handleStartEdit = (hotel: HotelData) => {
    setEditingId(hotel.id)
    setEditingData({ name: hotel.name, regionId: hotel.regionId })
  }

  const handleSaveEdit = () => {
    if (editingId) {
      updateHotel.mutate({ id: editingId, ...editingData })
    }
  }

  const handleOpenLocationPicker = (hotel: HotelData) => {
    setSelectedHotelForLocation(hotel)
    setLocationPickerOpen(true)
  }

  const handleLocationSelect = (location: { address: string; lat: number; lng: number; googleMapsUrl: string }) => {
    if (!selectedHotelForLocation) return

    // Calculate distance to marina (Orient Marina Hamam)
    const MARINA_LAT = 36.5603513
    const MARINA_LNG = 31.9483576
    const distance = calculateDistance(MARINA_LAT, MARINA_LNG, location.lat, location.lng)

    updateHotel.mutate({
      id: selectedHotelForLocation.id,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      googleMapsUrl: location.googleMapsUrl,
      distanceToMarina: Math.round(distance * 10) / 10, // Round to 1 decimal
    })

    setLocationPickerOpen(false)
    setSelectedHotelForLocation(null)
  }

  // Haversine distance calculation
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Katman 1: Alt-mekan prefix'leri — hotel/otel/resort içerse bile junk
  const SUB_VENUE_PREFIXES = [
    'snack bar', 'pool bar', 'beach bar', 'lobby bar', 'bar ',
    'amfitiyatro', 'amphitheatre', 'amphitheater', 'anfitiyatro',
    'adventure park', 'aqua park', 'aquapark', 'water park', 'waterpark',
    'mini club', 'kids club', 'mini kulüp', 'çocuk kulübü',
    'spa center', 'spa centre', 'wellness center', 'wellness centre',
    'fitness center', 'fitness centre',
    'reception', 'resepsiyon', 'lobby',
    'restaurant', 'restoran', 'buffet', 'büfe',
    'animation', 'animasyon',
    'parking', 'otopark', 'car park',
    'снек бар', 'снэк бар',
    'transfer desk',
    'beach of', 'plaj',
    'market', 'shop', 'boutique of', 'mağaza',
  ]

  // Katman 2: Keyword-based junk (hasHotelWord guard kaldırıldı, pozisyon bazlı)
  const JUNK_KEYWORDS = [
    // Mekanlar
    'amfitiyatro', 'anfitiyatro', 'amphitheatre', 'amphitheater',
    'arena', 'stadyum', 'stadium',
    // Alt-mekan
    'snack bar', 'pool bar', 'beach bar', 'lobby bar',
    'animasyon', 'animation',
    'mini club', 'kids club',
    // Ekipman / malzeme
    'ekipman', 'equipment', 'malzeme', 'tedarik', 'mobilya', 'furniture',
    'tekstil', 'textile', 'halı', 'perde',
    // Kamp / bungalov
    'camping', 'kamp alanı', 'çadır', 'karavan', 'çadır kamp', 'bungalov',
    // Gayrimenkul / site
    'emlak', 'real estate', 'gayrimenkul', 'inşaat', 'construction',
    'tatil sitesi', 'tatil evleri', 'site yönetimi', 'tatil köyü',
    // Yeme-içme
    'restoran', 'restaurant', 'cafe', 'kafe', 'kahve', 'bistro',
    'köfteci', 'kebab', 'pizza', 'burger', 'lokanta', 'bakery', 'fırın',
    // Hizmet / dükkan
    'kuaför', 'berber', 'güzellik', 'beauty salon', 'hamam',
    'market', 'süpermarket', 'supermarket', 'mağaza', 'shop', 'boutique store',
    'eczane', 'pharmacy', 'kuyumcu', 'jewel',
    'dükkanı', 'mağazası',
    // Spor / eğlence
    'gym', 'spor salonu', 'fitness', 'lunapark', 'aquapark', 'eğlence',
    'dalış', 'diving', 'surf', 'jet ski', 'water sport', 'watersport',
    // Ulaşım
    'rent a car', 'otopark', 'parking', 'transfer', 'taxi', 'taksi',
    // Eğitim
    'okul', 'school', 'yurt', 'öğrenci', 'kreş', 'anaokulu',
    // Diğer
    'plajı', 'beach club', 'kiralık', 'hurda', 'fabrik', 'atölye',
    'lojman', 'personel', 'depo', 'warehouse', 'piknik',
    'cami', 'mosque', 'kilise', 'church', 'hastane', 'hospital', 'klinik',
    'muhasebe', 'accounting', 'avukat', 'lawyer', 'noter',
    // Rusça
    'снек бар', 'снэк бар',
  ]

  // Base name extraction: alt-mekan prefix'ini sil, hotel/otel/resort/spa/beach/club sil, normalize
  const extractBaseName = (name: string): string => {
    let n = name.toLowerCase().trim()
    // Alt-mekan prefix'ini sil
    for (const prefix of SUB_VENUE_PREFIXES) {
      if (n.startsWith(prefix)) {
        n = n.slice(prefix.length).trim()
        break
      }
    }
    // Hotel keywords sil ve normalize
    return n
      .replace(/hotel|otel|resort|spa|beach|club|wellness/gi, '')
      .replace(/[^a-z0-9\s\u00c0-\u024f\u0400-\u04ff]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Junk detection + parent hotel mapping
  const { junkHotelIds, junkParentMap } = useMemo(() => {
    const ids = new Set<string>()
    const parentMap = new Map<string, string>() // junkId → parent hotel name

    // Katman 1: Alt-mekan prefix kontrolü (hotel word olsa bile yakala)
    for (const hotel of hotels) {
      const nameLower = hotel.name.toLowerCase().trim()
      for (const prefix of SUB_VENUE_PREFIXES) {
        if (nameLower.startsWith(prefix)) {
          ids.add(hotel.id)
          break
        }
      }
    }

    // Katman 2: Keyword kontrolü — pozisyon bazlı
    for (const hotel of hotels) {
      if (ids.has(hotel.id)) continue
      const nameLower = hotel.name.toLowerCase()
      const hasHotelWord = /hotel|otel|resort/i.test(nameLower)

      for (const kw of JUNK_KEYWORDS) {
        const kwIndex = nameLower.indexOf(kw)
        if (kwIndex === -1) continue
        if (hasHotelWord) {
          // Keyword başta ise (ilk %40 pozisyonda) → junk, sonda ise gerçek otel
          const kwPosition = kwIndex / nameLower.length
          if (kwPosition < 0.4) {
            ids.add(hotel.id)
          }
        } else {
          // Hotel word yoksa doğrudan junk
          ids.add(hotel.id)
        }
        break
      }
    }

    // Katman 3: 80+ karakter → junk (Booking.com daire ilanları)
    for (const hotel of hotels) {
      if (hotel.name.length > 80) {
        ids.add(hotel.id)
      }
    }

    // "Apart" geçip "hotel/otel" geçmeyenler (daire ilanları)
    for (const hotel of hotels) {
      const nameLower = hotel.name.toLowerCase()
      if (/apart(?!.*(?:hotel|otel))/i.test(nameLower) && /daire|oda|yatak|suite/i.test(nameLower)) {
        ids.add(hotel.id)
      }
    }

    // Katman 4: Gruplama — junk kayıtları için parent otel bul
    const junkIds = Array.from(ids)
    const nonJunkHotels = hotels.filter(h => !ids.has(h.id))

    // Base name index for non-junk hotels
    const baseNameIndex = new Map<string, string>() // baseName → hotel name
    for (const hotel of nonJunkHotels) {
      const base = extractBaseName(hotel.name)
      if (base.length > 2) {
        // En kısa (veya Hotel/Resort içeren) ismi tercih et
        const existing = baseNameIndex.get(base)
        if (!existing || hotel.name.length < existing.length) {
          baseNameIndex.set(base, hotel.name)
        }
      }
    }

    // Her junk için parent bul
    for (const junkId of junkIds) {
      const junkHotel = hotels.find(h => h.id === junkId)
      if (!junkHotel) continue
      const junkBase = extractBaseName(junkHotel.name)

      // Exact base match
      const parentName = baseNameIndex.get(junkBase)
      if (parentName) {
        parentMap.set(junkId, parentName)
        continue
      }

      // Partial match: junk base name non-junk hotel base name'i içeriyor mu?
      const baseEntries = Array.from(baseNameIndex.entries())
      for (let i = 0; i < baseEntries.length; i++) {
        const base = baseEntries[i][0]
        const name = baseEntries[i][1]
        if (junkBase.length > 2 && base.length > 2 && (base.includes(junkBase) || junkBase.includes(base))) {
          parentMap.set(junkId, name)
          break
        }
      }
    }

    return { junkHotelIds: junkIds, junkParentMap: parentMap }
  }, [hotels])

  const filteredHotels = useMemo(() => {
    if (selectedHotelId) return hotels.filter(h => h.id === selectedHotelId)
    return hotels.filter(h => {
      if (selectedRegion !== "all" && h.regionId !== selectedRegion) return false
      if (showNoAddress && (h.lat !== null || h.lng !== null)) return false
      if (showJunk && !junkHotelIds.includes(h.id)) return false
      return true
    })
  }, [hotels, selectedHotelId, selectedRegion, showNoAddress, showJunk, junkHotelIds])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Otel Yönetimi</h1>
          <p className="text-gray-500">Otelleri ve bölgeleri yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRegionDialog(true)}>
            <MapPin className="h-4 w-4 mr-2" />
            Bölge Ekle
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Otel Ekle
          </Button>
        </div>
      </div>

      {/* Region Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {regions.map((region) => (
          <Card
            key={region.id}
            className={`cursor-pointer transition-colors ${
              selectedRegion === region.id ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => setSelectedRegion(selectedRegion === region.id ? "all" : region.id)}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium truncate">{region.name}</div>
              <div className="text-2xl font-bold">{region._count?.hotels || 0}</div>
              <div className="text-xs text-gray-500">otel</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hotels Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Hotel className="h-5 w-5" />
                Oteller
              </CardTitle>
              <CardDescription>
                {selectedRegion === "all"
                  ? `Toplam ${hotels.length} otel`
                  : `${filteredHotels.length} otel gösteriliyor`}
              </CardDescription>
            </div>
          </div>
          {/* Search Box */}
          <div className="relative mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Otel adı ile ara..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchDropdown(e.target.value.length > 0)
                  }}
                  onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  className="pl-10 w-full md:w-80"
                />
              </div>
              <Button
                variant={showNoAddress ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowNoAddress(!showNoAddress)
                  setShowJunk(false)
                  setSelectedRegion("all")
                  setSelectedHotelId(null)
                }}
              >
                <MapPin className="h-4 w-4 mr-1" />
                Adresi Olmayanlar {showNoAddress && `(${hotels.filter(h => h.lat === null || h.lng === null).length})`}
              </Button>
              <Button
                variant={showJunk ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowJunk(!showJunk)
                  setShowNoAddress(false)
                  setSelectedRegion("all")
                  setSelectedHotelId(null)
                }}
                className={showJunk ? "" : "text-orange-600 border-orange-300 hover:bg-orange-50"}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Otel Temizle ({junkHotelIds.length})
              </Button>
              {(selectedRegion !== "all" || selectedHotelId || searchQuery || showNoAddress || showJunk) && (
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedRegion("all")
                  setSelectedHotelId(null)
                  setSearchQuery("")
                  setShowNoAddress(false)
                  setShowJunk(false)
                }}>
                  <X className="h-4 w-4 mr-1" />
                  Temizle
                </Button>
              )}
            </div>
            {showSearchDropdown && searchQuery.length > 0 && (
              <div className="absolute z-50 mt-1 w-full md:w-80 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {hotels
                  .filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 10)
                  .map((hotel) => (
                    <div
                      key={hotel.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                      onMouseDown={() => {
                        setSearchQuery(hotel.name)
                        setShowSearchDropdown(false)
                        setSelectedHotelId(hotel.id)
                        setSelectedRegion("all")
                      }}
                    >
                      <span className="text-sm truncate">{hotel.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{hotel.region.name}</Badge>
                    </div>
                  ))}
                {hotels.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500">Sonuç bulunamadı</div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hotelsLoading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : filteredHotels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Otel bulunamadı</div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredHotels.map((hotel) => (
                <div key={hotel.id} className="border rounded-lg p-4 space-y-2">
                  {editingId === hotel.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editingData.name}
                        onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                        className="w-full"
                        placeholder="Otel adı"
                      />
                      <Select
                        value={editingData.regionId}
                        onValueChange={(v) => setEditingData({ ...editingData, regionId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((region) => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 mr-1" /> İptal
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateHotel.isPending}>
                          <Check className="h-4 w-4 mr-1" /> Kaydet
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{hotel.name}</div>
                          {showJunk && junkParentMap.get(hotel.id) && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              → {junkParentMap.get(hotel.id)}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">{hotel.region.name}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          {hotel.googleMapsUrl ? (
                            <a
                              href={hotel.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                            >
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[120px]">{hotel.address || 'Haritada Göster'}</span>
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">Adres yok</span>
                          )}
                          {hotel.distanceToMarina !== null && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <Navigation className="h-3 w-3 text-green-600" />
                              {hotel.distanceToMarina} km
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenLocationPicker(hotel)}>
                            <MapIcon className={`h-4 w-4 ${!hotel.address ? 'text-orange-500' : 'text-blue-500'}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(hotel)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteHotel.mutate(hotel.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Otel Adı</TableHead>
                  <TableHead>Adres</TableHead>
                  <TableHead>Bölge</TableHead>
                  <TableHead>Uzaklık</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHotels.map((hotel) => (
                  <TableRow key={hotel.id}>
                    <TableCell>
                      {editingId === hotel.id ? (
                        <Input
                          value={editingData.name}
                          onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                          className="w-full"
                        />
                      ) : (
                        <div>
                          <span>{hotel.name}</span>
                          {showJunk && junkParentMap.get(hotel.id) && (
                            <span className="ml-2 text-xs text-gray-500">
                              → {junkParentMap.get(hotel.id)}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          {hotel.googleMapsUrl ? (
                            <a
                              href={hotel.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin className="h-3 w-3" />
                              <span className="max-w-[150px] truncate">{hotel.address || 'Haritada Göster'}</span>
                            </a>
                          ) : hotel.address ? (
                            <span className="text-sm text-gray-600 max-w-[150px] truncate block">{hotel.address}</span>
                          ) : (
                            <span className="text-gray-400 text-sm">Adres yok</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => handleOpenLocationPicker(hotel)}
                          title={hotel.address ? "Adresi Düzenle" : "Adres Ekle"}
                        >
                          <MapIcon className={`h-4 w-4 ${!hotel.address ? 'text-orange-500' : 'text-blue-500'}`} />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === hotel.id ? (
                        <Select
                          value={editingData.regionId}
                          onValueChange={(v) => setEditingData({ ...editingData, regionId: v })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {regions.map((region) => (
                              <SelectItem key={region.id} value={region.id}>
                                {region.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{hotel.region.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {hotel.distanceToMarina !== null ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Navigation className="h-3 w-3 text-green-600" />
                          <span>{hotel.distanceToMarina} km</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === hotel.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSaveEdit}
                            disabled={updateHotel.isPending}
                          >
                            <Check className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(hotel)}
                          >
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteHotel.mutate(hotel.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Hotel Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Otel Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Otel Adı</label>
              <Input
                placeholder="Otel adını girin"
                value={newHotel.name}
                onChange={(e) => setNewHotel({ ...newHotel, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bölge</label>
              <Select
                value={newHotel.regionId}
                onValueChange={(v) => setNewHotel({ ...newHotel, regionId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bölge seçin" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                İptal
              </Button>
              <Button
                onClick={() => createHotel.mutate(newHotel)}
                disabled={!newHotel.name || !newHotel.regionId || createHotel.isPending}
              >
                Ekle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Region Dialog */}
      <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Bölge Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bölge Adı</label>
              <Input
                placeholder="Örn: Konaklı, Mahmutlar"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRegionDialog(false)}>
                İptal
              </Button>
              <Button
                onClick={() => createRegion.mutate(newRegion)}
                disabled={!newRegion || createRegion.isPending}
              >
                Ekle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Picker Modal */}
      {selectedHotelForLocation && (
        <LocationPickerModal
          open={locationPickerOpen}
          onOpenChange={setLocationPickerOpen}
          onLocationSelect={handleLocationSelect}
          initialLocation={{
            lat: selectedHotelForLocation.lat,
            lng: selectedHotelForLocation.lng,
            address: selectedHotelForLocation.address,
          }}
          hotelName={selectedHotelForLocation.name}
        />
      )}
    </div>
  )
}
