import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const service = await prisma.service.findUnique({
    where: { id },
    include: { category: true },
  })

  if (!service) {
    return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 404 })
  }

  return NextResponse.json(service)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = updateServiceSchema.parse(body)

    const service = await prisma.service.update({
      where: { id },
      data: validatedData,
      include: { category: true },
    })

    return NextResponse.json(service)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Hizmet güncellenemedi" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    // İlişkili kayıtları temizle
    await prisma.agencyService.deleteMany({ where: { serviceId: id } })
    await prisma.appointmentService.deleteMany({ where: { serviceId: id } })
    await prisma.staffService.deleteMany({ where: { serviceId: id } })

    // Randevularda bu hizmete referans varsa silme, deaktif et
    const appointmentCount = await prisma.appointment.count({ where: { serviceId: id } })
    if (appointmentCount > 0) {
      await prisma.service.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ success: true, deactivated: true })
    }

    await prisma.service.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Service delete error:", error)
    return NextResponse.json({ error: "Hizmet silinemedi" }, { status: 500 })
  }
}
