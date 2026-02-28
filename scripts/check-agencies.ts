import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏢 Checking all agency accounts...\n')

  const agencies = await prisma.agency.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    }
  })

  console.log(`Found ${agencies.length} agencies:\n`)

  agencies.forEach(agency => {
    console.log('---')
    console.log(`Agency Name: ${agency.companyName}`)
    console.log(`Contact Person: ${agency.contactName}`)
    console.log(`Email: ${agency.user?.email || agency.email || 'N/A'}`)
    console.log(`Phone: ${agency.phone}`)
    console.log(`User ID: ${agency.user?.id || 'N/A'}`)
    console.log(`User Name: ${agency.user?.name || 'N/A'}`)
    console.log(`Role: ${agency.user?.role || 'N/A'}`)
    console.log('')
  })

  // Also check users with AGENCY role
  console.log('\n👤 All users with AGENCY role:\n')
  const agencyUsers = await prisma.user.findMany({
    where: { role: 'AGENCY' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      agency: {
        select: {
          companyName: true,
          contactName: true,
          phone: true
        }
      }
    }
  })

  agencyUsers.forEach(user => {
    console.log('---')
    console.log(`Name: ${user.name}`)
    console.log(`Email: ${user.email}`)
    console.log(`Company: ${user.agency?.companyName || 'N/A'}`)
    console.log(`Contact: ${user.agency?.contactName || 'N/A'}`)
    console.log('')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
