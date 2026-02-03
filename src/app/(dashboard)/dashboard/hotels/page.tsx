"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2, Check, X, Hotel, MapPin, Navigation, Search, Map as MapIcon } from "lucide-react"
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
  const [showDuplicates, setShowDuplicates] = useState(false)

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

  // String normalization for similarity check
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/hotel|otel|resort|apart|club|beach|spa|wellness/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Calculate similarity between two strings (0-1, where 1 is identical)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const norm1 = normalizeString(str1)
    const norm2 = normalizeString(str2)

    // Exact match after normalization
    if (norm1 === norm2) return 1

    // Check if one contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8

    // Levenshtein distance-based similarity
    const longer = norm1.length > norm2.length ? norm1 : norm2
    const shorter = norm1.length > norm2.length ? norm2 : norm1

    if (longer.length === 0) return 1.0

    const editDistance = levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  // Levenshtein distance algorithm
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

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

  // Find similar/duplicate hotel names using smart matching
  const findSimilarHotels = (): string[] => {
    const similarIds = new Set<string>()
    const SIMILARITY_THRESHOLD = 0.75 // 75% benzerlik eşiği

    for (let i = 0; i < hotels.length; i++) {
      for (let j = i + 1; j < hotels.length; j++) {
        const similarity = calculateSimilarity(hotels[i].name, hotels[j].name)

        if (similarity >= SIMILARITY_THRESHOLD) {
          similarIds.add(hotels[i].id)
          similarIds.add(hotels[j].id)
        }
      }
    }

    return Array.from(similarIds)
  }

  const duplicateHotelIds = findSimilarHotels()

  const filteredHotels = selectedHotelId
    ? hotels.filter(h => h.id === selectedHotelId)
    : hotels.filter(h => {
        // Region filter
        if (selectedRegion !== "all" && h.regionId !== selectedRegion) return false

        // No address filter
        if (showNoAddress && (h.lat !== null || h.lng !== null)) return false

        // Duplicates/Similar filter
        if (showDuplicates && !duplicateHotelIds.includes(h.id)) return false

        return true
      })

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
                  setShowDuplicates(false)
                  setSelectedRegion("all")
                  setSelectedHotelId(null)
                }}
              >
                <MapPin className="h-4 w-4 mr-1" />
                Adresi Olmayanlar {showNoAddress && `(${hotels.filter(h => h.lat === null || h.lng === null).length})`}
              </Button>
              <Button
                variant={showDuplicates ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowDuplicates(!showDuplicates)
                  setShowNoAddress(false)
                  setSelectedRegion("all")
                  setSelectedHotelId(null)
                }}
              >
                <Hotel className="h-4 w-4 mr-1" />
                Benzer İsimli Oteller {showDuplicates && `(${duplicateHotelIds.length})`}
              </Button>
              {(selectedRegion !== "all" || selectedHotelId || searchQuery || showNoAddress || showDuplicates) && (
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedRegion("all")
                  setSelectedHotelId(null)
                  setSearchQuery("")
                  setShowNoAddress(false)
                  setShowDuplicates(false)
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
                        hotel.name
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
