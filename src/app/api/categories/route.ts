import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const categorySchema = z.object({
  name: z.string().min(1, "Kategori adı gerekli"),
  description: z.string().optional(),
  order: z.number().optional(),
})

export async function GET() {
  const categories = await prisma.serviceCategory.findMany({
    include: { services: true },
    orderBy: { order: "asc" },
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = categorySchema.parse(body)

    const category = await prisma.serviceCategory.create({
      data: validatedData,
    })

    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Kategori oluşturulamadı" },
      { status: 500 }
    )
  }
}
