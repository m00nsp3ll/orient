import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const quotaSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  maxQuota: z.number().min(1),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const quotas = await prisma.timeSlotQuota.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  })

  return NextResponse.json(quotas)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = quotaSchema.parse(body)

    const quota = await prisma.timeSlotQuota.upsert({
      where: {
        dayOfWeek_startTime: {
          dayOfWeek: validatedData.dayOfWeek,
          startTime: validatedData.startTime,
        },
      },
      update: {
        endTime: validatedData.endTime,
        maxQuota: validatedData.maxQuota,
        isActive: validatedData.isActive ?? true,
      },
      create: {
        dayOfWeek: validatedData.dayOfWeek,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        maxQuota: validatedData.maxQuota,
        isActive: validatedData.isActive ?? true,
      },
    })

    return NextResponse.json(quota)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Kota kaydedilemedi" },
      { status: 500 }
    )
  }
}
