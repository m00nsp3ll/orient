import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const workingHoursSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const workingHours = await prisma.workingHours.findMany({
    where: { staffId: id },
    orderBy: { dayOfWeek: "asc" },
  })

  return NextResponse.json(workingHours)
}

export async function POST(
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
    const validatedData = workingHoursSchema.parse(body)

    const workingHours = await prisma.workingHours.upsert({
      where: {
        staffId_dayOfWeek: {
          staffId: id,
          dayOfWeek: validatedData.dayOfWeek,
        },
      },
      update: {
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        isActive: validatedData.isActive ?? true,
      },
      create: {
        staffId: id,
        ...validatedData,
      },
    })

    return NextResponse.json(workingHours)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Çalışma saatleri kaydedilemedi" },
      { status: 500 }
    )
  }
}
