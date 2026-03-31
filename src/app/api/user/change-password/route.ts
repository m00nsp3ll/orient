import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Tüm alanlar zorunlu" }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Yeni şifre en az 6 karakter olmalı" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: "Mevcut şifre hatalı" }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Şifre değiştirilemedi" }, { status: 500 })
  }
}
