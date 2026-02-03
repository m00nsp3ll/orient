import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Orient Marina lokasyonu
const ORIENT_MARINA = { lat: 36.5509, lng: 31.9961 };

// Bölgeler - koordinat sınırları (batıdan doğuya, longitude bazlı)
// Her bölge için minLng ve maxLng değerleri
const REGIONS_BY_COORDS = [
  { name: "Okurcalar", minLng: 31.65, maxLng: 31.72 },
  { name: "Avsallar", minLng: 31.72, maxLng: 31.80 },
  { name: "Türkler", minLng: 31.80, maxLng: 31.87 },
  { name: "Konaklı", minLng: 31.87, maxLng: 31.94 },
  { name: "Alanya Merkez", minLng: 31.94, maxLng: 32.02 },
  { name: "Tosmur", minLng: 32.02, maxLng: 32.055 },
  { name: "Kestel", minLng: 32.055, maxLng: 32.085 },
  { name: "Mahmutlar", minLng: 32.085, maxLng: 32.125 },
  { name: "Kargıcak", minLng: 32.125, maxLng: 32.20 },
];

// Adreste açıkça yazıyorsa override et (sadece belirgin olanlar)
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

// Otel OLMAYAN yerleri tespit etmek için blacklist
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

// Haversine formülü
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Otel mi değil mi kontrol et
function isHotel(name: string): boolean {
  const lowerName = name.toLowerCase();

  for (const keyword of BLACKLIST) {
    if (lowerName.includes(keyword)) {
      if (lowerName.includes('hotel') || lowerName.includes('otel')) {
        if (!lowerName.includes('lojman') && !lowerName.includes('personel')) {
          return true;
        }
      }
      return false;
    }
  }

  return true;
}

// 1. Koordinata göre bölge belirle
function getRegionByCoordinates(lng: number): string {
  for (const region of REGIONS_BY_COORDS) {
    if (lng >= region.minLng && lng < region.maxLng) {
      return region.name;
    }
  }
  return "Alanya Merkez"; // Varsayılan
}

// 2. Adreste açıkça bölge adı yazıyorsa override et
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

// Bölge belirleme: Önce koordinat, sonra adres override
function determineRegion(lng: number, address: string | null): string {
  // 1. Önce koordinata göre bölge belirle
  const coordRegion = getRegionByCoordinates(lng);

  // 2. Adreste açıkça farklı bir bölge yazıyorsa onu kullan
  const addressOverride = getAddressOverride(address);

  if (addressOverride) {
    return addressOverride;
  }

  return coordRegion;
}

async function main() {
  console.log('🏨 Otel verileri işleniyor...\n');

  // JSON verisini oku
  const content = fs.readFileSync(
    '/Users/harunsivasli/.claude/projects/-Users-harunsivasli-orient/f8aa5a36-9b34-45b2-b611-971a5489cfee/tool-results/toolu_vrtx_01H3WwF5frxisvRTvus6WAN6.txt',
    'utf-8'
  );

  // JSON array'i bul
  const lines = content.split('\n');
  const jsonStartIndex = lines.findIndex(line => line.includes('Found') && line.includes('hotels:'));
  const jsonPart = lines.slice(jsonStartIndex + 2).join('\n');
  const jsonEndIndex = jsonPart.lastIndexOf(']');
  const hotels = JSON.parse(jsonPart.substring(0, jsonEndIndex + 1));

  console.log(`📊 Toplam ${hotels.length} kayıt bulundu.\n`);

  // Filtrele
  const filteredHotels = hotels.filter((h: any) => {
    if (!h.lat || !h.lng) return false;
    if (!isHotel(h.name || '')) return false;
    return true;
  });

  console.log(`✅ ${filteredHotels.length} otel filtreleme sonrası kaldı.\n`);

  // Mevcut otelleri sil
  await prisma.hotel.deleteMany({});
  console.log('🗑️  Eski otel verileri silindi.\n');

  // Bölgeleri oluştur
  const regionNames = ["Okurcalar", "Avsallar", "Türkler", "Konaklı", "Oba", "Alanya Merkez", "Cikcilli", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak"];

  for (const name of regionNames) {
    await prisma.region.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const regions = await prisma.region.findMany();
  const regionMap = new Map(regions.map(r => [r.name, r.id]));

  // Otelleri kaydet
  let savedCount = 0;
  const regionCounts: { [key: string]: number } = {};

  for (const hotel of filteredHotels) {
    // Önce koordinat, sonra adres override ile bölge belirle
    const regionName = determineRegion(hotel.lng, hotel.address);
    const regionId = regionMap.get(regionName)!;

    const distance = calculateDistance(ORIENT_MARINA.lat, ORIENT_MARINA.lng, hotel.lat, hotel.lng);

    await prisma.hotel.create({
      data: {
        name: hotel.name?.trim() || 'İsimsiz',
        address: hotel.address || null,
        googleMapsUrl: hotel.googleMapsUrl || null,
        lat: hotel.lat,
        lng: hotel.lng,
        distanceToMarina: distance,
        regionId,
      }
    });

    savedCount++;
    regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
  }

  console.log('\n=== 📊 BÖLGELERE GÖRE OTEL SAYILARI ===\n');
  regionNames.forEach(region => {
    console.log(`  ${region}: ${regionCounts[region] || 0} otel`);
  });

  console.log(`\n✅ Toplam ${savedCount} otel veritabanına kaydedildi.`);

  // En yakın/uzak oteller
  const nearest = await prisma.hotel.findMany({ orderBy: { distanceToMarina: 'asc' }, take: 5, include: { region: true } });
  const farthest = await prisma.hotel.findMany({ orderBy: { distanceToMarina: 'desc' }, take: 5, include: { region: true } });

  console.log('\n=== 📍 EN YAKIN 5 OTEL ===\n');
  nearest.forEach((h, i) => console.log(`  ${i + 1}. ${h.name} - ${h.region.name} - ${h.distanceToMarina} km`));

  console.log('\n=== 📍 EN UZAK 5 OTEL ===\n');
  farthest.forEach((h, i) => console.log(`  ${i + 1}. ${h.name} - ${h.region.name} - ${h.distanceToMarina} km`));

  // Bazı örnek otelleri göster (kontrol için)
  console.log('\n=== 🔍 ÖRNEK OTELLER (Okurcalar/Avsallar) ===\n');
  const sampleHotels = await prisma.hotel.findMany({
    where: {
      OR: [
        { region: { name: "Okurcalar" } },
        { region: { name: "Avsallar" } },
      ]
    },
    take: 10,
    include: { region: true }
  });
  sampleHotels.forEach(h => {
    console.log(`  ${h.name}`);
    console.log(`    Bölge: ${h.region.name} | Lng: ${h.lng}`);
    console.log(`    Adres: ${h.address?.substring(0, 60)}...`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
