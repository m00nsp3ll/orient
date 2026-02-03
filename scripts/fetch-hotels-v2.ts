import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const client = new ApifyClient({
    token: 'apify_api_lYmRC1msj20f8EV00TdH3UnyfBhLfI0H0NVl',
});

const prisma = new PrismaClient();

// Orient Marina lokasyonu
const ORIENT_MARINA = { lat: 36.5509, lng: 31.9961 };

// Bölgeler - koordinat sınırları
const REGIONS_BY_COORDS = [
  { name: "Okurcalar", minLng: 31.55, maxLng: 31.72 },
  { name: "Avsallar", minLng: 31.72, maxLng: 31.80 },
  { name: "Türkler", minLng: 31.80, maxLng: 31.87 },
  { name: "Konaklı", minLng: 31.87, maxLng: 31.94 },
  { name: "Alanya Merkez", minLng: 31.94, maxLng: 32.02 },
  { name: "Tosmur", minLng: 32.02, maxLng: 32.055 },
  { name: "Kestel", minLng: 32.055, maxLng: 32.085 },
  { name: "Mahmutlar", minLng: 32.085, maxLng: 32.125 },
  { name: "Kargıcak", minLng: 32.125, maxLng: 32.20 },
];

const ADDRESS_OVERRIDES: { [key: string]: string[] } = {
  "Okurcalar": ["okurcalar"],
  "Avsallar": ["avsallar"],
  "Türkler": ["türkler", "turkler"],
  "Konaklı": ["konaklı", "konakli"],
  "Oba": [", oba,", " oba,", "oba mahallesi", "oba,"],
  "Cikcilli": ["cikcilli"],
  "Tosmur": ["tosmur"],
  "Kestel": ["kestel"],
  "Mahmutlar": ["mahmutlar"],
  "Kargıcak": ["kargıcak", "kargicak"],
};

