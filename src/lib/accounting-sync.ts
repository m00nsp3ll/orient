import { Prisma } from "@prisma/client"
import { staffAccountCode, agencyAccountCode } from "./accounting-constants"
import { prisma } from "./prisma"

type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

interface CashEntryForSync {
  id: string
  date: Date
  agencyIncomeAmount: number | null
  agencyIncomeCurrency: string | null
  agencyId: string | null
  receptionIncomeAmount: number | null
  receptionIncomeCurrency: string | null
  incomeSubCategory: string | null
  staffIncomeAmount: number | null
  staffIncomeCurrency: string | null
  staffId: string | null
  creditCardAmount: number | null
  creditCardCurrency: string | null
  expenseAmount: number | null
  expenseCurrency: string | null
  expenseCategory: string | null
  description: string | null
  staff: { commissionRate: number | null; user?: { name: string } } | null
}

// Cem'e özel günlük kota sabitleri
const CEM_DAILY_QUOTA_EUR = 2000
const CEM_RATE_LOW = 15   // kota dolmadan
const CEM_RATE_HIGH = 20  // kota dolduktan sonraki fazla kısım

// TCMB kuru ile döviz çevirme (REST hesaplamasındaki aynı algoritma)
async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<{ converted: number; rate: number | null }> {
  if (fromCurrency === toCurrency) return { converted: amount, rate: 1 }
  try {
    const tcmbRes = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml")
    if (tcmbRes.ok) {
      const xml = await tcmbRes.text()
      const getSellingRate = (code: string): number | null => {
        if (code === "TRY") return 1
        const regex = new RegExp(`<Currency[^>]*Kod="${code}"[^>]*>[\\s\\S]*?<ForexSelling>([\\d.]+)</ForexSelling>`)
        const match = xml.match(regex)
        return match ? parseFloat(match[1]) : null
      }
      const fromRate = getSellingRate(fromCurrency)
      const toRate = getSellingRate(toCurrency)
      if (fromRate && toRate) {
        const rate = parseFloat((fromRate / toRate).toFixed(4))
        return { converted: parseFloat(((amount * fromRate) / toRate).toFixed(2)), rate }
      }
    }
  } catch {}
  return { converted: amount, rate: null }
}

// Cem'e özel kademeli prim hesaplama:
// O günkü bu kayıttan ÖNCE yapılan toplam geliri EUR cinsinden hesapla,
// sonra yeni geliri 2000€ kotasına göre böl: altı %15, üstü %20
async function calcCemPrim(
  tx: TransactionClient,
  cashEntryId: string,
  staffId: string,
  date: Date,
  newAmountEur: number
): Promise<Array<{ amountEur: number; rate: number; label: string }>> {
  // Bu girişten önceki aynı gün kayıtları (kendisi hariç)
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const prevEntries = await tx.cashEntry.findMany({
    where: {
      staffId,
      id: { not: cashEntryId },
      date: { gte: dayStart, lt: dayEnd },
    },
    select: {
      staffIncomeAmount: true,
      staffIncomeCurrency: true,
      creditCardAmount: true,
      creditCardCurrency: true,
    },
  })

  // Önceki toplam geliri EUR'a çevir
  let prevTotalEur = 0
  for (const e of prevEntries) {
    if (e.staffIncomeAmount && e.staffIncomeCurrency) {
      const { converted } = await convertCurrency(e.staffIncomeAmount, e.staffIncomeCurrency, "EUR")
      prevTotalEur += converted
    }
    if (e.creditCardAmount && e.creditCardCurrency) {
      const { converted } = await convertCurrency(e.creditCardAmount, e.creditCardCurrency, "EUR")
      prevTotalEur += converted
    }
  }

  // Yeni geliri kotaya göre böl
  const remaining = Math.max(CEM_DAILY_QUOTA_EUR - prevTotalEur, 0)
  const belowQuota = Math.min(newAmountEur, remaining)
  const aboveQuota = Math.max(newAmountEur - remaining, 0)

  const result: Array<{ amountEur: number; rate: number; label: string }> = []
  if (belowQuota > 0) result.push({ amountEur: belowQuota, rate: CEM_RATE_LOW, label: `%${CEM_RATE_LOW} (kota altı)` })
  if (aboveQuota > 0) result.push({ amountEur: aboveQuota, rate: CEM_RATE_HIGH, label: `%${CEM_RATE_HIGH} (kota üstü)` })
  return result
}

