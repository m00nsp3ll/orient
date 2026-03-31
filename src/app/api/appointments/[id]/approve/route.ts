import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const params = await context.params
    const { action } = await req.json()

    if (!action || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        services: true,
        agency: { select: { id: true, currency: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 })
    }

    const appointment = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        approvalStatus: action === "approve" ? "APPROVED" : "REJECTED",
      },
      include: {
        agency: { select: { id: true, companyName: true, name: true } },
        service: true,
        hotel: { include: { region: { select: { name: true } } } },
      },
    })

    if (action === "approve") {
      // Transfer kaydı oluştur
      const existingTransfer = await prisma.transfer.findFirst({
        where: { appointmentId: params.id },
      })
      if (!existingTransfer) {
        await prisma.transfer.create({
          data: { appointmentId: params.id },
        })
      }

      // Acenta cari kaydı: onaylandığında DEBIT + REST CREDIT oluştur
      if (existing.agencyId && existing.services.length > 0) {
        const agencyCurrency = existing.agency?.currency || "EUR"
        const paxCount = existing.pax || 1
        const totalPrice = existing.services.reduce((sum, s) => sum + s.price, 0) * paxCount

        await prisma.agencyTransaction.create({
          data: {
            agencyId: existing.agencyId,
            appointmentId: params.id,
            type: "DEBIT",
            amount: totalPrice,
            currency: agencyCurrency,
            description: `Rezervasyon - ${existing.customerName || "Müşteri"} (${paxCount} PAX × ${existing.services.length} paket)`,
          },
        })

        // REST tutarı varsa CREDIT
        if (existing.restAmount && existing.restAmount > 0 && existing.restCurrency) {
          let creditAmount = existing.restAmount
          const restCurrency = existing.restCurrency

          if (restCurrency !== agencyCurrency) {
            try {
              const tcmbRes = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml")
              if (tcmbRes.ok) {
                const xml = await tcmbRes.text()
                const getSellingRate = (code: string): number | null => {
                  if (code === "TRY") return 1
                  const regex = new RegExp(`<Currency[^>]*Kod="${code}"[^>]*>[\\s\\S]*?<ForexSelling>([\\d.]+)</ForexSelling>`)
                  const match = xml.match(regex)
                  return match ? parseFloat(match[1]) : null
                }
                const fromRate = getSellingRate(restCurrency)
                const toRate = getSellingRate(agencyCurrency)
                if (fromRate && toRate) {
                  creditAmount = (existing.restAmount * fromRate) / toRate
                }
              }
            } catch {}
          }

          await prisma.agencyTransaction.create({
            data: {
              agencyId: existing.agencyId,
              appointmentId: params.id,
              type: "CREDIT",
              amount: parseFloat(creditAmount.toFixed(2)),
              currency: agencyCurrency,
              description: `REST - ${existing.customerName || "Müşteri"} (${restCurrency !== agencyCurrency ? `${existing.restAmount} ${restCurrency} → ${agencyCurrency}` : "kapıda ödeme"})`,
            },
          })
        }
      }
    }

    if (action === "reject") {
      // Reddedildiğinde bu randevuya ait tüm AgencyTransaction'ları sil
      await prisma.agencyTransaction.deleteMany({
        where: { appointmentId: params.id },
      })
    }

    return NextResponse.json(appointment)
  } catch (error) {
    console.error("Approval error:", error)
    return NextResponse.json(
      { error: "İşlem gerçekleştirilemedi" },
      { status: 500 }
    )
  }
}

