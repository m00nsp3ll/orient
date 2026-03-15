import { NextResponse } from "next/server"

interface CachedRates {
  date: string
  rates: Record<string, { buying: number; selling: number }>
  fetchedAt: number
}

const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

let cachedData: CachedRates | null = null

async function fetchTCMBRates(): Promise<CachedRates> {
  if (cachedData && Date.now() - cachedData.fetchedAt < CACHE_DURATION) {
    return cachedData
  }

  const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
    next: { revalidate: 900 },
  })

  if (!res.ok) {
    throw new Error(`TCMB API error: ${res.status}`)
  }

  const xml = await res.text()

  const currencies = ["USD", "EUR", "GBP"]
  const rates: Record<string, { buying: number; selling: number }> = {}

  for (const code of currencies) {
    const currencyRegex = new RegExp(
      `<Currency[^>]*Kod="${code}"[^>]*>([\\s\\S]*?)</Currency>`
    )
    const match = xml.match(currencyRegex)
    if (match) {
      const block = match[1]
      const buyingMatch = block.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/)
      const sellingMatch = block.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/)

      if (buyingMatch && sellingMatch) {
        rates[code] = {
          buying: parseFloat(buyingMatch[1]),
          selling: parseFloat(sellingMatch[1]),
        }
      }
    }
  }

  if (Object.keys(rates).length === 0) {
    throw new Error("Could not parse TCMB rates")
  }

  // Extract date from XML
  const dateMatch = xml.match(/<Tarih_Date[^>]*Tarih="(\d{2}\.\d{2}\.\d{4})"/)
  const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("tr-TR")

  cachedData = { date, rates, fetchedAt: Date.now() }
  return cachedData
}

export async function GET() {
  try {
    const data = await fetchTCMBRates()
    return NextResponse.json({
      date: data.date,
      rates: data.rates,
    })
  } catch (error) {
    console.error("Exchange rates error:", error)
    // Return last cached data if available
    if (cachedData) {
      return NextResponse.json({
        date: cachedData.date,
        rates: cachedData.rates,
        stale: true,
      })
    }
    return NextResponse.json(
      { error: "Döviz kurları alınamadı" },
      { status: 500 }
    )
  }
}
