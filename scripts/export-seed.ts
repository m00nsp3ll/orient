import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function exportSeed() {
  console.log('🔄 Veritabanından veriler okunuyor...')

  const data = {
    users: await prisma.user.findMany(),
    accounts: await prisma.account.findMany(),
    sessions: await prisma.session.findMany(),
    verificationTokens: await prisma.verificationToken.findMany(),
    regions: await prisma.region.findMany(),
    serviceCategories: await prisma.serviceCategory.findMany(),
    agencies: await prisma.agency.findMany(),
    staff: await prisma.staff.findMany(),
    drivers: await prisma.driver.findMany(),
    hotels: await prisma.hotel.findMany(),
    services: await prisma.service.findMany(),
    agencyServices: await prisma.agencyService.findMany(),
    staffServices: await prisma.staffService.findMany(),
    timeSlotQuotas: await prisma.timeSlotQuota.findMany(),
    workingHours: await prisma.workingHours.findMany(),
    regionSessionTimes: await prisma.regionSessionTime.findMany(),
    systemSettings: await prisma.systemSetting.findMany(),
    appointments: await prisma.appointment.findMany(),
    appointmentServices: await prisma.appointmentService.findMany(),
    transfers: await prisma.transfer.findMany(),
    agencyTransactions: await prisma.agencyTransaction.findMany(),
    blockedTimes: await prisma.blockedTime.findMany(),
    cashEntries: await prisma.cashEntry.findMany(),
  }

  const outputPath = path.join(__dirname, 'seed-data.json')
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')

  // Summary
  for (const [key, value] of Object.entries(data)) {
    console.log(`  ${key}: ${(value as any[]).length} kayıt`)
  }

  console.log(`\n✅ Export tamamlandı: ${outputPath}`)
}

exportSeed()
  .catch((e) => {
    console.error('❌ Export hatası:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
