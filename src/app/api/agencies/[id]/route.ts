import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

const updateAgencySchema = z.object({
  companyName: z.string().min(2).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  currency: z.enum(["EUR", "USD", "GBP", "TRY"]).optional(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır").optional(),
  username: z.string().min(2, "Kullanıcı adı en az 2 karakter olmalıdır").optional(),
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

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = updateAgencySchema.parse(body)

    const { password, username, ...agencyData } = validatedData

    // Agency'yi bul
    const existingAgency = await prisma.agency.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!existingAgency) {
      return NextResponse.json({ error: "Acenta bulunamadı" }, { status: 404 })
    }

    // Agency alanlarını güncelle (varsa)
    const agencyUpdateData: Record<string, unknown> = {}
    if (agencyData.companyName !== undefined) agencyUpdateData.companyName = agencyData.companyName
    if (agencyData.address !== undefined) agencyUpdateData.address = agencyData.address
    if (agencyData.isActive !== undefined) agencyUpdateData.isActive = agencyData.isActive
    if (agencyData.currency !== undefined) agencyUpdateData.currency = agencyData.currency
    if (password) agencyUpdateData.plainPassword = password

    if (Object.keys(agencyUpdateData).length > 0) {
      await prisma.agency.update({
        where: { id },
        data: agencyUpdateData,
      })
    }

    // User güncellemesi
    if (existingAgency.user && (password || username)) {
      const userUpdateData: Record<string, string> = {}

      if (username) {
        const existingUser = await prisma.user.findUnique({ where: { email: username } })
        if (existingUser && existingUser.id !== existingAgency.user.id) {
          return NextResponse.json(
            { error: "Bu kullanıcı adı zaten kullanılıyor" },
            { status: 400 }
          )
        }
        userUpdateData.email = username
      }

      if (password) {
        userUpdateData.password = await bcrypt.hash(password, 12)
      }

      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: existingAgency.user.id },
          data: userUpdateData,
        })
      }
    } else if (!existingAgency.user && (password || username)) {
      // User yoksa yeni user oluştur ve agency'ye bağla
      const loginEmail = username || `agency_${existingAgency.code}@orient.local`
      const existingUser = await prisma.user.findUnique({ where: { email: loginEmail } })
      if (existingUser) {
        return NextResponse.json(
          { error: "Bu kullanıcı adı zaten kullanılıyor" },
          { status: 400 }
        )
      }
      const hashedPassword = await bcrypt.hash(password || "123456", 12)
      const newUser = await prisma.user.create({
        data: {
          name: existingAgency.name || existingAgency.companyName || "Agency",
          email: loginEmail,
          password: hashedPassword,
          role: "AGENCY",
        },
      })
      await prisma.agency.update({
        where: { id },
        data: { userId: newUser.id },
      })
    }

    // Güncel bilgiyi döndür
    const updatedAgency = await prisma.agency.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        _count: {
          select: { appointments: true },
        },
      },
    })

    return NextResponse.json(updatedAgency)
  } catch (error) {
    console.error("Agency PATCH error:", error)
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

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    await prisma.agency.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Acenta silinemedi" }, { status: 500 })
  }
}
