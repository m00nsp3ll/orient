import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email ve şifre gerekli" },
        { status: 400 }
      )
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        driver: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { message: "Email veya şifre hatalı" },
        { status: 401 }
      )
    }

    // Şifre kontrolü
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { message: "Email veya şifre hatalı" },
        { status: 401 }
      )
    }

    // Şoför rolü kontrolü
    if (user.role !== "DRIVER" || !user.driver) {
      return NextResponse.json(
        { message: "Bu hesap şoför hesabı değil" },
        { status: 403 }
      )
    }

    // JWT token oluştur
    const token = jwt.sign(
      { userId: user.id, driverId: user.driver.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    )

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      driver: {
        id: user.driver.id,
        userId: user.driver.userId,
        phone: user.driver.phone,
        isActive: user.driver.isActive,
      },
      token,
    })
  } catch (error) {
    console.error("Driver login error:", error)
    return NextResponse.json(
      { message: "Giriş yapılırken hata oluştu" },
      { status: 500 }
    )
  }
}
