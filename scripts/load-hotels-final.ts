import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Orient Marina gerçek lokasyonu
const ORIENT_MARINA = { lat: 36.5604, lng: 31.9484 };

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zçğıöşü0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Koordinat bazlı bölge sınırları (yeni oteller için)
const REGIONS_BY_COORDS = [
  { name: "Okurcalar",      minLng: 31.64,  maxLng: 31.71 },
  { name: "İncekum",        minLng: 31.71,  maxLng: 31.77 },
  { name: "Avsallar",       minLng: 31.77,  maxLng: 31.81 },
  { name: "Türkler",        minLng: 31.81,  maxLng: 31.86 },
  { name: "Payallar",       minLng: 31.86,  maxLng: 31.90 },
  { name: "Konaklı",        minLng: 31.90,  maxLng: 31.95 },
  { name: "Atatürk Anıtı",  minLng: 31.95,  maxLng: 31.99 },
  { name: "Kleopatra",      minLng: 31.99,  maxLng: 32.00 },
  { name: "Tosmur",         minLng: 32.00,  maxLng: 32.06 },
  { name: "Kestel",         minLng: 32.06,  maxLng: 32.09 },
  { name: "Mahmutlar",      minLng: 32.09,  maxLng: 32.12 },
  { name: "Kargıcak",       minLng: 32.12,  maxLng: 32.20 },
];

// Adres override (yeni oteller için bölge tespiti)
const ADDRESS_OVERRIDES: { [key: string]: string[] } = {
  "Okurcalar": ["okurcalar"],
  "İncekum": ["incekum", "İncekum"],
  "Avsallar": ["avsallar"],
  "Türkler": ["türkler", "turkler"],
  "Payallar": ["payallar"],
  "Konaklı": ["konaklı", "konakli"],
  "Kleopatra": ["kleopatra"],
  "Damlataş": ["damlataş", "damlatas"],
  "Cikcilli": ["cikcilli"],
  "Tosmur": ["tosmur"],
  "Mahmutlar": ["mahmutlar"],
  "Kargıcak": ["kargıcak", "kargicak"],
};

function isObaAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return lower.includes("oba mahallesi") ||
    lower.includes("oba mah.") ||
    lower.includes("oba mah,") ||
    /[, ]oba[, ]/.test(lower) ||
    lower.startsWith("oba,") ||
    lower.startsWith("oba ");
}

function isKestelMahallesi(address: string, lng: number): boolean {
  const lower = address.toLowerCase();
  if (lower.includes("kestel") && lng >= 32.05) return true;
  return false;
}

function getRegionByCoordinates(lng: number): string | null {
  for (const region of REGIONS_BY_COORDS) {
    if (lng >= region.minLng && lng < region.maxLng) {
      return region.name;
    }
  }
  return null;
}

function getAddressOverride(address: string | null, lng: number): string | null {
  if (!address) return null;
  const lowerAddress = address.toLowerCase();
  if (isObaAddress(address)) return "Oba";
  if (isKestelMahallesi(address, lng)) return "Kestel";
  for (const [region, keywords] of Object.entries(ADDRESS_OVERRIDES)) {
    for (const keyword of keywords) {
      if (lowerAddress.includes(keyword.toLowerCase())) {
        return region;
      }
    }
  }
  return null;
}

function determineRegion(lng: number, address: string | null): string | null {
  const addressOverride = getAddressOverride(address, lng);
  if (addressOverride) return addressOverride;
  return getRegionByCoordinates(lng);
}

// Final aktif bölge listesi
const ACTIVE_REGIONS = [
  "Okurcalar", "İncekum", "Avsallar", "Türkler", "Payallar", "Konaklı",
  "Atatürk Anıtı", "Kleopatra", "Damlataş",
  "Oba", "Cikcilli", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak"
];

const DISPLAY_ORDER = [
  "Okurcalar", "İncekum", "Avsallar", "Türkler", "Payallar", "Konaklı",
  "Atatürk Anıtı", "Kleopatra", "Damlataş",
  "Oba", "Cikcilli", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak"
];

