import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateAgencySchema = z.object({
  companyName: z.string().min(2).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const agency = await prisma.agency.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      appointments: {
        include: {
          customer: { select: { name: true } },
          service: { select: { name: true } },
          staff: { include: { user: { select: { name: true } } } },
        },
        orderBy: { startTime: "desc" },
        take: 10,
      },
    },
  })

  if (!agency) {
    return NextResponse.json({ error: "Acenta bulunamadı" }, { status: 404 })
  }

  return NextResponse.json(agency)
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
    const validatedData = updateAgencySchema.parse(body)

    const agency = await prisma.agency.update({
      where: { id },
      data: validatedData,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    })

    return NextResponse.json(agency)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Acenta güncellenemedi" },
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
    const agency = await prisma.agency.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (agency) {
      await prisma.user.delete({
        where: { id: agency.userId },
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Acenta silinemedi" }, { status: 500 })
  }
}
