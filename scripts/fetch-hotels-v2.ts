import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN || '',
});

const prisma = new PrismaClient();

// Orient Marina lokasyonu
const ORIENT_MARINA = { lat: 36.5509, lng: 31.9961 };

// Bölgeler - koordinat sınırları (batıdan doğuya longitude bazlı)
// Batı sınır: Raymar Hotels (31.649), Doğu sınır: Utopia World (32.128)
const REGIONS_BY_COORDS = [
  { name: "Okurcalar", minLng: 31.64, maxLng: 31.72 },
  { name: "İncekum",   minLng: 31.72, maxLng: 31.76 },
  { name: "Avsallar",  minLng: 31.76, maxLng: 31.82 },
  { name: "Türkler",   minLng: 31.82, maxLng: 31.87 },
  { name: "Konaklı",   minLng: 31.87, maxLng: 31.94 },
  { name: "Oba",       minLng: 31.94, maxLng: 31.98 },
  { name: "Atatürk Anıtı", minLng: 31.98, maxLng: 32.00 },
  { name: "Kleopatra", minLng: 32.00, maxLng: 32.015 },
  { name: "Damlataş",  minLng: 32.015, maxLng: 32.025 },
  { name: "Tosmur",    minLng: 32.025, maxLng: 32.055 },
  { name: "Kestel",    minLng: 32.055, maxLng: 32.085 },
  { name: "Mahmutlar", minLng: 32.085, maxLng: 32.115 },
  { name: "Kargıcak",  minLng: 32.115, maxLng: 32.20 },
];

// Adres keyword'lerine göre bölge override (koordinat sonucunu ezer)
const ADDRESS_OVERRIDES: { [key: string]: string[] } = {
  "Okurcalar": ["okurcalar"],
  "İncekum": ["incekum", "İncekum", "incekum"],
  "Payallar": ["payallar"],
  "Avsallar": ["avsallar"],
  "Türkler": ["türkler", "turkler"],
  "Konaklı": ["konaklı", "konakli"],
  "Oba": [", oba,", " oba,", "oba mahallesi", "oba,", " oba "],
  "Atatürk Anıtı": ["atatürk", "ataturk"],
  "Kleopatra": ["kleopatra"],
  "Damlataş": ["damlataş", "damlatas"],
  "Tosmur": ["tosmur"],
  "Cikcilli": ["cikcilli"],
  "Kestel": ["kestel"],
  "Mahmutlar": ["mahmutlar"],
  "Kargıcak": ["kargıcak", "kargicak"],
};

// Otel olmayanları elemek için blacklist
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

// Haversine formülü ile mesafe (km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Otel mi kontrolü
function isHotel(name: string, category: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();

  // Kategori hotel ise kabul et
  if (lowerCategory.includes('hotel') || lowerCategory.includes('otel') ||
      lowerCategory.includes('resort') || lowerCategory.includes('konaklama')) {
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

// Koordinata göre bölge belirle
function getRegionByCoordinates(lng: number): string | null {
  for (const region of REGIONS_BY_COORDS) {
    if (lng >= region.minLng && lng < region.maxLng) {
      return region.name;
    }
  }
  return null; // Sınırlar dışında
}

// Adres override (adreste bölge adı yazıyorsa)
function getAddressOverride(address: string | null): string | null {
  if (!address) return null;
  const lowerAddress = address.toLowerCase();
  for (const [region, keywords] of Object.entries(ADDRESS_OVERRIDES)) {
    for (const keyword of keywords) {
      if (lowerAddress.includes(keyword.toLowerCase())) {
        return region;
      }
    }
  }
  return null;
}

// Bölge belirleme: Önce adres override, yoksa koordinat
function determineRegion(lng: number, address: string | null): string | null {
  const addressOverride = getAddressOverride(address);
  if (addressOverride) return addressOverride;
  return getRegionByCoordinates(lng);
}

// Apify sorgu parametreleri
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
                [31.64, 36.40],   // Batı-Güney (Raymar Hotels)
                [32.14, 36.40],   // Doğu-Güney (Utopia World)
                [32.14, 36.75],   // Doğu-Kuzey
                [31.64, 36.75],   // Batı-Kuzey
                [31.64, 36.40]    // Kapatma
            ]
        ]
    },
    "zoom": 14,
};

