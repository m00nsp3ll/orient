import { ApifyClient } from 'apify-client';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const client = new ApifyClient({
    token: 'REDACTED',
});

const prisma = new PrismaClient();

// Orient Marina gerçek lokasyonu (Google Maps'ten doğrulanmış)
const ORIENT_MARINA = { lat: 36.5604, lng: 31.9484 };

// ============================================================
// BÖLGE SIRASI:
//   Batıdan doğuya: Okurcalar → İncekum → Avsallar → Türkler → Payallar → Konaklı
//   Oba ile Kleopatra arası: Atatürk Anıtı
//   Doğudan batıya: Kargıcak → Mahmutlar → Kestel → Tosmur → Oba → Atatürk Anıtı → Kleopatra
//
// Referans noktalar:
//   Batı sınır  : Raymar Hotels   (lng: 31.649)
//   Orient Marina: Atatürk Anıtı  (lng: 31.948)
//   Doğu sınır  : Utopia World    (lng: 32.128)
// ============================================================

// Koordinat bazlı bölge sınırları (gerçek otel verilerinden analiz edilmiş)
const REGIONS_BY_COORDS = [
  // --- BATI (kıyı boyunca doğuya) ---
  { name: "Okurcalar",      minLng: 31.64,  maxLng: 31.71 },
  { name: "İncekum",        minLng: 31.71,  maxLng: 31.77 },
  { name: "Avsallar",       minLng: 31.77,  maxLng: 31.81 },
  { name: "Türkler",        minLng: 31.81,  maxLng: 31.86 },
  { name: "Payallar",       minLng: 31.86,  maxLng: 31.90 },
  { name: "Konaklı",        minLng: 31.90,  maxLng: 31.95 },
  // --- MERKEZ (Orient Marina civarı) ---
  { name: "Atatürk Anıtı",  minLng: 31.95,  maxLng: 31.99 },
  { name: "Kleopatra",      minLng: 31.99,  maxLng: 32.00 },
  // --- DOĞU (yarımadanın doğusu) ---
  { name: "Tosmur",         minLng: 32.00,  maxLng: 32.06 },
  { name: "Kestel",         minLng: 32.06,  maxLng: 32.09 },
  { name: "Mahmutlar",      minLng: 32.09,  maxLng: 32.12 },
  { name: "Kargıcak",       minLng: 32.12,  maxLng: 32.20 },
];

// Adres override — SADECE güvenilir keyword'ler
// "atatürk" ve "kestel" gibi cadde adı olarak da geçen kelimeler ÇIKARILDı
const ADDRESS_OVERRIDES: { [key: string]: string[] } = {
  "Okurcalar":  ["okurcalar"],
  "İncekum":    ["incekum", "İncekum"],
  "Avsallar":   ["avsallar"],
  "Türkler":    ["türkler", "turkler"],
  "Payallar":   ["payallar"],
  "Konaklı":    ["konaklı", "konakli"],
  "Kleopatra":  ["kleopatra"],
  "Damlataş":   ["damlataş", "damlatas"],
  "Cikcilli":   ["cikcilli"],
  "Tosmur":     ["tosmur"],
  "Mahmutlar":  ["mahmutlar"],
  "Kargıcak":   ["kargıcak", "kargicak"],
  // NOT: "atatürk", "kestel", "oba" çıkarıldı — cadde adı olarak yanıltıcı
};

// Oba için özel kontrol — "Oba Mahallesi" veya "Oba," gibi kesin eşleşmeler
function isObaAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return lower.includes("oba mahallesi") ||
         lower.includes("oba mah.") ||
         lower.includes("oba mah,") ||
         /[, ]oba[, ]/.test(lower) ||
         lower.startsWith("oba,") ||
         lower.startsWith("oba ");
}

