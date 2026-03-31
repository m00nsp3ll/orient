import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const SETTING_KEY = "accounting_custom_categories"

type CustomCategory = {
  code: string
  label: string
  type: "income" | "expense"
}

async function loadCustomCategories(): Promise<CustomCategory[]> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } })
  if (!setting) return []
  try { return JSON.parse(setting.value) } catch { return [] }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }
  const cats = await loadCustomCategories()
  return NextResponse.json(cats)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { label, type } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: "Kalem adı boş olamaz" }, { status: 400 })
  if (type !== "income" && type !== "expense") return NextResponse.json({ error: "Tip geçersiz" }, { status: 400 })

  const cats = await loadCustomCategories()

  // Kod üret: OZEL_GIDER_xxx veya OZEL_GELIR_xxx
  const prefix = type === "expense" ? "OZEL_GIDER_" : "OZEL_GELIR_"
  const slug = label.trim()
    .toUpperCase()
    .replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ş/g, "S")
    .replace(/İ/g, "I").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const base = `${prefix}${slug}`
  // Çakışma varsa suffix ekle
  let code = base
  let n = 2
  while (cats.some(c => c.code === code)) { code = `${base}_${n++}` }

  const newCat: CustomCategory = { code, label: label.trim(), type }
  cats.push(newCat)

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(cats) },
    create: { key: SETTING_KEY, value: JSON.stringify(cats) },
  })

  return NextResponse.json(newCat)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  if (!code) return NextResponse.json({ error: "Kod gerekli" }, { status: 400 })

  const cats = await loadCustomCategories()
  const updated = cats.filter(c => c.code !== code)

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(updated) },
    create: { key: SETTING_KEY, value: JSON.stringify(updated) },
  })

  return NextResponse.json({ success: true })
}
