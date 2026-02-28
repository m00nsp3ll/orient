import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking all driver users...\n')

  // Find all users with DRIVER role
  const drivers = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'DRIVER' },
        { email: { contains: 'sofor' } },
        { email: { contains: 'driver' } },
        { name: { contains: 'Şoför' } },
        { name: { contains: 'Mehmet' } }
      ]
    },
    include: {
      driver: true
    }
  })

  console.log(`Found ${drivers.length} potential driver users:\n`)

  drivers.forEach(user => {
    console.log('---')
    console.log(`ID: ${user.id}`)
    console.log(`Name: ${user.name}`)
    console.log(`Email: ${user.email}`)
    console.log(`Role: ${user.role}`)
    console.log(`Has Driver Record: ${user.driver ? '✅ YES' : '❌ NO'}`)
    if (user.driver) {
      console.log(`Driver ID: ${user.driver.id}`)
      console.log(`Phone: ${user.driver.phone}`)
      console.log(`Active: ${user.driver.isActive ? 'Yes' : 'No'}`)
    }
    console.log('')
  })

  // Check transfers for drivers
  console.log('\n🚗 Checking transfers...\n')
  const allDrivers = await prisma.driver.findMany({
    include: {
      user: true,
      transfers: {
        take: 5,
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  allDrivers.forEach(driver => {
    console.log(`${driver.user.name} (${driver.user.email}): ${driver.transfers.length} transfers`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
