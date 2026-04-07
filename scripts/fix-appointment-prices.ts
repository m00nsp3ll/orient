/**
 * fix-appointment-prices.ts
 *
 * Tüm acentaların mevcut AgencyService.passPrice değerlerini baz alarak
 * geçmiş AppointmentService.price kayıtlarını günceller.
 *
 * Kullanım:
 *   npx tsx scripts/fix-appointment-prices.ts
 *
 * Önce dry run gösterir, onay verince gerçek güncelleme yapar.
 */

import { PrismaClient } from "@prisma/client"
import * as readline from "readline"

const prisma = new PrismaClient()

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

async function run(dryRun: boolean) {
  const agencyServices = await prisma.agencyService.findMany({
    where: { passPrice: { not: null, gt: 0 } },
    include: {
      agency: { select: { id: true, name: true, companyName: true, currency: true } },
      service: { select: { id: true, name: true } },
    },
  })

  if (agencyServices.length === 0) {
    console.log("⚠️  passPrice tanımlı acenta-hizmet kaydı bulunamadı.")
    return 0
  }

  let totalChecked = 0
  let totalUpdated = 0

  for (const as of agencyServices) {
    const correctPrice = as.passPrice!
    const agencyName = as.agency.companyName || as.agency.name

    const appointmentServices = await prisma.appointmentService.findMany({
      where: {
        serviceId: as.serviceId,
        appointment: {
          agencyId: as.agencyId,
          status: { not: "CANCELLED" },
        },
      },
      include: {
        appointment: {
          select: { startTime: true, pax: true, customerName: true, voucherNo: true },
        },
      },
    })

    totalChecked += appointmentServices.length
    const toUpdate = appointmentServices.filter(a => a.price !== correctPrice)
    if (toUpdate.length === 0) continue

    console.log(`\n📌 ${agencyName} — ${as.service.name}`)
    console.log(`   Güncel passPrice: ${correctPrice} ${as.agency.currency}`)

    for (const apSvc of toUpdate) {
      const apt = apSvc.appointment
      const dateStr = apt.startTime.toLocaleDateString("tr-TR")
      console.log(
        `   ${dryRun ? "[DRY]" : "[GÜN]"} ${dateStr} | ${apt.customerName ?? "-"} | ` +
        `Voucher: ${apt.voucherNo ?? "-"} | PAX: ${apt.pax ?? 1} | ` +
        `${apSvc.price} → ${correctPrice} ${as.agency.currency}`
      )

      if (!dryRun) {
        await prisma.appointmentService.update({
          where: { id: apSvc.id },
          data: { price: correctPrice },
        })
      }
      totalUpdated++
    }
  }

  return totalUpdated
}

async function main() {
  console.log("═══════════════════════════════════════════════════")
  console.log(" Orient SPA — Geçmiş Randevu Fiyat Güncelleme")
  console.log("═══════════════════════════════════════════════════")
  console.log("Kapsam: Tüm acentalar, tüm tarihler, iptal edilmemiş randevular\n")

  // Dry run
  const count = await run(true)

  console.log("\n═══════════════════════════════════════════════════")
  console.log(` Toplam ${count} kayıt güncellenecek.`)
  console.log("═══════════════════════════════════════════════════")

  if (count === 0) {
    console.log("✅ Zaten tüm fiyatlar güncel, işlem gerekmiyor.")
    return
  }

  const answer = await ask("\nGüncellemek istiyor musunuz? (evet/hayır): ")

  if (answer.toLowerCase() === "evet") {
    console.log("\n⏳ Güncelleniyor...")
    await run(false)
    console.log("✅ Güncelleme tamamlandı.")
  } else {
    console.log("❌ İptal edildi, hiçbir şey değiştirilmedi.")
  }

  console.log("═══════════════════════════════════════════════════")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