// Kestel mahallesi mi yoksa Kestel Caddesi mi?
function isKestelMahallesi(address: string, lng: number): boolean {
  const lower = address.toLowerCase();
  // Adresinde "kestel" var VE koordinat gerçek Kestel bölgesindeyse (32.05+)
  if (lower.includes("kestel") && lng >= 32.05) return true;
  // Aksi halde sadece cadde adı
  return false;
}

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
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Otel mi kontrolü
function isHotel(name: string, category: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();

  if (lowerCategory.includes('hotel') || lowerCategory.includes('otel') ||
      lowerCategory.includes('resort') || lowerCategory.includes('konaklama')) {
    for (const keyword of BLACKLIST) {
      if (lowerName.includes(keyword) && !lowerName.includes('hotel') && !lowerName.includes('otel')) {
        return false;
      }
    }
    return true;
  }

  if (lowerName.includes('hotel') || lowerName.includes('otel') ||
      lowerName.includes('resort') || lowerName.includes('palace')) {
    for (const keyword of BLACKLIST) {
      if (lowerName.includes(keyword)) return false;
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
  return null;
}

// Adres override — güvenli keyword'ler
function getAddressOverride(address: string | null, lng: number): string | null {
  if (!address) return null;
  const lowerAddress = address.toLowerCase();

  // Özel kontroller
  if (isObaAddress(address)) return "Oba";
  if (isKestelMahallesi(address, lng)) return "Kestel";

  // Genel keyword eşleşmeleri
  for (const [region, keywords] of Object.entries(ADDRESS_OVERRIDES)) {
    for (const keyword of keywords) {
      if (lowerAddress.includes(keyword.toLowerCase())) {
        return region;
      }
    }
  }
  return null;
}

// Bölge belirleme: 1) Adres override, 2) Koordinat
function determineRegion(lng: number, address: string | null): string | null {
  const addressOverride = getAddressOverride(address, lng);
  if (addressOverride) return addressOverride;
  return getRegionByCoordinates(lng);
}

// Apify sorgu parametreleri
const input = {
  "searchStringsArray": [
    "Hotel", "Otel", "Resort",
    "Apart otel", "Apart Hotel",
    "Resort hotel", "Butik otel", "Boutique hotel",
    "Beach hotel", "Spa hotel",
    "5 yıldızlı otel", "4 yıldızlı otel", "3 yıldızlı otel",
    "Tatil köyü", "Holiday resort", "All inclusive hotel"
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
        [31.64, 36.40],
        [32.20, 36.40],
        [32.20, 36.75],
        [31.64, 36.75],
        [31.64, 36.40]
      ]
    ]
  },
  "zoom": 14,
};

const ORDERED_REGIONS = [
  "Okurcalar", "İncekum", "Avsallar", "Türkler", "Payallar", "Konaklı",
  "Atatürk Anıtı", "Kleopatra", "Damlataş",
  "Oba", "Cikcilli", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak"
];

