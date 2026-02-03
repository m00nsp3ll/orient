import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash("driver123", 10)

  // Test şoförü oluştur
  const user = await prisma.user.upsert({
    where: { email: "sofor@orientspa.com" },
    update: {},
    create: {
      email: "sofor@orientspa.com",
      password: hashedPassword,
      name: "Ahmet Şoför",
      phone: "0532 111 2222",
      role: "DRIVER",
      driver: {
        create: {
          phone: "0532 111 2222",
          isActive: true,
        },
      },
    },
    include: {
      driver: true,
    },
  })

  console.log("✅ Test şoförü oluşturuldu:")
  console.log(`   Email: sofor@orientspa.com`)
  console.log(`   Şifre: driver123`)
  console.log(`   Driver ID: ${user.driver?.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