(async () => {
    console.log('='.repeat(60));
    console.log('🏨 OTEL VERİLERİ YENİDEN ÇEKİLİYOR');
    console.log('='.repeat(60));
    console.log('Batı sınır: Raymar Hotels (lng: 31.649)');
    console.log('Doğu sınır: Utopia World (lng: 32.128)');
    console.log('Çenger ÇIKARILDI, İncekum ve Payallar EKLENDİ');
    console.log('Bu işlem birkaç dakika sürebilir...\n');

    // 1. Önce tüm otelleri temizle
    const deletedCount = await prisma.hotel.deleteMany({});
    console.log(`🗑️  ${deletedCount.count} otel veritabanından silindi.\n`);

    // 2. Çenger bölgesini deaktif et
    const cengerResult = await prisma.region.updateMany({
        where: { name: "Çenger" },
        data: { isActive: false },
    });
    if (cengerResult.count > 0) {
        console.log('❌ Çenger bölgesi deaktif edildi.\n');
    }

    // 3. Bölgeleri al/oluştur
    const regionNames = [
        "Okurcalar", "İncekum", "Payallar", "Avsallar", "Türkler", "Konaklı",
        "Oba", "Atatürk Anıtı", "Kleopatra", "Damlataş",
        "Tosmur", "Cikcilli", "Kestel", "Mahmutlar", "Kargıcak"
    ];

    for (const name of regionNames) {
        await prisma.region.upsert({
            where: { name },
            update: { isActive: true },
            create: { name, isActive: true },
        });
    }

    // Delegasyon ayarları
    const allRegions = await prisma.region.findMany();
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));

    // Payallar → Okurcalar seans saatleri
    if (regionMap.get("Payallar") && regionMap.get("Okurcalar")) {
        await prisma.region.update({
            where: { id: regionMap.get("Payallar")! },
            data: { pickupTimeRegionId: regionMap.get("Okurcalar")! },
        });
    }
    // Cikcilli → Tosmur seans saatleri
    if (regionMap.get("Cikcilli") && regionMap.get("Tosmur")) {
        await prisma.region.update({
            where: { id: regionMap.get("Cikcilli")! },
            data: { pickupTimeRegionId: regionMap.get("Tosmur")! },
        });
    }

    console.log(`✅ ${regionNames.length} bölge hazır.\n`);

    // 4. Apify sorgusu
    console.log('🔄 Apify sorgusu çalıştırılıyor...');
    const run = await client.actor("nwua9Gu5YrADL7ZDj").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`\n📥 Apify'dan ${items.length} kayıt alındı.\n`);

    // 5. Otelleri işle ve kaydet
    let addedCount = 0;
    let skippedNotHotel = 0;
    let skippedNoCoords = 0;
    let skippedOutOfBounds = 0;
    let skippedDuplicate = 0;
    const addedNames = new Set<string>();
    const regionCounts: Record<string, number> = {};

    for (const item of items as any[]) {
        const name = item.title?.trim();
        const lat = item.location?.lat;
        const lng = item.location?.lng;
        const category = item.categoryName || '';

        if (!lat || !lng) {
            skippedNoCoords++;
            continue;
        }

        if (!isHotel(name || '', category)) {
            skippedNotHotel++;
            continue;
        }

        // Duplicate kontrolü (aynı isim)
        const nameKey = name?.toLowerCase().trim();
        if (addedNames.has(nameKey)) {
            skippedDuplicate++;
            continue;
        }

        // Bölge belirleme
        const regionName = determineRegion(lng, item.address);

        if (!regionName) {
            skippedOutOfBounds++;
            continue;
        }

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

        addedNames.add(nameKey);
        addedCount++;
        regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
        console.log(`  ✅ ${name} → ${regionName} (${distance} km)`);
    }

    // 6. Sonuç raporu
    console.log('\n' + '='.repeat(60));
    console.log('📊 SONUÇ');
    console.log('='.repeat(60));
    console.log(`✅ Eklenen otel    : ${addedCount}`);
    console.log(`🚫 Otel değil      : ${skippedNotHotel}`);
    console.log(`📍 Koordinat yok   : ${skippedNoCoords}`);
    console.log(`🗺️  Sınır dışı      : ${skippedOutOfBounds}`);
    console.log(`♻️  Tekrar eden     : ${skippedDuplicate}`);

    console.log('\n📊 BÖLGELERE GÖRE DAĞILIM:\n');
    const orderedRegions = [
        "Okurcalar", "İncekum", "Payallar", "Avsallar", "Türkler", "Konaklı",
        "Oba", "Atatürk Anıtı", "Kleopatra", "Damlataş",
        "Tosmur", "Cikcilli", "Kestel", "Mahmutlar", "Kargıcak"
    ];
    for (const name of orderedRegions) {
        const count = regionCounts[name] || 0;
        console.log(`  ${name.padEnd(20)} ${count} otel`);
    }
    console.log(`\n  ${'TOPLAM'.padEnd(20)} ${addedCount} otel`);

    await prisma.$disconnect();
})();
