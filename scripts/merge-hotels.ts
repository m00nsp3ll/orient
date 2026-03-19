import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Orient Marina gerçek lokasyonu
const ORIENT_MARINA = { lat: 36.5604, lng: 31.9484 };

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

// İsim normalize (karşılaştırma için)
function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zçğıöşü0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bölge birleştirme haritası
const REGION_MERGE: Record<string, string> = {
  "Payallar": "Türkler",     // Payallar → Türkler
  "Damlataş": "Kleopatra",   // Damlataş → Kleopatra
  "Çenger": "__REMOVE__",    // Çenger tamamen çıkarılacak
  "Alanya Merkez": "__REMOVE__",
};

// Son bölge listesi (sıralı)
const FINAL_REGIONS = [
  "Okurcalar", "İncekum", "Avsallar", "Türkler", "Konaklı",
  "Atatürk Anıtı", "Kleopatra",
  "Oba", "Cikcilli", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak"
];

interface HotelData {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
  distanceToMarina: number | null;
  regionName: string;
  source: 'old' | 'new' | 'both';
}

(async () => {
  console.log('='.repeat(60));
  console.log('🔀 OTEL VERİLERİ HARMANLANIYOR');
  console.log('='.repeat(60));
  console.log('Birleştirmeler:');
  console.log('  Türkler + Payallar → Türkler');
  console.log('  Damlataş + Kleopatra → Kleopatra');
  console.log('  Çenger → Kaldırıldı');
  console.log();

  // ========================================
  // 1. Eski yedek verilerini oku
  // ========================================
  const backupPath = path.join(process.cwd(), 'scripts', 'hotels-backup-2026-03-19T17-14-18.json');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  console.log(`📂 Eski yedek: ${backup.totalHotels} otel`);

  // ========================================
  // 2. Yeni DB'deki otelleri oku (v3 çekimi)
  // ========================================
  const currentHotels = await prisma.hotel.findMany({
    include: { region: true },
  });
  console.log(`📂 Yeni çekim (DB): ${currentHotels.length} otel`);

  // ========================================
  // 3. Her iki kaynağı normalize et ve birleştir
  // ========================================
  const mergedMap = new Map<string, HotelData>();

  // Önce yeni çekim (öncelikli — daha güncel koordinatlar)
  for (const h of currentHotels) {
    let regionName = h.region.name;
    // Bölge birleştirme
    if (REGION_MERGE[regionName] === "__REMOVE__") continue;
    if (REGION_MERGE[regionName]) regionName = REGION_MERGE[regionName];
    if (!FINAL_REGIONS.includes(regionName)) continue;

    const key = normalizeHotelName(h.name);
    mergedMap.set(key, {
      name: h.name,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      googleMapsUrl: h.googleMapsUrl,
      distanceToMarina: h.distanceToMarina,
      regionName,
      source: 'new',
    });
  }
  console.log(`  → Yeni çekimden: ${mergedMap.size} otel`);

  // Sonra eski yedek (sadece yeni olmayanları ekle)
  let addedFromOld = 0;
  let skippedMerge = 0;
  let skippedRegion = 0;
  let updatedFromOld = 0;

  for (const h of backup.hotels) {
    let regionName = h.regionName;
    // Bölge birleştirme
    if (REGION_MERGE[regionName] === "__REMOVE__") { skippedRegion++; continue; }
    if (REGION_MERGE[regionName]) regionName = REGION_MERGE[regionName];
    if (!FINAL_REGIONS.includes(regionName)) { skippedRegion++; continue; }

    const key = normalizeHotelName(h.name);

    if (mergedMap.has(key)) {
      // Zaten var — ama eski verinin eksik bilgisi olabilir, tamamla
      const existing = mergedMap.get(key)!;
      // Eski veriden adres/maps URL tamamla (yeni yoksa)
      if (!existing.address && h.address) existing.address = h.address;
      if (!existing.googleMapsUrl && h.googleMapsUrl) existing.googleMapsUrl = h.googleMapsUrl;
      existing.source = 'both';
      skippedMerge++;
    } else {
      // Yeni çekimde yok — ekle
      const lat = h.lat;
      const lng = h.lng;
      const distance = lat && lng
        ? calculateDistance(ORIENT_MARINA.lat, ORIENT_MARINA.lng, lat, lng)
        : h.distanceToMarina;

      mergedMap.set(key, {
        name: h.name,
        address: h.address,
        lat, lng,
        googleMapsUrl: h.googleMapsUrl,
        distanceToMarina: distance,
        regionName,
        source: 'old',
      });
      addedFromOld++;
    }
  }

  console.log(`  → Eski yedekten eklenen: ${addedFromOld} yeni otel`);
  console.log(`  → Her iki kaynakta ortak: ${skippedMerge} otel`);
  console.log(`  → Kaldırılan bölge: ${skippedRegion} otel (Çenger/Alanya Merkez)`);
  console.log(`  → TOPLAM: ${mergedMap.size} benzersiz otel\n`);

  // ========================================
  // 4. DB'yi temizle ve yeniden oluştur
  // ========================================

  // 4a. Tüm otelleri sil
  const deleted = await prisma.hotel.deleteMany({});
  console.log(`🗑️  ${deleted.count} otel silindi.`);

  // 4b. Çenger ve Alanya Merkez deaktif
  await prisma.region.updateMany({ where: { name: "Çenger" }, data: { isActive: false } });
  await prisma.region.updateMany({ where: { name: "Alanya Merkez" }, data: { isActive: false } });

  // 4c. Payallar deaktif et (Türkler'e birleşti)
  await prisma.region.updateMany({ where: { name: "Payallar" }, data: { isActive: false } });

  // 4d. Damlataş deaktif et (Kleopatra'ya birleşti)
  await prisma.region.updateMany({ where: { name: "Damlataş" }, data: { isActive: false } });

  // Payallar ve Damlataş seans saatlerini temizle
  const payallarRegion = await prisma.region.findFirst({ where: { name: "Payallar" } });
  if (payallarRegion) {
    await prisma.regionSessionTime.deleteMany({ where: { regionId: payallarRegion.id } });
  }
  const damlatashRegion = await prisma.region.findFirst({ where: { name: "Damlataş" } });
  if (damlatashRegion) {
    await prisma.regionSessionTime.deleteMany({ where: { regionId: damlatashRegion.id } });
  }
  const cengerRegion = await prisma.region.findFirst({ where: { name: "Çenger" } });
  if (cengerRegion) {
    await prisma.regionSessionTime.deleteMany({ where: { regionId: cengerRegion.id } });
  }

  console.log('❌ Çenger, Payallar, Damlataş deaktif edildi.\n');

  // 4e. Final bölgeleri aktif et
  for (const name of FINAL_REGIONS) {
    await prisma.region.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  const allRegions = await prisma.region.findMany();
  const regionMap = new Map(allRegions.map(r => [r.name, r.id]));

  // Delegasyonlar
  // Cikcilli → Tosmur seans saatleri
  if (regionMap.get("Cikcilli") && regionMap.get("Tosmur")) {
    await prisma.region.update({
      where: { id: regionMap.get("Cikcilli")! },
      data: { pickupTimeRegionId: regionMap.get("Tosmur")! },
    });
  }

  console.log(`✅ ${FINAL_REGIONS.length} aktif bölge hazır.\n`);

  // ========================================
  // 5. Otelleri kaydet
  // ========================================
  let savedCount = 0;
  const regionCounts: Record<string, number> = {};
  const sourceCounts = { old: 0, new: 0, both: 0 };

  for (const [, hotel] of mergedMap) {
    const regionId = regionMap.get(hotel.regionName);
    if (!regionId) {
      console.log(`⚠️ Bölge bulunamadı: ${hotel.regionName} — ${hotel.name}`);
      continue;
    }

    await prisma.hotel.create({
      data: {
        name: hotel.name,
        address: hotel.address,
        googleMapsUrl: hotel.googleMapsUrl,
        lat: hotel.lat,
        lng: hotel.lng,
        distanceToMarina: hotel.distanceToMarina,
        regionId,
      },
    });

    savedCount++;
    regionCounts[hotel.regionName] = (regionCounts[hotel.regionName] || 0) + 1;
    sourceCounts[hotel.source]++;
  }

  // ========================================
  // SONUÇ RAPORU
  // ========================================
  console.log('='.repeat(60));
  console.log('📊 HARMANLAMA SONUÇ RAPORU');
  console.log('='.repeat(60));
  console.log(`✅ Toplam kaydedilen : ${savedCount} otel`);
  console.log(`   Sadece yeni çekim : ${sourceCounts.new}`);
  console.log(`   Sadece eski yedek : ${sourceCounts.old}`);
  console.log(`   Her ikisinde de   : ${sourceCounts.both}`);

  console.log('\n📊 BÖLGELERE GÖRE DAĞILIM:\n');
  for (const name of FINAL_REGIONS) {
    const count = regionCounts[name] || 0;
    const bar = '█'.repeat(Math.min(Math.ceil(count / 3), 50));
    console.log(`  ${name.padEnd(20)} ${String(count).padStart(4)} otel  ${bar}`);
  }
  console.log(`\n  ${'TOPLAM'.padEnd(20)} ${String(savedCount).padStart(4)} otel`);

  // Sadece eski yedekten gelen oteller
  console.log('\n📋 ESKİ YEDEKTEN EKLENEN OTELLER:\n');
  let oldOnlyCount = 0;
  for (const [, hotel] of mergedMap) {
    if (hotel.source === 'old') {
      console.log(`  + ${hotel.name} → ${hotel.regionName}`);
      oldOnlyCount++;
    }
  }
  if (oldOnlyCount === 0) console.log('  (Yeni çekimde tüm oteller zaten mevcut)');

  // Bölge doğrulama
  console.log('\n📏 BÖLGE DOĞRULAMA (gerçek lng aralıkları):\n');
  for (const name of FINAL_REGIONS) {
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
  const nearest = await prisma.hotel.findMany({ orderBy: { distanceToMarina: 'asc' }, take: 5, include: { region: true } });
  nearest.forEach((h, i) => console.log(`  ${i+1}. ${h.name} — ${h.region.name} (${h.distanceToMarina} km)`));

  console.log('\n📍 EN UZAK 5 OTEL:');
  const farthest = await prisma.hotel.findMany({ orderBy: { distanceToMarina: 'desc' }, take: 5, include: { region: true } });
  farthest.forEach((h, i) => console.log(`  ${i+1}. ${h.name} — ${h.region.name} (${h.distanceToMarina} km)`));

  // Aktif bölge listesi
  console.log('\n📋 AKTİF BÖLGELER:');
  const activeRegions = await prisma.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  activeRegions.forEach(r => console.log(`  ✅ ${r.name}`));

  console.log('\n📋 DEAKTİF BÖLGELER:');
  const inactiveRegions = await prisma.region.findMany({ where: { isActive: false }, orderBy: { name: 'asc' } });
  inactiveRegions.forEach(r => console.log(`  ❌ ${r.name}`));

  console.log('\n✅ Harmanlama tamamlandı!');
  await prisma.$disconnect();
})();
