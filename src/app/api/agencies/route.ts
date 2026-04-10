import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { checkPermission } from "@/lib/permissions"

const agencySchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
  email: z.string().min(2, "Kullanıcı adı en az 2 karakter olmalı"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  phone: z.string().optional(),
  companyName: z.string().min(2, "Şirket adı gerekli"),
  address: z.string().optional(),
  currency: z.enum(["EUR", "USD", "GBP", "TRY"]).optional().default("EUR"),
})

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  if (session.user.role === "STAFF") {
    const hasAgencyPerm = await checkPermission(session.user.role, session.user.id, "acentalar_view")
    const hasKasaPerm = await checkPermission(session.user.role, session.user.id, "kasa_view")
    if (!hasAgencyPerm && !hasKasaPerm) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
    }
  }

  const agencies = await prisma.agency.findMany({
    where: { isActive: true },
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

  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  if (session.user.role === "STAFF") {
    const hasPerm = await checkPermission(session.user.role, session.user.id, "acentalar_view")
    if (!hasPerm) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const validatedData = agencySchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor" },
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
        name: validatedData.companyName,
        code: `AGN${Date.now()}`, // Benzersiz kod oluştur
        companyName: validatedData.companyName,
        address: validatedData.address,
        currency: validatedData.currency,
        plainPassword: validatedData.password,
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

    // Acenta için otomatik cari aç (sıfır bakiye sentinel entry)
    await prisma.accountingEntry.create({
      data: {
        date: new Date(),
        accountCode: `CARI_ACENTA_${agency.id}`,
        debit: 0,
        credit: 0,
        amount: 0,
        currency: validatedData.currency ?? "EUR",
        description: `${validatedData.companyName} carisi açıldı`,
        agencyId: agency.id,
        createdBy: session.user.id,
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
    console.error("Agency POST error:", error)
    return NextResponse.json(
      { error: "Acenta oluşturulamadı", details: String(error) },
      { status: 500 }
    )
  }
}