(async () => {
  console.log('='.repeat(60));
  console.log('🏨 OTEL VERİLERİ — ESKİ YEDEK BAZ + YENİ EKLEME');
  console.log('='.repeat(60));
  console.log('Strateji: Eski yedek (925 otel) aynen yükle');
  console.log('          Yeni çekimden sadece eksik otelleri ekle');
  console.log('          Çenger deaktif, diğer bölgeler aktif\n');

  // ========================================
  // 1. Eski yedek + yeni ham veri oku
  // ========================================
  const backupPath = path.join(process.cwd(), 'scripts', 'hotels-backup-2026-03-19T17-14-18.json');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  console.log(`📂 Eski yedek: ${backup.totalHotels} otel`);

  const rawPath = path.join(process.cwd(), 'scripts', 'hotels-raw-apify.json');
  const rawItems: any[] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  console.log(`📂 Yeni Apify ham veri: ${rawItems.length} kayıt`);

  // ========================================
  // 2. DB temizle
  // ========================================
  const deleted = await prisma.hotel.deleteMany({});
  console.log(`\n🗑️  ${deleted.count} otel silindi.`);

  // ========================================
  // 3. Çenger deaktif, diğer bölgeler aktif
  // ========================================
  await prisma.region.updateMany({ where: { name: "Çenger" }, data: { isActive: false } });
  await prisma.region.updateMany({ where: { name: "Alanya Merkez" }, data: { isActive: false } });
  const cengerRegion = await prisma.region.findFirst({ where: { name: "Çenger" } });
  if (cengerRegion) {
    await prisma.regionSessionTime.deleteMany({ where: { regionId: cengerRegion.id } });
  }

  for (const name of ACTIVE_REGIONS) {
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

  console.log(`✅ ${ACTIVE_REGIONS.length} aktif bölge hazır.\n`);

  // ========================================
  // 4. Eski yedek otelleri yükle (Çenger hariç)
  // ========================================
  console.log('📥 Eski yedek yükleniyor...');
  const loadedNames = new Set<string>();
  let oldLoaded = 0;
  let oldSkipped = 0;
  const regionCounts: Record<string, number> = {};

  for (const h of backup.hotels) {
    const regionName = h.regionName;

    // Çenger ve Alanya Merkez atla
    if (regionName === "Çenger" || regionName === "Alanya Merkez") {
      oldSkipped++;
      continue;
    }

    const regionId = regionMap.get(regionName);
    if (!regionId) {
      console.log(`  ⚠️ Bölge yok: ${regionName} — ${h.name}`);
      oldSkipped++;
      continue;
    }

    // Mesafeyi Orient Marina'nın doğru koordinatıyla yeniden hesapla
    let distance = h.distanceToMarina;
    if (h.lat && h.lng) {
      distance = calculateDistance(ORIENT_MARINA.lat, ORIENT_MARINA.lng, h.lat, h.lng);
    }

    await prisma.hotel.create({
      data: {
        name: h.name,
        address: h.address || null,
        googleMapsUrl: h.googleMapsUrl || null,
        lat: h.lat || null,
        lng: h.lng || null,
        distanceToMarina: distance,
        regionId,
      },
    });

    loadedNames.add(normalizeHotelName(h.name));
    oldLoaded++;
    regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
  }

  console.log(`  ✅ ${oldLoaded} otel yüklendi (${oldSkipped} atlandı — Çenger/bölge yok)`);

  // ========================================
  // 5. Yeni çekimden eksik otelleri ekle
  // ========================================
  console.log('\n📥 Yeni çekimden eksik oteller ekleniyor...');

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

  function isHotel(name: string, category: string): boolean {
    const lowerName = name.toLowerCase();
    const lowerCategory = (category || '').toLowerCase();
    if (lowerCategory.includes('hotel') || lowerCategory.includes('otel') ||
        lowerCategory.includes('resort') || lowerCategory.includes('konaklama')) {
      for (const keyword of BLACKLIST) {
        if (lowerName.includes(keyword) && !lowerName.includes('hotel') && !lowerName.includes('otel')) return false;
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

  let newAdded = 0;
  let newSkippedExists = 0;
  let newSkippedNotHotel = 0;
  let newSkippedNoCoords = 0;
  let newSkippedOutOfBounds = 0;
  const newHotels: string[] = [];

  for (const item of rawItems) {
    const name = item.title?.trim();
    const lat = item.location?.lat;
    const lng = item.location?.lng;
    const category = item.categoryName || '';

    if (!lat || !lng) { newSkippedNoCoords++; continue; }
    if (!isHotel(name || '', category)) { newSkippedNotHotel++; continue; }

    const key = normalizeHotelName(name || '');
    if (loadedNames.has(key)) { newSkippedExists++; continue; }

    // Bölge belirle
    const regionName = determineRegion(lng, item.address);
    if (!regionName) { newSkippedOutOfBounds++; continue; }

    const regionId = regionMap.get(regionName);
    if (!regionId) { continue; }

    const distance = calculateDistance(ORIENT_MARINA.lat, ORIENT_MARINA.lng, lat, lng);

    await prisma.hotel.create({
      data: {
        name: name || 'İsimsiz',
        address: item.address || null,
        googleMapsUrl: item.url || null,
        lat, lng,
        distanceToMarina: distance,
        regionId,
      },
    });

    loadedNames.add(key);
    newAdded++;
    regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
    newHotels.push(`${name} → ${regionName}`);
  }

  console.log(`  ✅ ${newAdded} yeni otel eklendi`);
  console.log(`  ♻️  ${newSkippedExists} otel zaten vardı`);
  console.log(`  🚫 ${newSkippedNotHotel} otel değil`);
  console.log(`  📍 ${newSkippedNoCoords} koordinat yok`);
  console.log(`  🗺️  ${newSkippedOutOfBounds} sınır dışı`);

  // ========================================
  // SONUÇ RAPORU
  // ========================================
  const totalHotels = oldLoaded + newAdded;

  console.log('\n' + '='.repeat(60));
  console.log('📊 SONUÇ RAPORU');
  console.log('='.repeat(60));
  console.log(`  Eski yedekten      : ${oldLoaded} otel`);
  console.log(`  Yeni eklenen       : ${newAdded} otel`);
  console.log(`  TOPLAM             : ${totalHotels} otel`);

  console.log('\n📊 BÖLGELERE GÖRE DAĞILIM:\n');
  for (const name of DISPLAY_ORDER) {
    const count = regionCounts[name] || 0;
    const bar = '█'.repeat(Math.min(Math.ceil(count / 3), 50));
    console.log(`  ${name.padEnd(20)} ${String(count).padStart(4)} otel  ${bar}`);
  }
  console.log(`\n  ${'TOPLAM'.padEnd(20)} ${String(totalHotels).padStart(4)} otel`);

  if (newHotels.length > 0) {
    console.log(`\n📋 YENİ EKLENEN OTELLER (${newHotels.length}):\n`);
    newHotels.forEach(h => console.log(`  + ${h}`));
  }

  // Bölge doğrulama
  console.log('\n📏 BÖLGE DOĞRULAMA (gerçek lng aralıkları):\n');
  for (const name of DISPLAY_ORDER) {
    const regionId = regionMap.get(name);
    if (!regionId) continue;
    const hotels = await prisma.hotel.findMany({
      where: { regionId, lng: { not: null } },
      select: { lng: true },
      orderBy: { lng: 'asc' },
    });
    if (hotels.length === 0) { console.log(`  ${name.padEnd(20)} (boş)`); continue; }
    const lngs = hotels.map(h => h.lng!);
    console.log(`  ${name.padEnd(20)} ${String(hotels.length).padStart(4)} otel  lng: ${Math.min(...lngs).toFixed(4)} — ${Math.max(...lngs).toFixed(4)}`);
  }

  console.log('\n📍 EN YAKIN 5 OTEL (Orient Marina\'ya):');
  const nearest = await prisma.hotel.findMany({
    where: { distanceToMarina: { not: null } },
    orderBy: { distanceToMarina: 'asc' },
    take: 5,
    include: { region: true },
  });
  nearest.forEach((h, i) => console.log(`  ${i+1}. ${h.name} — ${h.region.name} (${h.distanceToMarina} km)`));

  console.log('\n📍 EN UZAK 5 OTEL:');
  const farthest = await prisma.hotel.findMany({
    where: { distanceToMarina: { not: null } },
    orderBy: { distanceToMarina: 'desc' },
    take: 5,
    include: { region: true },
  });
  farthest.forEach((h, i) => console.log(`  ${i+1}. ${h.name} — ${h.region.name} (${h.distanceToMarina} km)`));

  // Aktif/deaktif bölgeler
  console.log('\n📋 AKTİF BÖLGELER:');
  const activeRegions = await prisma.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  activeRegions.forEach(r => console.log(`  ✅ ${r.name}`));

  console.log('\n📋 DEAKTİF BÖLGELER:');
  const inactiveRegions = await prisma.region.findMany({ where: { isActive: false }, orderBy: { name: 'asc' } });
  inactiveRegions.forEach(r => console.log(`  ❌ ${r.name}`));

  console.log('\n✅ Tamamlandı!');
  await prisma.$disconnect();
})();
