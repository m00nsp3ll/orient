import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const hotels = await prisma.hotel.findMany({
    include: { region: true },
    orderBy: [
      { region: { name: 'asc' } },
      { name: 'asc' },
    ],
  })

  const regions = await prisma.region.findMany({
    orderBy: { name: 'asc' },
  })

  const backup = {
    exportedAt: new Date().toISOString(),
    totalHotels: hotels.length,
    totalRegions: regions.length,
    regions: regions.map(r => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
    })),
    hotels: hotels.map(h => ({
      id: h.id,
      name: h.name,
      address: h.address ?? null,
      distanceToMarina: h.distanceToMarina ?? null,
      googleMapsUrl: h.googleMapsUrl ?? null,
      lat: h.lat ?? null,
      lng: h.lng ?? null,
      isActive: h.isActive,
      regionId: h.regionId,
      regionName: h.region.name,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    })),
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `hotels-backup-${timestamp}.json`
  const outputPath = path.join(process.cwd(), 'scripts', filename)

  fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf-8')

  console.log(`\n✅ Yedek alındı: scripts/${filename}`)
  console.log(`   Toplam otel : ${hotels.length}`)
  console.log(`   Toplam bölge: ${regions.length}`)

  // Bölge bazlı özet
  const byRegion: Record<string, number> = {}
  hotels.forEach(h => {
    byRegion[h.region.name] = (byRegion[h.region.name] || 0) + 1
  })
  console.log('\n   Bölge dağılımı:')
  Object.entries(byRegion)
    .sort((a, b) => b[1] - a[1])
    .forEach(([region, count]) => {
      console.log(`     ${region.padEnd(20)} ${count} otel`)
    })

  // Koordinat durumu
  const withCoords = hotels.filter(h => h.lat && h.lng).length
  const withAddress = hotels.filter(h => h.address).length
  const withMapsUrl = hotels.filter(h => h.googleMapsUrl).length
  console.log(`\n   Koordinat olan   : ${withCoords}/${hotels.length}`)
  console.log(`   Adres olan       : ${withAddress}/${hotels.length}`)
  console.log(`   Maps URL olan    : ${withMapsUrl}/${hotels.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
