import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const backupPath = path.join(process.cwd(), 'scripts', 'hotels-backup-2026-02-28T11-05-31.json')
  const raw = fs.readFileSync(backupPath, 'utf-8')
  const backup = JSON.parse(raw)

  console.log(`\n📦 Yedek dosyası: ${backup.exportedAt}`)
  console.log(`   Toplam otel : ${backup.totalHotels}`)
  console.log(`   Toplam bölge: ${backup.totalRegions}`)

  // 1. Bölge ID eşleştirme tablosu oluştur (yedekteki ID -> mevcut ID)
  console.log('\n🔧 Bölgeler kontrol ediliyor...')
  const regionIdMap = new Map<string, string>() // backupId -> currentId

  for (const region of backup.regions) {
    // Önce ID ile dene
    let existing = await prisma.region.findUnique({ where: { id: region.id } })
    if (existing) {
      regionIdMap.set(region.id, existing.id)
      console.log(`   ⏭️  Bölge mevcut (ID eşleşti): ${region.name}`)
      continue
    }
    // ID yoksa isimle ara
    existing = await prisma.region.findFirst({ where: { name: region.name } })
    if (existing) {
      regionIdMap.set(region.id, existing.id)
      console.log(`   🔗 Bölge mevcut (isimle eşleşti): ${region.name} (${region.id} -> ${existing.id})`)
      continue
    }
    // Hiç yoksa oluştur
    const created = await prisma.region.create({
      data: {
        name: region.name,
        isActive: region.isActive,
      },
    })
    regionIdMap.set(region.id, created.id)
    console.log(`   ✅ Bölge oluşturuldu: ${region.name}`)
  }

  // 2. Otelleri yükle (upsert ile - varsa güncelle, yoksa oluştur)
  console.log('\n🏨 Oteller yükleniyor...')
  let created = 0
  let updated = 0
  let errors = 0

  for (const hotel of backup.hotels) {
    try {
      // Bölge ID'sini eşleştir
      const currentRegionId = regionIdMap.get(hotel.regionId)
      if (!currentRegionId) {
        errors++
        console.error(`   ❌ Bölge bulunamadı: ${hotel.regionName} (${hotel.regionId}) - ${hotel.name}`)
        continue
      }

      const existing = await prisma.hotel.findUnique({ where: { id: hotel.id } })
      if (existing) {
        await prisma.hotel.update({
          where: { id: hotel.id },
          data: {
            name: hotel.name,
            address: hotel.address,
            distanceToMarina: hotel.distanceToMarina,
            googleMapsUrl: hotel.googleMapsUrl,
            lat: hotel.lat,
            lng: hotel.lng,
            isActive: hotel.isActive,
            regionId: currentRegionId,
          },
        })
        updated++
      } else {
        await prisma.hotel.create({
          data: {
            id: hotel.id,
            name: hotel.name,
            address: hotel.address,
            distanceToMarina: hotel.distanceToMarina,
            googleMapsUrl: hotel.googleMapsUrl,
            lat: hotel.lat,
            lng: hotel.lng,
            isActive: hotel.isActive,
            regionId: currentRegionId,
          },
        })
        created++
      }
    } catch (err) {
      errors++
      console.error(`   ❌ Hata: ${hotel.name} - ${(err as Error).message}`)
    }
  }

  console.log(`\n✅ Tamamlandı!`)
  console.log(`   Yeni oluşturulan: ${created}`)
  console.log(`   Güncellenen     : ${updated}`)
  if (errors > 0) console.log(`   Hata            : ${errors}`)

  // Doğrulama
  const totalHotels = await prisma.hotel.count()
  console.log(`\n   Veritabanındaki toplam otel: ${totalHotels}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