(async () => {
  console.log('='.repeat(60));
  console.log('🏨 OTEL VERİLERİ YENİDEN ÇEKİLİYOR (v3)');
  console.log('='.repeat(60));
  console.log('Orient Marina : lng 31.9484 (Atatürk Anıtı bölgesi)');
  console.log('Batı sınır    : Raymar Hotels (lng: 31.649)');
  console.log('Doğu sınır    : Utopia World  (lng: 32.128)\n');

  // ========================================
  // ADIM 1: Otelleri temizle
  // ========================================
  const deletedCount = await prisma.hotel.deleteMany({});
  console.log(`🗑️  ${deletedCount.count} otel silindi.`);

  // ========================================
  // ADIM 2: Çenger deaktif et
  // ========================================
  await prisma.region.updateMany({ where: { name: "Çenger" }, data: { isActive: false } });

  // Çenger seans saatlerini temizle
  const cengerRegion = await prisma.region.findFirst({ where: { name: "Çenger" } });
  if (cengerRegion) {
    await prisma.regionSessionTime.deleteMany({ where: { regionId: cengerRegion.id } });
    console.log('❌ Çenger deaktif, seans saatleri temizlendi.');
  }

  // ========================================
  // ADIM 3: Bölgeleri oluştur/aktif et
  // ========================================
  for (const name of ORDERED_REGIONS) {
    await prisma.region.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  const allRegions = await prisma.region.findMany();
  const regionMap = new Map(allRegions.map(r => [r.name, r.id]));

  // Delegasyonlar
  if (regionMap.get("Payallar") && regionMap.get("Okurcalar")) {
    await prisma.region.update({
      where: { id: regionMap.get("Payallar")! },
      data: { pickupTimeRegionId: regionMap.get("Okurcalar")! },
    });
  }
  if (regionMap.get("Cikcilli") && regionMap.get("Tosmur")) {
    await prisma.region.update({
      where: { id: regionMap.get("Cikcilli")! },
      data: { pickupTimeRegionId: regionMap.get("Tosmur")! },
    });
  }

  console.log(`✅ ${ORDERED_REGIONS.length} bölge hazır.\n`);

  // ========================================
  // ADIM 4: Ham veriyi oku (önceki çalıştırmadan)
  // ========================================
  const rawPath = path.join(process.cwd(), 'scripts', 'hotels-raw-apify.json');
  let items: any[];

  if (fs.existsSync(rawPath)) {
    console.log('📂 Mevcut ham veri dosyası kullanılıyor (Apify tekrar çağrılmıyor)...');
    items = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
    console.log(`📥 ${items.length} kayıt okundu.\n`);
  } else {
    console.log('🔄 Apify sorgusu çalıştırılıyor...');
    const run = await client.actor("nwua9Gu5YrADL7ZDj").call(input);
    const dataset = await client.dataset(run.defaultDatasetId).listItems();
    items = dataset.items;
    fs.writeFileSync(rawPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`📥 ${items.length} kayıt alındı.\n`);
  }

  // ========================================
  // ADIM 5: Filtrele, bölge ata, kaydet
  // ========================================
  let addedCount = 0;
  let skippedNotHotel = 0;
  let skippedNoCoords = 0;
  let skippedOutOfBounds = 0;
  let skippedDuplicate = 0;
  const addedNames = new Set<string>();
  const regionCounts: Record<string, number> = {};
  const outOfBounds: { name: string; lng: number; address: string }[] = [];

  for (const item of items) {
    const name = item.title?.trim();
    const lat = item.location?.lat;
    const lng = item.location?.lng;
    const category = item.categoryName || '';

    if (!lat || !lng) { skippedNoCoords++; continue; }
    if (!isHotel(name || '', category)) { skippedNotHotel++; continue; }

    const nameKey = name?.toLowerCase().trim();
    if (addedNames.has(nameKey)) { skippedDuplicate++; continue; }

    const regionName = determineRegion(lng, item.address);
    if (!regionName) {
      skippedOutOfBounds++;
      outOfBounds.push({ name, lng, address: item.address || '' });
      continue;
    }

    const regionId = regionMap.get(regionName);
    if (!regionId) {
      console.log(`⚠️ DB'de bölge yok: ${regionName} - ${name}`);
      continue;
    }

    const distance = calculateDistance(ORIENT_MARINA.lat, ORIENT_MARINA.lng, lat, lng);

    await prisma.hotel.create({
      data: {
        name: name || 'İsimsiz',
        address: item.address || null,
        googleMapsUrl: item.url || null,
        lat, lng,
        distanceToMarina: distance,
        regionId,
      }
    });

    addedNames.add(nameKey);
    addedCount++;
    regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
  }

  // ========================================
  // SONUÇ RAPORU
  // ========================================
  console.log('='.repeat(60));
  console.log('📊 SONUÇ RAPORU');
  console.log('='.repeat(60));
  console.log(`✅ Eklenen otel     : ${addedCount}`);
  console.log(`🚫 Otel değil       : ${skippedNotHotel}`);
  console.log(`📍 Koordinat yok    : ${skippedNoCoords}`);
  console.log(`🗺️  Sınır dışı       : ${skippedOutOfBounds}`);
  console.log(`♻️  Tekrar eden      : ${skippedDuplicate}`);

  console.log('\n📊 BÖLGELERE GÖRE DAĞILIM:\n');
  for (const name of ORDERED_REGIONS) {
    const count = regionCounts[name] || 0;
    const bar = '█'.repeat(Math.min(count, 50));
    console.log(`  ${name.padEnd(20)} ${String(count).padStart(4)} otel  ${bar}`);
  }
  console.log(`\n  ${'TOPLAM'.padEnd(20)} ${String(addedCount).padStart(4)} otel`);

  if (outOfBounds.length > 0) {
    console.log(`\n⚠️ SINIR DIŞI (${outOfBounds.length}):`);
    outOfBounds.slice(0, 15).forEach(h =>
      console.log(`  ${h.name.substring(0,35).padEnd(36)} lng:${h.lng.toFixed(4)}  ${h.address.substring(0,40)}`)
    );
  }

  // Doğrulama: her bölgenin lng aralığı
  console.log('\n📏 BÖLGE DOĞRULAMA (gerçek lng aralıkları):\n');
  for (const name of ORDERED_REGIONS) {
    const regionId = regionMap.get(name);
    if (!regionId) continue;
    const hotels = await prisma.hotel.findMany({
      where: { regionId, lng: { not: null } },
      select: { lng: true },
      orderBy: { lng: 'asc' }
    });
    if (hotels.length === 0) { console.log(`  ${name.padEnd(20)} (boş)`); continue; }
    const lngs = hotels.map(h => h.lng!);
    console.log(`  ${name.padEnd(20)} ${String(hotels.length).padStart(4)} otel  lng: ${Math.min(...lngs).toFixed(4)} — ${Math.max(...lngs).toFixed(4)}`);
  }

  console.log('\n📍 EN YAKIN 5 OTEL (Orient Marina\'ya):');
  const nearest = await prisma.hotel.findMany({ orderBy: { distanceToMarina: 'asc' }, take: 5, include: { region: true } });
  nearest.forEach((h, i) => console.log(`  ${i+1}. ${h.name} — ${h.region.name} (${h.distanceToMarina} km)`));

  console.log('\n📍 EN UZAK 5 OTEL:');
  const farthest = await prisma.hotel.findMany({ orderBy: { distanceToMarina: 'desc' }, take: 5, include: { region: true } });
  farthest.forEach((h, i) => console.log(`  ${i+1}. ${h.name} — ${h.region.name} (${h.distanceToMarina} km)`));

  console.log('\n✅ Tamamlandı!');
  await prisma.$disconnect();
})();
