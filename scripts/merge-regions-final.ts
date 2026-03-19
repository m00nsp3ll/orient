import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Birleştirme: kaynak → hedef
const MERGE_MAP: Record<string, string> = {
  "Damlataş": "Kleopatra",
  "Cikcilli": "Tosmur",
};

// Final aktif bölgeler
const FINAL_REGIONS = [
  "Okurcalar", "İncekum", "Avsallar", "Türkler", "Payallar", "Konaklı",
  "Atatürk Anıtı", "Kleopatra",
  "Oba", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak"
];

(async () => {
  console.log('='.repeat(60));
  console.log('🔀 BÖLGE BİRLEŞTİRME');
  console.log('='.repeat(60));
  console.log('  Damlataş → Kleopatra');
  console.log('  Cikcilli → Tosmur\n');

  const allRegions = await prisma.region.findMany();
  const regionMap = new Map(allRegions.map(r => [r.name, r.id]));

  // 1. Otelleri taşı
  for (const [source, target] of Object.entries(MERGE_MAP)) {
    const sourceId = regionMap.get(source);
    const targetId = regionMap.get(target);
    if (!sourceId || !targetId) {
      console.log(`⚠️ Bölge bulunamadı: ${source} veya ${target}`);
      continue;
    }

    const count = await prisma.hotel.count({ where: { regionId: sourceId } });
    await prisma.hotel.updateMany({
      where: { regionId: sourceId },
      data: { regionId: targetId },
    });
    console.log(`  ✅ ${count} otel: ${source} → ${target}`);
  }

  // 2. Birleşen bölgeleri deaktif et + seans saatlerini temizle
  for (const source of Object.keys(MERGE_MAP)) {
    const sourceId = regionMap.get(source);
    if (!sourceId) continue;

    await prisma.regionSessionTime.deleteMany({ where: { regionId: sourceId } });
    await prisma.region.update({
      where: { id: sourceId },
      data: { isActive: false, pickupTimeRegionId: null },
    });
    console.log(`  ❌ ${source} deaktif edildi`);
  }

  // 3. Final bölgeleri aktif et
  for (const name of FINAL_REGIONS) {
    await prisma.region.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  // Delegasyonlar
  const updatedRegions = await prisma.region.findMany();
  const updatedMap = new Map(updatedRegions.map(r => [r.name, r.id]));

  if (updatedMap.get("Payallar") && updatedMap.get("Okurcalar")) {
    await prisma.region.update({
      where: { id: updatedMap.get("Payallar")! },
      data: { pickupTimeRegionId: updatedMap.get("Okurcalar")! },
    });
  }

  // Cikcilli artık bölge değil, Tosmur delegasyonunu temizle
  // (Cikcilli'nin delegasyonu zaten gereksiz, Cikcilli deaktif)

  // 4. Sonuç raporu
  console.log('\n📊 BÖLGELERE GÖRE DAĞILIM:\n');
  let total = 0;
  for (const name of FINAL_REGIONS) {
    const id = updatedMap.get(name);
    if (!id) continue;
    const count = await prisma.hotel.count({ where: { regionId: id } });
    total += count;
    const bar = '█'.repeat(Math.min(Math.ceil(count / 3), 50));
    console.log(`  ${name.padEnd(20)} ${String(count).padStart(4)} otel  ${bar}`);
  }
  console.log(`\n  ${'TOPLAM'.padEnd(20)} ${String(total).padStart(4)} otel`);

  console.log('\n📋 AKTİF BÖLGELER:');
  const active = await prisma.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  active.forEach(r => console.log(`  ✅ ${r.name}`));

  console.log('\n📋 DEAKTİF BÖLGELER:');
  const inactive = await prisma.region.findMany({ where: { isActive: false }, orderBy: { name: 'asc' } });
  inactive.forEach(r => console.log(`  ❌ ${r.name}`));

  console.log('\n✅ Tamamlandı!');
  await prisma.$disconnect();
})();
