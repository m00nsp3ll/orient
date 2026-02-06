import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const agencySchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir email adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  phone: z.string().optional(),
  companyName: z.string().min(2, "Şirket adı gerekli"),
  address: z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const agencies = await prisma.agency.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      _count: {
        select: { appointments: true },
      },
    },
    orderBy: { companyName: "asc" },
  })

  return NextResponse.json(agencies)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = agencySchema.parse(body)

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

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        phone: validatedData.phone,
        role: "AGENCY",
      },
    })

    const agency = await prisma.agency.create({
      data: {
        userId: user.id,
        companyName: validatedData.companyName,
        address: validatedData.address,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    })

    // Yeni acentaya tüm hizmetleri ata
    const allServices = await prisma.service.findMany()
    if (allServices.length > 0) {
      await prisma.agencyService.createMany({
        data: allServices.map(service => ({
          agencyId: agency.id,
          serviceId: service.id,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json(agency)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Acenta oluşturulamadı" },
      { status: 500 }
    )
  }
}
