import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hotels = await prisma.hotel.findMany({
    take: 10,
    include: { region: true }
  });

  console.log('=== VERİTABANINDAKİ OTELLER (ilk 10) ===\n');
  hotels.forEach((h, i) => {
    console.log(`${i + 1}. ${h.name}`);
    console.log(`   Bölge: ${h.region.name}`);
    console.log(`   Adres: ${h.address || 'YOK'}`);
    console.log(`   Uzaklık: ${h.distanceToMarina || 'YOK'} km`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
