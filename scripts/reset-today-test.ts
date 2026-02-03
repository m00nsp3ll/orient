import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Delete today's transfers and appointments
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Delete transfers for today
  const todayAppointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: today, lt: tomorrow }
    },
    select: { id: true }
  })

  await prisma.transfer.deleteMany({
    where: {
      appointmentId: { in: todayAppointments.map(a => a.id) }
    }
  })

  await prisma.appointment.deleteMany({
    where: {
      startTime: { gte: today, lt: tomorrow }
    }
  })

  console.log('Deleted today appointments:', todayAppointments.length)

  // Get hotels, services, and drivers
  const hotels = await prisma.hotel.findMany({ include: { region: true }, take: 20 })
  const services = await prisma.service.findMany()
  const drivers = await prisma.driver.findMany()

  if (hotels.length === 0 || services.length === 0) {
    console.log('No hotels or services found')
    return
  }

  // Create new test data for today
  const testData = [
    // PENDING - Bekliyor (bölge gruplaması test)
    { hour: 9, minute: 0, name: 'Müller', pax: 2, hotelIdx: 0, serviceIdx: 0, isRest: false, status: 'PENDING', driverIdx: -1 },
    { hour: 9, minute: 30, name: 'Schmidt', pax: 3, hotelIdx: 1, serviceIdx: 1, isRest: true, status: 'PENDING', driverIdx: -1 },
    { hour: 10, minute: 0, name: 'Weber', pax: 1, hotelIdx: 0, serviceIdx: 2, isRest: false, status: 'PENDING', driverIdx: -1 },
    { hour: 10, minute: 30, name: 'Fischer', pax: 2, hotelIdx: 5, serviceIdx: 0, isRest: false, status: 'PENDING', driverIdx: -1 },
    { hour: 11, minute: 0, name: 'Meyer', pax: 4, hotelIdx: 6, serviceIdx: 1, isRest: true, status: 'PENDING', driverIdx: -1 },

    // PICKING_UP - Alınıyor (şoför gruplaması test - aynı şoföre birden fazla)
    { hour: 11, minute: 30, name: 'Johnson', pax: 2, hotelIdx: 2, serviceIdx: 0, isRest: false, status: 'PICKING_UP', driverIdx: 0 },
    { hour: 12, minute: 0, name: 'Williams', pax: 1, hotelIdx: 3, serviceIdx: 1, isRest: false, status: 'PICKING_UP', driverIdx: 0 },
    { hour: 12, minute: 30, name: 'Brown', pax: 3, hotelIdx: 4, serviceIdx: 2, isRest: true, status: 'PICKING_UP', driverIdx: 0 },
    { hour: 13, minute: 0, name: 'Davis', pax: 2, hotelIdx: 7, serviceIdx: 0, isRest: false, status: 'PICKING_UP', driverIdx: 1 },

    // AT_SPA - Müşteri Bekliyor
    { hour: 13, minute: 30, name: 'Garcia', pax: 2, hotelIdx: 8, serviceIdx: 1, isRest: true, status: 'AT_SPA', driverIdx: -1 },
    { hour: 14, minute: 0, name: 'Rodriguez', pax: 1, hotelIdx: 9, serviceIdx: 0, isRest: false, status: 'AT_SPA', driverIdx: -1 },

    // IN_SERVICE - Hizmette
    { hour: 14, minute: 30, name: 'Martinez', pax: 3, hotelIdx: 10, serviceIdx: 2, isRest: true, status: 'IN_SERVICE', driverIdx: -1 },
    { hour: 15, minute: 0, name: 'Anderson', pax: 2, hotelIdx: 11, serviceIdx: 1, isRest: false, status: 'IN_SERVICE', driverIdx: -1 },

    // DROPPING_OFF - Transfer Bekliyor (bölge gruplaması test)
    { hour: 15, minute: 30, name: 'Taylor', pax: 1, hotelIdx: 12, serviceIdx: 0, isRest: true, status: 'DROPPING_OFF', driverIdx: -1 },
    { hour: 16, minute: 0, name: 'Thomas', pax: 2, hotelIdx: 13, serviceIdx: 1, isRest: false, status: 'DROPPING_OFF', driverIdx: -1 },
    { hour: 16, minute: 30, name: 'Moore', pax: 4, hotelIdx: 12, serviceIdx: 2, isRest: false, status: 'DROPPING_OFF', driverIdx: -1 },

    // COMPLETED - Tamamlandı
    { hour: 17, minute: 0, name: 'Jackson', pax: 2, hotelIdx: 14, serviceIdx: 0, isRest: false, status: 'COMPLETED', driverIdx: -1 },
  ]

  let created = 0
  for (const data of testData) {
    const hotel = hotels[data.hotelIdx % hotels.length]
    const service = services[data.serviceIdx % services.length]

    const startTime = new Date()
    startTime.setHours(data.hour, data.minute, 0, 0)
    const endTime = new Date(startTime.getTime() + service.duration * 60000)

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        customerName: data.name,
        pax: data.pax,
        hotelId: hotel.id,
        serviceId: service.id,
        startTime,
        endTime,
        status: 'CONFIRMED',
        notes: data.isRest ? 'REST' : null,
      },
    })

    // Create transfer
    const driverId = data.driverIdx >= 0 ? drivers[data.driverIdx % drivers.length]?.id : null
    await prisma.transfer.create({
      data: {
        appointmentId: appointment.id,
        driverId,
        status: data.status as "PENDING" | "PICKING_UP" | "AT_SPA" | "IN_SERVICE" | "DROPPING_OFF" | "COMPLETED",
        arrivalTime: data.status === 'IN_SERVICE' ? new Date() : null,
      },
    })

    created++
    const driverInfo = data.driverIdx >= 0 ? `[Şoför: ${drivers[data.driverIdx % drivers.length]?.userId.substring(0,8)}]` : ''
    console.log(`Created: ${data.name} - ${data.hour}:${data.minute.toString().padStart(2, '0')} - ${data.status} ${data.isRest ? '(REST)' : ''} ${driverInfo}`)
  }

  console.log('\nTotal created:', created, 'appointments')
  console.log('\nDrivers in system:', drivers.length)
  drivers.forEach(d => console.log(' -', d.userId.substring(0,8), '...'))
}

main().catch(console.error).finally(() => prisma.$disconnect())
