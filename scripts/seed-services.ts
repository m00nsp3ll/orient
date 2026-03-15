import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: "SPA Paketleri", order: 1 },
];

const services = [
  { name: "Klasik Paket", description: "Hamam + Kese + Köpük + Klasik Masaj", price: 30, currency: "EUR", categoryName: "SPA Paketleri" },
  { name: "Gold Paket", description: "Hamam + Kese + Köpük + Gold Masaj + Cilt Bakımı", price: 45, currency: "EUR", categoryName: "SPA Paketleri" },
  { name: "Aloe Vera Paket", description: "Hamam + Kese + Köpük + Aloe Vera Masaj + Peeling", price: 40, currency: "EUR", categoryName: "SPA Paketleri" },
];

async function main() {
  console.log('🧖 Hizmetler güncelleniyor...\n');

  // Mevcut hizmetleri deaktif et
  await prisma.service.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
  console.log('  ⏸️  Mevcut hizmetler deaktif edildi\n');

  // Kategoriyi oluştur
  for (const cat of categories) {
    const existing = await prisma.serviceCategory.findFirst({ where: { name: cat.name } });
    if (existing) {
      await prisma.serviceCategory.update({ where: { id: existing.id }, data: { order: cat.order } });
    } else {
      await prisma.serviceCategory.create({ data: cat });
    }
  }
  console.log(`✅ ${categories.length} kategori oluşturuldu\n`);

  // Kategorileri al
  const dbCategories = await prisma.serviceCategory.findMany();
  const categoryMap = new Map(dbCategories.map(c => [c.name, c.id]));

  // Hizmetleri oluştur
  let count = 0;
  for (const service of services) {
    const { categoryName, ...data } = service;
    const categoryId = categoryMap.get(categoryName);

    const existing = await prisma.service.findFirst({ where: { name: data.name } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { ...data, categoryId, isActive: true },
      });
    } else {
      await prisma.service.create({
        data: { ...data, categoryId, isActive: true },
      });
    }
    count++;
    console.log(`  ✅ ${data.name} (${data.price}€)`);
  }

  console.log(`\n✅ Toplam ${count} paket eklendi.`);

  // Tüm acentaların eski hizmet atamalarını temizle ve yeni 3 paketi ata
  const activeServices = await prisma.service.findMany({ where: { isActive: true } });
  const allAgencies = await prisma.agency.findMany({ select: { id: true, name: true, currency: true } });

  if (allAgencies.length > 0) {
    // Eski atamaları temizle
    await prisma.agencyService.deleteMany({});
    console.log(`\n🗑️  Tüm eski hizmet atamaları temizlendi`);

    // Yeni paketleri tüm acentalara ata
    for (const agency of allAgencies) {
      const defaultPassPrices: Record<string, number> = {
        "Klasik Paket": 30,
        "Gold Paket": 45,
        "Aloe Vera Paket": 40,
      };

      await prisma.agencyService.createMany({
        data: activeServices.map(s => ({
          agencyId: agency.id,
          serviceId: s.id,
          passPrice: defaultPassPrices[s.name] ?? null,
        })),
        skipDuplicates: true,
      });
      console.log(`  ✅ ${agency.name} — ${activeServices.length} paket atandı (${agency.currency})`);
    }
    console.log(`\n✅ ${allAgencies.length} acentaya yeni paketler atandı.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
