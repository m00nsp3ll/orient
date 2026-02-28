import { PrismaClient, AppointmentStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestAppointments() {
  console.log('🗑️ Bugünün randevularını siliyorum...')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Bugünün randevularını sil
  await prisma.appointment.deleteMany({
    where: {
      startTime: {
        gte: today,
        lt: tomorrow,
      },
    },
  })

  console.log('✅ Eski veriler silindi\n')
  console.log('📝 Yeni test rezervasyonları oluşturuluyor...\n')

  const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } })
  if (!customer) throw new Error('Customer bulunamadı')

  // Farklı bölgelerden oteller
  const hotels = {
    mahmutlar: await prisma.hotel.findFirst({
      where: { name: { contains: 'Club Sun Heaven' } }
    }),
    mahmutlar2: await prisma.hotel.findFirst({
      where: { name: { contains: 'Club Sea Time' } }
    }),
    okurcalar: await prisma.hotel.findFirst({
      where: { region: { name: 'Okurcalar' } }
    }),
    konakli: await prisma.hotel.findFirst({
      where: { region: { name: 'Konaklı' } }
    }),
    merkez: await prisma.hotel.findFirst({
      where: { region: { name: 'Alanya Merkez' } }
    }),
    turkler: await prisma.hotel.findFirst({
      where: { region: { name: 'Türkler' } }
    }),
    avsallar: await prisma.hotel.findFirst({
      where: { region: { name: 'Avsallar' } }
    }),
    kestel: await prisma.hotel.findFirst({
      where: { region: { name: 'Kestel' } }
    }),
  }

  const services = await prisma.service.findMany({ take: 3 })

  const appointments = [
    {
      customerId: customer.id,
      hotelId: hotels.mahmutlar?.id,
      serviceId: services[0].id,
      startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 09:00
      endTime: new Date(today.getTime() + 10.5 * 60 * 60 * 1000), // 10:30
      pax: 2,
      customerName: 'Ahmet Yılmaz',
      notes: 'REST - Ödeme Kapıda',
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.okurcalar?.id,
      serviceId: services[1].id,
      startTime: new Date(today.getTime() + 9.5 * 60 * 60 * 1000), // 09:30
      endTime: new Date(today.getTime() + 11 * 60 * 60 * 1000), // 11:00
      pax: 3,
      customerName: 'Mehmet Demir',
      notes: null,
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.konakli?.id,
      serviceId: services[0].id,
      startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00
      endTime: new Date(today.getTime() + 11.5 * 60 * 60 * 1000), // 11:30
      pax: 4,
      customerName: 'Ayşe Kaya',
      notes: 'REST - Ödeme Kapıda',
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.merkez?.id,
      serviceId: services[2].id,
      startTime: new Date(today.getTime() + 10.5 * 60 * 60 * 1000), // 10:30
      endTime: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12:00
      pax: 2,
      customerName: 'Fatma Şahin',
      notes: null,
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.turkler?.id,
      serviceId: services[0].id,
      startTime: new Date(today.getTime() + 11 * 60 * 60 * 1000), // 11:00
      endTime: new Date(today.getTime() + 12.5 * 60 * 60 * 1000), // 12:30
      pax: 3,
      customerName: 'Ali Çelik',
      notes: null,
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.mahmutlar2?.id,
      serviceId: services[1].id,
      startTime: new Date(today.getTime() + 11.5 * 60 * 60 * 1000), // 11:30
      endTime: new Date(today.getTime() + 13 * 60 * 60 * 1000), // 13:00
      pax: 2,
      customerName: 'Zeynep Arslan',
      notes: 'REST - Ödeme Kapıda',
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.avsallar?.id,
      serviceId: services[0].id,
      startTime: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12:00
      endTime: new Date(today.getTime() + 13.5 * 60 * 60 * 1000), // 13:30
      pax: 4,
      customerName: 'Hasan Yıldız',
      notes: null,
      status: 'CONFIRMED' as AppointmentStatus,
    },
    {
      customerId: customer.id,
      hotelId: hotels.kestel?.id,
      serviceId: services[2].id,
      startTime: new Date(today.getTime() + 12.5 * 60 * 60 * 1000), // 12:30
      endTime: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 14:00
      pax: 2,
      customerName: 'Elif Öztürk',
      notes: 'REST - Ödeme Kapıda',
      status: 'CONFIRMED' as AppointmentStatus,
    },
  ]

  for (const apt of appointments) {
    if (!apt.hotelId) {
      console.log(`⚠️  Atlanan: ${apt.customerName} (otel bulunamadı)`)
      continue
    }

    const created = await prisma.appointment.create({ data: apt })
    console.log(`✅ ${apt.customerName} - ${created.startTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}${apt.notes ? ' (REST)' : ''}`)
  }

  console.log('\n🎉 Test rezervasyonları oluşturuldu!')

  const count = await prisma.appointment.count({
    where: {
      startTime: { gte: today, lt: tomorrow }
    }
  })

  console.log(`📊 Bugün toplam ${count} randevu var`)
}

createTestAppointments()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
