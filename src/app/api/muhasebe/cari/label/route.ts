import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Kalem label override — SystemSetting tablosuna kaydedilir
// key: "accounting_label_GIDER_ELEKTRIK_SU" → value: "Özel İsim"
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { accountCode, label } = await req.json()
  if (!accountCode || !label) {
    return NextResponse.json({ error: "accountCode ve label gerekli" }, { status: 400 })
  }

  const key = `accounting_label_${accountCode}`
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: label },
    create: { key, value: label },
  })

  return NextResponse.json({ success: true })
}
