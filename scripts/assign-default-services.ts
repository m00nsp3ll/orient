import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📝 Tüm acentalara default hizmetler atanıyor...\n')

  const agencies = await prisma.agency.findMany()
  const services = await prisma.service.findMany()

  if (services.length === 0) {
    console.log('❌ Hizmet bulunamadı!')
    return
  }

  for (const agency of agencies) {
    // Mevcut hizmet atamaları var mı kontrol et
    const existingServices = await prisma.agencyService.count({
      where: { agencyId: agency.id },
    })

    if (existingServices === 0) {
      // Tüm hizmetleri ata
      await prisma.agencyService.createMany({
        data: services.map(service => ({
          agencyId: agency.id,
          serviceId: service.id,
        })),
        skipDuplicates: true,
      })
      console.log(`✅ ${agency.companyName || agency.name} - ${services.length} hizmet atandı`)
    } else {
      console.log(`⏭️  ${agency.companyName || agency.name} - Zaten hizmetleri var (${existingServices})`)
    }
  }

  console.log(`\n🎉 İşlem tamamlandı!`)
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
