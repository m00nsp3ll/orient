import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const therapists = await prisma.therapist.findMany({
    orderBy: { name: "asc" },
  })
  return NextResponse.json(therapists)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const canManage = await checkPermission(session.user.role, session.user.id, "terapistler_yonetim")
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: "İsim gerekli" }, { status: 400 })
  }

  const therapist = await prisma.therapist.create({
    data: { name: name.trim() },
  })
  return NextResponse.json(therapist)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const canManagePatch = await checkPermission(session.user.role, session.user.id, "terapistler_yonetim")
  if (!canManagePatch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, name, isActive } = await req.json()
  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 })

  const therapist = await prisma.therapist.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  return NextResponse.json(therapist)
}
