import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import bcrypt from "bcryptjs"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(4),
  phone: z.string().optional(),
})

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
    const data = registerSchema.parse(body)

    const existing = await prisma.user.findFirst({ where: { name: data.name } })
    if (existing) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kayıtlı" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        password: hashedPassword,
        phone: data.phone || null,
      },
    })

    return NextResponse.json({ id: user.id, name: user.name })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Register error:", error)
    return NextResponse.json({ error: "Kullanıcı oluşturulamadı" }, { status: 500 })
  }
}
