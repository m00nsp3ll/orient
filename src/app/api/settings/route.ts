import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const key = searchParams.get("key")

    if (key) {
      const setting = await prisma.systemSetting.findUnique({ where: { key } })
      return NextResponse.json(setting || { key, value: null })
    }

    const settings = await prisma.systemSetting.findMany()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("GET /api/settings error:", error)
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await req.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key ve value gerekli" }, { status: 400 })
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })

    return NextResponse.json(setting)
  } catch (error) {
    console.error("PUT /api/settings error:", error)
    return NextResponse.json({ error: "Ayar güncellenemedi" }, { status: 500 })
  }
}
