import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Tüm demo verileri sıfırla
 * - [DEMO] tag'li randevular ve kasa girişleri
 * - hotelId NULL olan randevular
 * - PENDING_APPROVAL randevular
 * - İlişkili transfer, AppointmentService, AgencyTransaction kayıtları
 */
export async function POST() {
  try {
    // 1. [DEMO] tag'li randevuları bul
    const demoAppointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { notes: { contains: "[DEMO]" } },
          { hotelId: null },
        ],
      },
      select: { id: true },
    })

    let deletedAppointments = 0

    if (demoAppointments.length > 0) {
      const ids = demoAppointments.map(a => a.id)
      await prisma.transfer.deleteMany({ where: { appointmentId: { in: ids } } })
      await prisma.appointmentService.deleteMany({ where: { appointmentId: { in: ids } } })
      await prisma.agencyTransaction.deleteMany({ where: { appointmentId: { in: ids } } })
      await prisma.appointment.deleteMany({ where: { id: { in: ids } } })
      deletedAppointments = ids.length
    }

    // 2. [DEMO] tag'li kasa girişlerini sil
    const deletedCash = await prisma.cashEntry.deleteMany({
      where: { description: { contains: "[DEMO]" } },
    })

    // 3. Kalan tüm PENDING_APPROVAL randevuları temizle
    const pendingAppts = await prisma.appointment.findMany({
      where: { approvalStatus: "PENDING_APPROVAL" },
      select: { id: true },
    })

    let deletedPending = 0
    if (pendingAppts.length > 0) {
      const pendingIds = pendingAppts.map(a => a.id)
      await prisma.transfer.deleteMany({ where: { appointmentId: { in: pendingIds } } })
      await prisma.appointmentService.deleteMany({ where: { appointmentId: { in: pendingIds } } })
      await prisma.agencyTransaction.deleteMany({ where: { appointmentId: { in: pendingIds } } })
      await prisma.appointment.deleteMany({ where: { id: { in: pendingIds } } })
      deletedPending = pendingIds.length
    }

    const remaining = await prisma.appointment.count()

    return NextResponse.json({
      success: true,
      message: `${deletedAppointments + deletedPending} randevu ve ${deletedCash.count} kasa girişi silindi`,
      details: {
        deletedAppointments,
        deletedPending,
        deletedCashEntries: deletedCash.count,
        remainingAppointments: remaining,
      },
    })
  } catch (error) {
    console.error("Demo sıfırlama hatası:", error)
    return NextResponse.json(
      { error: "Demo sıfırlama başarısız", details: String(error) },
      { status: 500 }
    )
  }
}
