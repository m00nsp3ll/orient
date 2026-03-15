import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Date alanlarını parse eden helper
function parseDates<T>(records: any[], dateFields: string[]): T[] {
  return records.map((record) => {
    const parsed = { ...record }
    for (const field of dateFields) {
      if (parsed[field] != null) {
        parsed[field] = new Date(parsed[field])
      }
    }
    return parsed as T
  })
}

async function importSeed() {
  const inputPath = path.join(__dirname, 'seed-data.json')

  if (!fs.existsSync(inputPath)) {
    console.error('❌ seed-data.json bulunamadı! Önce export-seed.ts çalıştırın.')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

  console.log('🗑️  Mevcut veriler siliniyor (FK sırasına uygun)...')

  // Silme sırası: bağımlı tablolardan bağımsızlara
  await prisma.cashEntry.deleteMany()
  await prisma.blockedTime.deleteMany()
  await prisma.transfer.deleteMany()
  await prisma.agencyTransaction.deleteMany()
  await prisma.appointmentService.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.systemSetting.deleteMany()
  await prisma.regionSessionTime.deleteMany()
  await prisma.workingHours.deleteMany()
  await prisma.timeSlotQuota.deleteMany()
  await prisma.staffService.deleteMany()
  await prisma.agencyService.deleteMany()
  await prisma.service.deleteMany()
  await prisma.hotel.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.agency.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.serviceCategory.deleteMany()
  await prisma.region.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Mevcut veriler silindi.\n')
  console.log('🔄 Veriler yükleniyor...')

  // 1. User
  if (data.users?.length) {
    const records = parseDates(data.users, ['emailVerified', 'createdAt', 'updatedAt'])
    await prisma.user.createMany({ data: records, skipDuplicates: true })
    console.log(`  users: ${data.users.length} kayıt`)
  }

  // 2. Account
  if (data.accounts?.length) {
    await prisma.account.createMany({ data: data.accounts, skipDuplicates: true })
    console.log(`  accounts: ${data.accounts.length} kayıt`)
  }

  // 3. Session
  if (data.sessions?.length) {
    const records = parseDates(data.sessions, ['expires'])
    await prisma.session.createMany({ data: records, skipDuplicates: true })
    console.log(`  sessions: ${data.sessions.length} kayıt`)
  }

  // 4. VerificationToken
  if (data.verificationTokens?.length) {
    const records = parseDates(data.verificationTokens, ['expires'])
    await prisma.verificationToken.createMany({ data: records, skipDuplicates: true })
    console.log(`  verificationTokens: ${data.verificationTokens.length} kayıt`)
  }

  // 5. Region
  if (data.regions?.length) {
    // İlk geçiş: pickupTimeRegionId olmadan ekle (self-reference sorununu önle)
    const regionsWithoutRef = data.regions.map((r: any) => ({
      ...r,
      pickupTimeRegionId: null,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }))
    await prisma.region.createMany({ data: regionsWithoutRef, skipDuplicates: true })

    // İkinci geçiş: pickupTimeRegionId'leri güncelle
    for (const region of data.regions) {
      if (region.pickupTimeRegionId) {
        await prisma.region.update({
          where: { id: region.id },
          data: { pickupTimeRegionId: region.pickupTimeRegionId },
        })
      }
    }
    console.log(`  regions: ${data.regions.length} kayıt`)
  }

  // 6. ServiceCategory
  if (data.serviceCategories?.length) {
    const records = parseDates(data.serviceCategories, ['createdAt', 'updatedAt'])
    await prisma.serviceCategory.createMany({ data: records, skipDuplicates: true })
    console.log(`  serviceCategories: ${data.serviceCategories.length} kayıt`)
  }

  // 7. Agency
  if (data.agencies?.length) {
    const records = parseDates(data.agencies, ['createdAt', 'updatedAt'])
    await prisma.agency.createMany({ data: records, skipDuplicates: true })
    console.log(`  agencies: ${data.agencies.length} kayıt`)
  }

  // 8. Staff
  if (data.staff?.length) {
    const records = parseDates(data.staff, ['createdAt', 'updatedAt'])
    await prisma.staff.createMany({ data: records, skipDuplicates: true })
    console.log(`  staff: ${data.staff.length} kayıt`)
  }

  // 9. Driver
  if (data.drivers?.length) {
    const records = parseDates(data.drivers, ['createdAt', 'updatedAt'])
    await prisma.driver.createMany({ data: records, skipDuplicates: true })
    console.log(`  drivers: ${data.drivers.length} kayıt`)
  }

  // 10. Hotel
  if (data.hotels?.length) {
    const records = parseDates(data.hotels, ['createdAt', 'updatedAt'])
    await prisma.hotel.createMany({ data: records, skipDuplicates: true })
    console.log(`  hotels: ${data.hotels.length} kayıt`)
  }

  // 11. Service
  if (data.services?.length) {
    const records = parseDates(data.services, ['createdAt', 'updatedAt'])
    await prisma.service.createMany({ data: records, skipDuplicates: true })
    console.log(`  services: ${data.services.length} kayıt`)
  }

  // 12. AgencyService
  if (data.agencyServices?.length) {
    const records = parseDates(data.agencyServices, ['createdAt', 'updatedAt'])
    await prisma.agencyService.createMany({ data: records, skipDuplicates: true })
    console.log(`  agencyServices: ${data.agencyServices.length} kayıt`)
  }

  // 13. StaffService
  if (data.staffServices?.length) {
    await prisma.staffService.createMany({ data: data.staffServices, skipDuplicates: true })
    console.log(`  staffServices: ${data.staffServices.length} kayıt`)
  }

  // 14. TimeSlotQuota
  if (data.timeSlotQuotas?.length) {
    const records = parseDates(data.timeSlotQuotas, ['createdAt', 'updatedAt'])
    await prisma.timeSlotQuota.createMany({ data: records, skipDuplicates: true })
    console.log(`  timeSlotQuotas: ${data.timeSlotQuotas.length} kayıt`)
  }

  // 15. WorkingHours
  if (data.workingHours?.length) {
    const records = parseDates(data.workingHours, ['createdAt', 'updatedAt'])
    await prisma.workingHours.createMany({ data: records, skipDuplicates: true })
    console.log(`  workingHours: ${data.workingHours.length} kayıt`)
  }

  // 16. RegionSessionTime
  if (data.regionSessionTimes?.length) {
    const records = parseDates(data.regionSessionTimes, ['createdAt', 'updatedAt'])
    await prisma.regionSessionTime.createMany({ data: records, skipDuplicates: true })
    console.log(`  regionSessionTimes: ${data.regionSessionTimes.length} kayıt`)
  }

  // 17. SystemSetting
  if (data.systemSettings?.length) {
    await prisma.systemSetting.createMany({ data: data.systemSettings, skipDuplicates: true })
    console.log(`  systemSettings: ${data.systemSettings.length} kayıt`)
  }

  // 18. Appointment
  if (data.appointments?.length) {
    const records = parseDates(data.appointments, ['startTime', 'endTime', 'createdAt', 'updatedAt'])
    await prisma.appointment.createMany({ data: records, skipDuplicates: true })
    console.log(`  appointments: ${data.appointments.length} kayıt`)
  }

  // 19. AppointmentService
  if (data.appointmentServices?.length) {
    const records = parseDates(data.appointmentServices, ['createdAt'])
    await prisma.appointmentService.createMany({ data: records, skipDuplicates: true })
    console.log(`  appointmentServices: ${data.appointmentServices.length} kayıt`)
  }

  // 20. Transfer
  if (data.transfers?.length) {
    const records = parseDates(data.transfers, ['pickupTime', 'arrivalTime', 'departureTime', 'dropoffTime', 'createdAt', 'updatedAt'])
    await prisma.transfer.createMany({ data: records, skipDuplicates: true })
    console.log(`  transfers: ${data.transfers.length} kayıt`)
  }

  // 21. AgencyTransaction
  if (data.agencyTransactions?.length) {
    const records = parseDates(data.agencyTransactions, ['createdAt'])
    await prisma.agencyTransaction.createMany({ data: records, skipDuplicates: true })
    console.log(`  agencyTransactions: ${data.agencyTransactions.length} kayıt`)
  }

  // 22. BlockedTime
  if (data.blockedTimes?.length) {
    const records = parseDates(data.blockedTimes, ['startTime', 'endTime', 'createdAt', 'updatedAt'])
    await prisma.blockedTime.createMany({ data: records, skipDuplicates: true })
    console.log(`  blockedTimes: ${data.blockedTimes.length} kayıt`)
  }

  // 23. CashEntry
  if (data.cashEntries?.length) {
    const records = parseDates(data.cashEntries, ['date', 'createdAt', 'updatedAt'])
    await prisma.cashEntry.createMany({ data: records, skipDuplicates: true })
    console.log(`  cashEntries: ${data.cashEntries.length} kayıt`)
  }

  console.log('\n✅ Import tamamlandı!')
}

importSeed()
  .catch((e) => {
    console.error('❌ Import hatası:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
