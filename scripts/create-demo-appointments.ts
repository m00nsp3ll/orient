import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📝 5 Adet Onay Bekleyen Demo Rezervasyon Ekleniyor...\n')

  // Veritabanından veri çek
  const services = await prisma.service.findMany()
  const hotels = await prisma.hotel.findMany({
    where: {
      address: { not: null }
    },
    take: 20
  })
  const agencies = await prisma.agency.findMany()

  if (services.length === 0 || hotels.length === 0) {
    console.log('❌ Hizmet veya otel bulunamadı!')
    return
  }

  const sunwayAgency = agencies.find(a => a.code === 'SWT001')

  if (!sunwayAgency) {
    console.log('❌ Sunway Travel acentası bulunamadı!')
    return
  }

  // Bugün ve gelecek günler için tarihler
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // 5 Adet Onay Bekleyen Rezervasyon (Sunway Travel)
  const demoAppointments = [
    {
      agencyId: sunwayAgency.id,
      hotelId: hotels[12]?.id || hotels[0].id,
      serviceId: services[0].id,
      customerName: 'Emre Kılıç',
      customerPhone: '0541 111 2233',
      pax: 2,
      startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 09:00
      approvalStatus: 'PENDING_APPROVAL' as const,
      status: 'CONFIRMED' as const,
    },
    {
      agencyId: sunwayAgency.id,
      hotelId: hotels[13]?.id || hotels[1].id,
      serviceId: services[1]?.id || services[0].id,
      customerName: 'Derya Aydın',
      customerPhone: '0542 222 3344',
      pax: 3,
      startTime: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12:00
      approvalStatus: 'PENDING_APPROVAL' as const,
      status: 'CONFIRMED' as const,
    },
    {
      agencyId: sunwayAgency.id,
      hotelId: hotels[14]?.id || hotels[2].id,
      serviceId: services[0].id,
      customerName: 'Gökhan Şen',
      customerPhone: '0543 333 4455',
      pax: 4,
      startTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000), // Yarın 11:00
      approvalStatus: 'PENDING_APPROVAL' as const,
      status: 'CONFIRMED' as const,
    },
    {
      agencyId: sunwayAgency.id,
      hotelId: hotels[15]?.id || hotels[3].id,
      serviceId: services[0].id,
      customerName: 'Hülya Koç',
      customerPhone: '0544 444 5566',
      pax: 2,
      notes: 'REST',
      startTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000), // Yarın 14:00
      approvalStatus: 'PENDING_APPROVAL' as const,
      status: 'CONFIRMED' as const,
    },
    {
      agencyId: sunwayAgency.id,
      hotelId: hotels[16]?.id || hotels[4].id,
      serviceId: services[1]?.id || services[0].id,
      customerName: 'İsmail Yurt',
      customerPhone: '0545 555 6677',
      pax: 5,
      startTime: new Date(tomorrow.getTime() + 16 * 60 * 60 * 1000), // Yarın 16:00
      approvalStatus: 'PENDING_APPROVAL' as const,
      status: 'CONFIRMED' as const,
    },
  ]

  let addedCount = 0

  for (const data of demoAppointments) {
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId }
    })

    if (!service) continue

    const endTime = new Date(data.startTime.getTime() + service.duration * 60 * 1000)

    const appointment = await prisma.appointment.create({
      data: {
        agencyId: data.agencyId,
        hotelId: data.hotelId,
        serviceId: data.serviceId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        pax: data.pax,
        notes: data.notes,
        startTime: data.startTime,
        endTime: endTime,
        approvalStatus: data.approvalStatus,
        status: data.status,
      },
      include: {
        agency: { select: { companyName: true, name: true } },
        hotel: { select: { name: true } },
        service: { select: { name: true } },
      }
    })

    addedCount++
    console.log(`🟠 [ONAY BEKLİYOR] ${appointment.customerName} - ${appointment.agency?.companyName || appointment.agency?.name} - ${appointment.hotel?.name}`)
  }

  console.log(`\n🎉 ${addedCount} adet onay bekleyen rezervasyon eklendi!`)
  console.log(`✅ Mevcut rezervasyonlar korundu.\n`)
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
