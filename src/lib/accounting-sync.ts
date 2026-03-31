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

    toCreate.push({
      ...base,
      accountCode: "GELIR_ACENTA",
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      agencyId: cashEntry.agencyId ?? undefined,
      description: cashEntry.description ?? "Acenta geliri",
    })

    // Acenta carisi: ödeme aldık → borç azalır (credit)
    // Para birimi acentanınkinden farklıysa TCMB kuruyla çevir
    if (cashEntry.agencyId) {
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

    toCreate.push({
      ...base,
      accountCode: "GELIR_PERSONEL",
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      staffId: cashEntry.staffId ?? undefined,
      description: cashEntry.description ?? "Personel geliri",
    })

    // Prim borcu: personel carisi debit (borç) + GIDER_PERSONEL_PRIM kaydı
    if (cashEntry.staffId && cashEntry.staff?.commissionRate) {
      const primAmount = parseFloat((amt * cashEntry.staff.commissionRate / 100).toFixed(2))
      const staffName = cashEntry.staff.user?.name ?? "Personel"
      const primDesc = `Prim: %${cashEntry.staff.commissionRate} × ${amt.toLocaleString("tr-TR")} ${cur} (${staffName})`
      // Gider tarafı
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
      // Cari tarafı (personele olan prim borcu)
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

  // Kredi kartı geliri
  if (cashEntry.creditCardAmount && cashEntry.creditCardCurrency) {
    const amt = cashEntry.creditCardAmount
    const cur = cashEntry.creditCardCurrency

    toCreate.push({
      ...base,
      accountCode: "GELIR_KREDI_KARTI",
      credit: amt,
      debit: 0,
      amount: amt,
      currency: cur,
      staffId: cashEntry.staffId ?? undefined,
      description: cashEntry.description ?? "Kredi kartı geliri",
    })

    // Acenta kredi kartı ödemesi → acenta carisi credit (nakit ile aynı mantık)
    if (cashEntry.agencyId) {
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
          description: `${cashEntry.description ?? "Acenta KK ödemesi"} (${amt} ${cur} → ${converted} ${agencyCurrency}${rateStr})`,
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
          description: cashEntry.description ?? "Acenta KK ödemesi",
        })
      }
    }

    // Personel kredi kartından da prim oluşur
    if (cashEntry.staffId && cashEntry.staff?.commissionRate) {
      const primAmount = parseFloat((amt * cashEntry.staff.commissionRate / 100).toFixed(2))
      const staffName = cashEntry.staff.user?.name ?? "Personel"
      const primDesc = `Prim (KK): %${cashEntry.staff.commissionRate} × ${amt.toLocaleString("tr-TR")} ${cur} (${staffName})`
      // Gider tarafı
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
      // Cari tarafı
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
