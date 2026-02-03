import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🧹 Mevcut Agency kayıtları temizleniyor...")

  await prisma.agency.deleteMany({})

  console.log("✅ Agency tablosu temizlendi")
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