export async function syncAccountingEntries(
  tx: TransactionClient,
  cashEntry: CashEntryForSync,
  createdBy: string
): Promise<void> {
  // Mevcut entry'leri sil (update durumunda yeniden oluşturmak için)
  await tx.accountingEntry.deleteMany({ where: { cashEntryId: cashEntry.id } })

  const toCreate: Prisma.AccountingEntryCreateManyInput[] = []

  const base = {
    cashEntryId: cashEntry.id,
    date: cashEntry.date,
    createdBy,
  }

  // Acenta geliri
  if (cashEntry.agencyIncomeAmount && cashEntry.agencyIncomeCurrency) {
    const amt = cashEntry.agencyIncomeAmount
    const cur = cashEntry.agencyIncomeCurrency
    const isRest = cashEntry.incomeSubCategory === "GELIR_REST"

    // REST geliri ayrı hesap kodunda (istatistik için); normal acenta geliri GELIR_ACENTA'da
    toCreate.push({
      ...base,
      accountCode: isRest ? "GELIR_REST" : "GELIR_ACENTA",
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      agencyId: cashEntry.agencyId ?? undefined,
      description: cashEntry.description ?? (isRest ? "REST geliri" : "Acenta geliri"),
    })

    // Acenta carisi: ödeme aldık → borç azalır (credit)
    // REST geliri için acenta portfolyosuna ekleme (sadece kasa geliri kaydedilir)
    // Para birimi acentanınkinden farklıysa TCMB kuruyla çevir
    if (cashEntry.agencyId && cashEntry.incomeSubCategory !== "GELIR_REST") {
      const agency = await prisma.agency.findUnique({
        where: { id: cashEntry.agencyId },
        select: { currency: true },
      })
      const agencyCurrency = agency?.currency || "EUR"

      if (cur !== agencyCurrency) {
        const { converted, rate } = await convertCurrency(amt, cur, agencyCurrency)
        const rateStr = rate ? ` | Kur: 1 ${cur} = ${rate} ${agencyCurrency}` : ""
        toCreate.push({
          ...base,
          accountCode: agencyAccountCode(cashEntry.agencyId),
          debit: 0,
          credit: converted,
          amount: converted,
          currency: agencyCurrency,
          agencyId: cashEntry.agencyId,
          description: `${cashEntry.description ?? "Acenta ödemesi"} (${amt} ${cur} → ${converted} ${agencyCurrency}${rateStr})`,
        })
      } else {
        toCreate.push({
          ...base,
          accountCode: agencyAccountCode(cashEntry.agencyId),
          debit: 0,
          credit: amt,
          amount: amt,
          currency: cur,
          agencyId: cashEntry.agencyId,
          description: cashEntry.description ?? "Acenta ödemesi",
        })
      }
    }
  }

  // Resepsiyon geliri
  if (cashEntry.receptionIncomeAmount && cashEntry.receptionIncomeCurrency) {
    const amt = cashEntry.receptionIncomeAmount
    const cur = cashEntry.receptionIncomeCurrency
    const accountCode = cashEntry.incomeSubCategory ?? "GELIR_RESEPSIYON"

    toCreate.push({
      ...base,
      accountCode,
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      description: cashEntry.description ?? "Resepsiyon geliri",
    })
  }

  // Personel geliri
  if (cashEntry.staffIncomeAmount && cashEntry.staffIncomeCurrency) {
    const amt = cashEntry.staffIncomeAmount
    const cur = cashEntry.staffIncomeCurrency
    const accountCode = cashEntry.incomeSubCategory ?? "GELIR_PERSONEL"

    toCreate.push({
      ...base,
      accountCode,
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      staffId: cashEntry.staffId ?? undefined,
      description: cashEntry.description ?? "Personel geliri",
    })

    // Prim borcu: personel carisi debit (borç) + GIDER_PERSONEL_PRIM kaydı
    if (cashEntry.staffId && cashEntry.staff?.commissionRate) {
      const staffName = cashEntry.staff.user?.name ?? "Personel"
      const isCem = staffName.toLowerCase().includes("cem")

      if (isCem) {
        // Kademeli prim: EUR'a çevir, kotaya böl
        const { converted: amtEur } = await convertCurrency(amt, cur, "EUR")
        const segments = await calcCemPrim(tx, cashEntry.id, cashEntry.staffId, cashEntry.date, amtEur)
        for (const seg of segments) {
          // Segmenti orijinal para birimine geri çevir
          const { converted: segAmt } = await convertCurrency(seg.amountEur, "EUR", cur)
          const primAmount = parseFloat((segAmt * seg.rate / 100).toFixed(2))
          const primDesc = `Prim: ${seg.label} × ${segAmt.toLocaleString("tr-TR")} ${cur} (${staffName})`
          toCreate.push({
            ...base,
            accountCode: "GIDER_PERSONEL_PRIM",
            debit: primAmount,
            credit: 0,
            amount: primAmount,
            currency: cur,
            staffId: cashEntry.staffId,
            description: primDesc,
          })
          toCreate.push({
            ...base,
            accountCode: staffAccountCode(cashEntry.staffId),
            debit: primAmount,
            credit: 0,
            amount: primAmount,
            currency: cur,
            staffId: cashEntry.staffId,
            description: primDesc,
          })
        }
      } else {
        const primAmount = parseFloat((amt * cashEntry.staff.commissionRate / 100).toFixed(2))
        const primDesc = `Prim: %${cashEntry.staff.commissionRate} × ${amt.toLocaleString("tr-TR")} ${cur} (${staffName})`
        toCreate.push({
          ...base,
          accountCode: "GIDER_PERSONEL_PRIM",
          debit: primAmount,
          credit: 0,
          amount: primAmount,
          currency: cur,
          staffId: cashEntry.staffId,
          description: primDesc,
        })
        toCreate.push({
          ...base,
          accountCode: staffAccountCode(cashEntry.staffId),
          debit: primAmount,
          credit: 0,
          amount: primAmount,
          currency: cur,
          staffId: cashEntry.staffId,
          description: primDesc,
        })
      }
    }
  }

  // Kredi kartı geliri
  if (cashEntry.creditCardAmount && cashEntry.creditCardCurrency) {
    const amt = cashEntry.creditCardAmount
    const cur = cashEntry.creditCardCurrency
    const isRestKK = cashEntry.incomeSubCategory === "GELIR_REST"

    toCreate.push({
      ...base,
      accountCode: isRestKK ? "GELIR_REST" : "GELIR_KREDI_KARTI",
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      agencyId: isRestKK ? (cashEntry.agencyId ?? undefined) : undefined,
      staffId: cashEntry.staffId ?? undefined,
      description: cashEntry.description ?? (isRestKK ? "REST geliri (KK)" : "Kredi kartı geliri"),
    })

    // KK işlemlerinde acenta sadece bilgi amaçlı — acenta portfolyosuna (cari) yansıtılmaz.
    // Portfolyoya sadece nakit acenta GENEL geliri yansır (Gelir Ekle → Acenta → Genel Gelir).

    // Personel kredi kartından da prim oluşur
    if (cashEntry.staffId && cashEntry.staff?.commissionRate) {
      const staffName = cashEntry.staff.user?.name ?? "Personel"
      const isCem = staffName.toLowerCase().includes("cem")

      if (isCem) {
        const { converted: amtEur } = await convertCurrency(amt, cur, "EUR")
        const segments = await calcCemPrim(tx, cashEntry.id, cashEntry.staffId, cashEntry.date, amtEur)
        for (const seg of segments) {
          const { converted: segAmt } = await convertCurrency(seg.amountEur, "EUR", cur)
          const primAmount = parseFloat((segAmt * seg.rate / 100).toFixed(2))
          const primDesc = `Prim (KK): ${seg.label} × ${segAmt.toLocaleString("tr-TR")} ${cur} (${staffName})`
          toCreate.push({
            ...base,
            accountCode: "GIDER_PERSONEL_PRIM",
            debit: primAmount,
            credit: 0,
            amount: primAmount,
            currency: cur,
            staffId: cashEntry.staffId,
            description: primDesc,
          })
          toCreate.push({
            ...base,
            accountCode: staffAccountCode(cashEntry.staffId),
            debit: primAmount,
            credit: 0,
            amount: primAmount,
            currency: cur,
            staffId: cashEntry.staffId,
            description: primDesc,
          })
        }
      } else {
        const primAmount = parseFloat((amt * cashEntry.staff.commissionRate / 100).toFixed(2))
        const primDesc = `Prim (KK): %${cashEntry.staff.commissionRate} × ${amt.toLocaleString("tr-TR")} ${cur} (${staffName})`
        toCreate.push({
          ...base,
          accountCode: "GIDER_PERSONEL_PRIM",
          debit: primAmount,
          credit: 0,
          amount: primAmount,
          currency: cur,
          staffId: cashEntry.staffId,
          description: primDesc,
        })
        toCreate.push({
          ...base,
          accountCode: staffAccountCode(cashEntry.staffId),
          debit: primAmount,
          credit: 0,
          amount: primAmount,
          currency: cur,
          staffId: cashEntry.staffId,
          description: primDesc,
        })
      }
    }
  }

  // Gider
  if (cashEntry.expenseAmount && cashEntry.expenseCurrency) {
    const amt = cashEntry.expenseAmount
    const cur = cashEntry.expenseCurrency
    const accountCode = cashEntry.expenseCategory ?? "GIDER_DIGER"

    toCreate.push({
      ...base,
      accountCode,
      debit: amt,
      credit: 0,
      amount: amt,
      currency: cur,
      staffId: cashEntry.staffId ?? undefined,
      description: cashEntry.description ?? "Gider",
    })

    // Personel prim ödeme → personel carisine credit (alacak — borç kapanır)
    if (
      accountCode === "GIDER_PERSONEL_PRIM" &&
      cashEntry.staffId
    ) {
      toCreate.push({
        ...base,
        accountCode: staffAccountCode(cashEntry.staffId),
        debit: 0,
        credit: amt,
        amount: amt,
        currency: cur,
        staffId: cashEntry.staffId,
        description: cashEntry.description ?? "Prim ödemesi",
      })
    }
  }

  if (toCreate.length > 0) {
    await tx.accountingEntry.createMany({ data: toCreate })
  }
}
