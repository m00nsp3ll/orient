import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getEffectivePermissions, DEFAULT_STAFF_PERMISSIONS, PERMISSIONS } from "@/lib/permissions"
import type { PermissionKey } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  // matrix=true parametresi ile tüm matris döner (admin panel için)
  const perms = await getEffectivePermissions(session.user.role, session.user.position)
  return NextResponse.json(perms)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body: Record<string, PermissionKey[]> = await req.json()

    // Validate structure
    const allKeys = PERMISSIONS.map(p => p.key)
    for (const [, keys] of Object.entries(body)) {
      if (!Array.isArray(keys)) {
        return NextResponse.json({ error: "Geçersiz format" }, { status: 400 })
      }
      for (const k of keys) {
        if (!allKeys.includes(k as PermissionKey)) {
          return NextResponse.json({ error: `Geçersiz yetki: ${k}` }, { status: 400 })
        }
      }
    }

    await prisma.systemSetting.upsert({
      where: { key: "staff_permissions" },
      update: { value: JSON.stringify(body) },
      create: { key: "staff_permissions", value: JSON.stringify(body) },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Yetkiler kaydedilemedi" }, { status: 500 })
  }
}

// GET /api/permissions/matrix — admin için tüm yetki matrisi
export async function PATCH() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: "staff_permissions" },
  })

  const matrix = setting ? JSON.parse(setting.value) : DEFAULT_STAFF_PERMISSIONS
  return NextResponse.json(matrix)
}
