import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import bcrypt from "bcryptjs"

const driverSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir email giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz"),
})

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  const drivers = await prisma.driver.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { transfers: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(drivers)
}

export async function POST(req: NextRequest) {
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
    const body = await req.json()
    const validatedData = driverSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu email adresi zaten kullanılıyor" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create user and driver in a transaction
    const driver = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validatedData.name,
          email: validatedData.email,
          password: hashedPassword,
          phone: validatedData.phone,
          role: "DRIVER",
        },
      })

      return tx.driver.create({
        data: {
          userId: user.id,
          phone: validatedData.phone,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })
    })

    return NextResponse.json(driver)
  } catch (error) {
    console.error("Driver creation error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Şoför oluşturulamadı" },
      { status: 500 }
    )
  }
}
