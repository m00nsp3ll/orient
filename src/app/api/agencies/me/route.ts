import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find agency by userId
    const agency = await prisma.agency.findFirst({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
      },
    })

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 })
    }

    return NextResponse.json(agency)
  } catch (error) {
    console.error("Error fetching user agency:", error)
    return NextResponse.json(
      { error: "Failed to fetch agency" },
      { status: 500 }
    )
  }
}
