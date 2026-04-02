import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const updateDriverSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı").optional(),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz").optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const canManage = session.user.role === "ADMIN" ||
    await checkPermission(session.user.role, session.user.id, "soforer_view")
  if (!canManage) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const validatedData = updateDriverSchema.parse(body)

    const driver = await prisma.driver.findUnique({
      where: { id },
    })

    if (!driver) {
      return NextResponse.json({ error: "Şoför bulunamadı" }, { status: 404 })
    }

    // Update user and driver
    await prisma.$transaction(async (tx) => {
      if (validatedData.name) {
        await tx.user.update({
          where: { id: driver.userId },
          data: { name: validatedData.name },
        })
      }

      await tx.driver.update({
        where: { id },
        data: {
          phone: validatedData.phone,
          isActive: validatedData.isActive,
        },
      })
    })

    const updatedDriver = await prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(updatedDriver)
  } catch (error) {
    console.error("Driver update error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Şoför güncellenemedi" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const canManageDelete = session.user.role === "ADMIN" ||
    await checkPermission(session.user.role, session.user.id, "soforer_view")
  if (!canManageDelete) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const { id } = await params

    const driver = await prisma.driver.findUnique({
      where: { id },
    })

    if (!driver) {
      return NextResponse.json({ error: "Şoför bulunamadı" }, { status: 404 })
    }

    // Delete driver and user
    await prisma.$transaction(async (tx) => {
      await tx.driver.delete({ where: { id } })
      await tx.user.delete({ where: { id: driver.userId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Driver delete error:", error)
    return NextResponse.json(
      { error: "Şoför silinemedi" },
      { status: 500 }
    )
  }
}
