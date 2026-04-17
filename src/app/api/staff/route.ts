import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const staffSchema = z.object({
  userId: z.string(),
  specializations: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  position: z.string().optional().nullable(),
  commissionRate: z.number().optional().nullable(),
})

export async function GET() {
  const staff = await prisma.staff.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, username: true },
      },
      workingHours: true,
    },
    orderBy: { user: { name: "asc" } },
  })

  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  const allowed = session.user.role === "ADMIN" ||
    await checkPermission(session.user.role, session.user.id, "personel_view")
  if (!allowed) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = staffSchema.parse(body)

    // Update user role to STAFF
    await prisma.user.update({
      where: { id: validatedData.userId },
      data: { role: "STAFF" },
    })

    const staff = await prisma.staff.create({
      data: {
        userId: validatedData.userId,
        specializations: validatedData.specializations || [],
        isActive: validatedData.isActive ?? true,
        position: validatedData.position || null,
        commissionRate: validatedData.commissionRate ?? null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    })

    // Personel için otomatik cari aç (sıfır bakiye sentinel entry)
    const userName = staff.user.name || "Personel"
    await prisma.accountingEntry.create({
      data: {
        date: new Date(),
        accountCode: `CARI_PERSONEL_${staff.id}`,
        debit: 0,
        credit: 0,
        amount: 0,
        currency: "TRY",
        description: `${userName} carisi açıldı`,
        staffId: staff.id,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json(staff)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Staff create error:", error)
    const message = error instanceof Error ? error.message : "Personel oluşturulamadı"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
