import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { id } = await params

  // Agency users can only see their own balance
  if (session.user.role === "AGENCY") {
    const userAgency = await prisma.agency.findUnique({
      where: { userId: session.user.id },
    })
    if (!userAgency || userAgency.id !== id) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
    }
  } else if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 })
  }

  const agency = await prisma.agency.findUnique({
    where: { id },
    select: { id: true, name: true, companyName: true, currency: true },
  })

  if (!agency) {
    return NextResponse.json({ error: "Acenta bulunamadı" }, { status: 404 })
  }

  const transactions = await prisma.agencyTransaction.findMany({
    where: { agencyId: id },
    include: {
      appointment: {
        select: {
          id: true,
          customerName: true,
          startTime: true,
          pax: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Calculate balance: DEBIT increases debt, CREDIT/PAYMENT decreases
  let balance = 0
  for (const tx of transactions) {
    if (tx.type === "DEBIT") {
      balance += tx.amount
    } else {
      balance -= tx.amount
    }
  }

  return NextResponse.json({
    agency,
    balance,
    currency: agency.currency,
    transactions,
  })
}
