import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const agencies = [
  { name: 'Sunway Travel', code: 'SWT001', email: 'sunway@demo.com', password: 'sunway123' },
  { name: 'Blue Sky Tourism', code: 'BST002', email: 'bluesky@demo.com', password: 'bluesky123' },
  { name: 'Golden Tours', code: 'GLT003', email: 'golden@demo.com', password: 'golden123' },
  { name: 'Paradise Holidays', code: 'PRH004', email: 'paradise@demo.com', password: 'paradise123' },
]

async function main() {
  console.log('🔧 Demo acentalar için kullanıcı hesapları oluşturuluyor...\n')

  for (const agencyData of agencies) {
    const agency = await prisma.agency.findUnique({
      where: { code: agencyData.code }
    })

    if (!agency) {
      console.log(`⚠️  ${agencyData.name} bulunamadı, atlanıyor...`)
      continue
    }

    const hashedPassword = await hash(agencyData.password, 10)

    const user = await prisma.user.upsert({
      where: { email: agencyData.email },
      update: {
        password: hashedPassword,
        role: 'AGENCY',
        name: agencyData.name
      },
      create: {
        email: agencyData.email,
        password: hashedPassword,
        name: agencyData.name,
        role: 'AGENCY'
      }
    })

    await prisma.agency.update({
      where: { id: agency.id },
      data: {
        userId: user.id,
        email: agencyData.email,
        companyName: agencyData.name
      }
    })

    console.log(`✅ ${agencyData.name}`)
    console.log(`   📧 Email: ${agencyData.email}`)
    console.log(`   🔑 Şifre: ${agencyData.password}\n`)
  }

  console.log('🎉 Tüm acenta hesapları oluşturuldu!')
  console.log('\n📋 GİRİŞ BİLGİLERİ:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  agencies.forEach(a => {
    console.log(`${a.name}: ${a.email} / ${a.password}`)
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
