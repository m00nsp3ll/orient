import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: "Masaj", order: 1 },
  { name: "Cilt Bakımı", order: 2 },
  { name: "Hamam & Sauna", order: 3 },
  { name: "Vücut Bakımı", order: 4 },
];

const services = [
  // Masaj
  { name: "Klasik Masaj", description: "Gevşetici tam vücut masajı", duration: 60, price: 800, categoryName: "Masaj" },
  { name: "Aromaterapi Masaj", description: "Aromatik yağlarla rahatlatıcı masaj", duration: 60, price: 900, categoryName: "Masaj" },
  { name: "Thai Masaj", description: "Geleneksel Tayland masajı", duration: 90, price: 1200, categoryName: "Masaj" },
  { name: "Hot Stone Masaj", description: "Sıcak taşlarla derin doku masajı", duration: 75, price: 1100, categoryName: "Masaj" },
  { name: "Bali Masaj", description: "Bali tarzı rahatlatıcı masaj", duration: 60, price: 950, categoryName: "Masaj" },
  { name: "Anti-Stres Masaj", description: "Stres giderici özel masaj", duration: 45, price: 700, categoryName: "Masaj" },
  { name: "Spor Masajı", description: "Kas gevşetici spor masajı", duration: 60, price: 850, categoryName: "Masaj" },
  { name: "Çift Masajı", description: "Çiftler için eş zamanlı masaj", duration: 60, price: 1600, categoryName: "Masaj" },

  // Cilt Bakımı
  { name: "Klasik Cilt Bakımı", description: "Temel yüz bakımı", duration: 45, price: 500, categoryName: "Cilt Bakımı" },
  { name: "Anti-Aging Bakım", description: "Yaşlanma karşıtı yüz bakımı", duration: 60, price: 800, categoryName: "Cilt Bakımı" },
  { name: "Hydrafacial", description: "Derin nemlendirme bakımı", duration: 60, price: 1000, categoryName: "Cilt Bakımı" },
  { name: "Gold Cilt Bakımı", description: "24K altın maskeli lüks bakım", duration: 75, price: 1500, categoryName: "Cilt Bakımı" },

  // Hamam & Sauna
  { name: "Türk Hamamı", description: "Geleneksel köpük masajlı hamam", duration: 45, price: 600, categoryName: "Hamam & Sauna" },
  { name: "VIP Hamam Paketi", description: "Hamam + Kese + Masaj", duration: 90, price: 1200, categoryName: "Hamam & Sauna" },
  { name: "Kese & Köpük", description: "Kese ve köpük masajı", duration: 30, price: 400, categoryName: "Hamam & Sauna" },

  // Vücut Bakımı
  { name: "Detox Programı", description: "Vücut detoks ve arındırma", duration: 90, price: 1300, categoryName: "Vücut Bakımı" },
  { name: "Çikolata Terapi", description: "Çikolata maskeli vücut bakımı", duration: 60, price: 900, categoryName: "Vücut Bakımı" },
  { name: "Peeling & Nemlendirme", description: "Vücut peelingi ve nemlendirme", duration: 45, price: 650, categoryName: "Vücut Bakımı" },
  { name: "Sultan Paketi", description: "Hamam + Masaj + Cilt Bakımı", duration: 150, price: 2500, categoryName: "Vücut Bakımı" },
];

async function main() {
  console.log('🧖 Hizmetler ekleniyor...\n');

  // Kategorileri oluştur
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
        data: { ...data, categoryId },
      });
    } else {
      await prisma.service.create({
        data: { ...data, categoryId },
      });
    }
    count++;
    console.log(`  ✅ ${data.name} (${categoryName})`);
  }

  console.log(`\n✅ Toplam ${count} hizmet eklendi.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
