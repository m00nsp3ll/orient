import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Sistemdeki TÜM verileri sıfırla
 * - Tüm transferler
 * - Tüm AppointmentService kayıtları
 * - Tüm AgencyTransaction kayıtları
 * - Tüm randevular (onaylı, onaysız, iptal — hepsi)
 * - Tüm kasa girişleri
 */
export async function POST() {
  try {
    // Sıra önemli: önce bağımlı tablolar, sonra ana tablolar

    // 1. Tüm transferleri sil
    const deletedTransfers = await prisma.transfer.deleteMany({})

    // 2. Tüm AppointmentService kayıtlarını sil
    const deletedServices = await prisma.appointmentService.deleteMany({})

    // 3. Tüm AgencyTransaction kayıtlarını sil
    const deletedTransactions = await prisma.agencyTransaction.deleteMany({})

    // 4. Tüm randevuları sil
    const deletedAppointments = await prisma.appointment.deleteMany({})

    // 5. Tüm muhasebe kayıtlarını sil (manuel + virman + cascade olmayanlar dahil)
    const deletedAccounting = await prisma.accountingEntry.deleteMany({})

    // 6. Tüm kasa girişlerini sil
    const deletedCash = await prisma.cashEntry.deleteMany({})

    return NextResponse.json({
      success: true,
      message: `${deletedAppointments.count} randevu, ${deletedCash.count} kasa girişi, ${deletedAccounting.count} muhasebe kaydı, ${deletedTransfers.count} transfer silindi`,
      details: {
        deletedAppointments: deletedAppointments.count,
        deletedTransfers: deletedTransfers.count,
        deletedAppointmentServices: deletedServices.count,
        deletedAgencyTransactions: deletedTransactions.count,
        deletedCashEntries: deletedCash.count,
        deletedAccountingEntries: deletedAccounting.count,
      },
    })
  } catch (error) {
    console.error("Sıfırlama hatası:", error)
    return NextResponse.json(
      { error: "Sıfırlama başarısız", details: String(error) },
      { status: 500 }
    )
  }
}
