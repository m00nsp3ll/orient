import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateStaffSchema = z.object({
  specializations: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const staff = await prisma.staff.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      workingHours: true,
      blockedTimes: true,
    },
  })

  if (!staff) {
    return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 })
  }

  return NextResponse.json(staff)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = updateStaffSchema.parse(body)

    const staff = await prisma.staff.update({
      where: { id },
      data: validatedData,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
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
    return NextResponse.json(
      { error: "Personel güncellenemedi" },
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
    const staff = await prisma.staff.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (staff) {
      await prisma.user.update({
        where: { id: staff.userId },
        data: { role: "CUSTOMER" },
      })
    }

    await prisma.staff.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Personel silinemedi" }, { status: 500 })
  }
}