const BLACKLIST = [
  'restoran', 'restaurant', 'cafe', 'kafe', 'kahve', 'bistro', 'köfteci', 'kebab', 'pizza', 'burger',
  'water sport', 'watersport', 'dalış', 'diving', 'surf', 'jet ski',
  'lojman', 'personel', 'staff',
  'rezidans', 'residence', 'construction', 'inşaat', 'emlak', 'real estate',
  'market', 'süpermarket', 'supermarket', 'mağaza', 'shop',
  'kuaför', 'berber', 'güzellik', 'beauty salon', 'hamam',
  'gym', 'spor salonu', 'fitness', 'lunapark', 'aquapark', 'eğlence',
  'rent a car', 'otopark', 'parking', 'transfer', 'taxi', 'taksi',
  'okul', 'school', 'yurt', 'öğrenci',
  'plajı', 'beach club', 'tatil evleri', 'bungalow evleri', 'kiralık',
];

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function isHotel(name: string, category: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();

  // Kategori hotel ise kabul et
  if (lowerCategory.includes('hotel') || lowerCategory.includes('otel') ||
      lowerCategory.includes('resort') || lowerCategory.includes('konaklama')) {
    // Blacklist kontrolü
    for (const keyword of BLACKLIST) {
      if (lowerName.includes(keyword)) {
        if (!lowerName.includes('hotel') && !lowerName.includes('otel')) {
          return false;
        }
      }
    }
    return true;
  }

  // İsimde hotel/otel geçiyorsa
  if (lowerName.includes('hotel') || lowerName.includes('otel') ||
      lowerName.includes('resort') || lowerName.includes('palace')) {
    for (const keyword of BLACKLIST) {
      if (lowerName.includes(keyword)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function getRegionByCoordinates(lng: number): string {
  for (const region of REGIONS_BY_COORDS) {
    if (lng >= region.minLng && lng < region.maxLng) {
      return region.name;
    }
  }
  return "Alanya Merkez";
}

function getAddressOverride(address: string | null): string | null {
  if (!address) return null;
  const lowerAddress = address.toLowerCase();
  for (const [region, keywords] of Object.entries(ADDRESS_OVERRIDES)) {
    for (const keyword of keywords) {
      if (lowerAddress.includes(keyword)) {
        return region;
      }
    }
  }
  return null;
}

function determineRegion(lng: number, address: string | null): string {
  const coordRegion = getRegionByCoordinates(lng);
  const addressOverride = getAddressOverride(address);
  return addressOverride || coordRegion;
}

const input = {
    "searchStringsArray": [
        "Hotel",
        "Otel",
        "Resort",
        "Apart otel",
        "Apart Hotel",
        "Resort hotel",
        "Butik otel",
        "Boutique hotel",
        "Beach hotel",
        "Spa hotel",
        "5 yıldızlı otel",
        "4 yıldızlı otel",
        "3 yıldızlı otel",
        "Tatil köyü",
        "Holiday resort",
        "All inclusive hotel"
    ],
    "locationQuery": "Alanya, Turkey",
    "maxCrawledPlacesPerSearch": 500,
    "language": "tr",
    "placeMinimumStars": "",
    "skipClosedPlaces": true,
    "scrapePlaceDetailPage": false,
    "maxReviews": 0,
    "maxImages": 0,
    "customGeolocation": {
        "type": "Polygon",
        "coordinates": [
            [
                [31.55, 36.46],  // Batı-Güney (Serra Palace civarı)
                [32.13, 36.46],  // Doğu-Güney (Kargıcak)
                [32.13, 36.75],  // Doğu-Kuzey (daha geniş)
                [31.55, 36.75],  // Batı-Kuzey
                [31.55, 36.46]   // Kapatma
            ]
        ]
    },
    "zoom": 14,
};

(async () => {
    console.log('🏨 Apify ile yeni oteller aranıyor...');
    console.log('Batı sınırı: 31.55 (Serra Palace)');
    console.log('Bu işlem birkaç dakika sürebilir...\n');

    // Mevcut otelleri al
    const existingHotels = await prisma.hotel.findMany({
        select: { name: true, lat: true, lng: true }
    });

    const existingNames = new Set(existingHotels.map(h => h.name.toLowerCase().trim()));
    console.log(`📊 Veritabanında ${existingHotels.length} mevcut otel var.\n`);

    // Bölgeleri al
    const regions = await prisma.region.findMany();
    const regionMap = new Map(regions.map(r => [r.name, r.id]));

    console.log('Apify sorgusu çalıştırılıyor...');
    const run = await client.actor("nwua9Gu5YrADL7ZDj").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`\n📥 Apify'dan ${items.length} kayıt alındı.\n`);

    let addedCount = 0;
    let skippedExisting = 0;
    let skippedNotHotel = 0;
    let skippedNoCoords = 0;

    for (const item of items as any[]) {
        const name = item.title?.trim();
        const lat = item.location?.lat;
        const lng = item.location?.lng;
        const category = item.categoryName || '';

        // Koordinat kontrolü
        if (!lat || !lng) {
            skippedNoCoords++;
            continue;
        }

        // Otel mi kontrolü
        if (!isHotel(name || '', category)) {
            skippedNotHotel++;
            continue;
        }

        // Mevcut mu kontrolü
        if (existingNames.has(name?.toLowerCase().trim())) {
            skippedExisting++;
            continue;
        }

        // Bölge belirleme
        const regionName = determineRegion(lng, item.address);
        const regionId = regionMap.get(regionName);

        if (!regionId) {
            console.log(`⚠️ Bölge bulunamadı: ${regionName} - ${name}`);
            continue;
        }

        // Uzaklık hesapla
        const distance = calculateDistance(ORIENT_MARINA.lat, ORIENT_MARINA.lng, lat, lng);

        // Veritabanına ekle
        await prisma.hotel.create({
            data: {
                name: name || 'İsimsiz',
                address: item.address || null,
                googleMapsUrl: item.url || null,
                lat,
                lng,
                distanceToMarina: distance,
                regionId,
            }
        });

        existingNames.add(name?.toLowerCase().trim());
        addedCount++;
        console.log(`✅ Eklendi: ${name} (${regionName})`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SONUÇ');
    console.log('='.repeat(50));
    console.log(`✅ Yeni eklenen: ${addedCount} otel`);
    console.log(`⏭️ Zaten mevcut: ${skippedExisting}`);
    console.log(`🚫 Otel değil: ${skippedNotHotel}`);
    console.log(`📍 Koordinat yok: ${skippedNoCoords}`);

    // Güncel bölge sayıları
    console.log('\n📊 BÖLGELERE GÖRE GÜNCEL DURUM:\n');
    const updatedRegions = await prisma.region.findMany({
        include: { _count: { select: { hotels: true } } }
    });

    let total = 0;
    for (const region of updatedRegions) {
        console.log(`  ${region.name}: ${region._count.hotels} otel`);
        total += region._count.hotels;
    }
    console.log(`\n  TOPLAM: ${total} otel`);

    await prisma.$disconnect();
})();
