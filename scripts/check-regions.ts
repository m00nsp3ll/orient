import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Adreste farklı bölge isimleri geçen otelleri bul
  const hotels = await prisma.hotel.findMany({
    include: { region: true }
  });

  console.log('=== ADRES VE BÖLGE UYUMSUZLUKLARI ===\n');

  const issues: { hotel: string; address: string; currentRegion: string; shouldBe: string }[] = [];

  const regionKeywords: { [key: string]: string[] } = {
    "Okurcalar": ["okurcalar"],
    "Avsallar": ["avsallar"],
    "Türkler": ["türkler", "turkler"],
    "Konaklı": ["konaklı", "konakli"],
    "Oba": ["oba,", " oba ", "/oba"],
    "Cikcilli": ["cikcilli"],
    "Tosmur": ["tosmur"],
    "Kestel": ["kestel"],
    "Mahmutlar": ["mahmutlar"],
    "Kargıcak": ["kargıcak", "kargicak"],
  };

  for (const hotel of hotels) {
    if (!hotel.address) continue;

    const lowerAddress = hotel.address.toLowerCase();

    for (const [region, keywords] of Object.entries(regionKeywords)) {
      for (const keyword of keywords) {
        if (lowerAddress.includes(keyword) && hotel.region.name !== region) {
          issues.push({
            hotel: hotel.name,
            address: hotel.address,
            currentRegion: hotel.region.name,
            shouldBe: region
          });
          break;
        }
      }
    }
  }

  console.log(`Toplam ${issues.length} uyumsuzluk bulundu:\n`);

  // Bölge bazında grupla
  const byRegion: { [key: string]: typeof issues } = {};
  for (const issue of issues) {
    if (!byRegion[issue.shouldBe]) byRegion[issue.shouldBe] = [];
    byRegion[issue.shouldBe].push(issue);
  }

  for (const [region, regionIssues] of Object.entries(byRegion)) {
    console.log(`\n--- ${region} olması gerekenler (${regionIssues.length} adet) ---`);
    regionIssues.slice(0, 5).forEach(i => {
      console.log(`  ${i.hotel}`);
      console.log(`    Adres: ${i.address.substring(0, 60)}...`);
      console.log(`    Şu an: ${i.currentRegion}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
