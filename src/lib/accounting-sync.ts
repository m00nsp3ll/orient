import { Prisma } from "@prisma/client"
import { staffAccountCode, agencyAccountCode } from "./accounting-constants"

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
  staff: { commissionRate: number | null } | null
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
    if (cashEntry.agencyId) {
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

    // Prim borcu: personel carisi debit (borç)
    if (cashEntry.staffId && cashEntry.staff?.commissionRate) {
      const primAmount = amt * cashEntry.staff.commissionRate / 100
      toCreate.push({
        ...base,
        accountCode: staffAccountCode(cashEntry.staffId),
        debit: primAmount,
        credit: 0,
        amount: primAmount,
        currency: cur,
        staffId: cashEntry.staffId,
        description: `Prim: %${cashEntry.staff.commissionRate} × ${amt.toLocaleString("tr-TR")} ${cur}`,
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

    // Personel kredi kartından da prim oluşur
    if (cashEntry.staffId && cashEntry.staff?.commissionRate) {
      const primAmount = amt * cashEntry.staff.commissionRate / 100
      toCreate.push({
        ...base,
        accountCode: staffAccountCode(cashEntry.staffId),
        debit: primAmount,
        credit: 0,
        amount: primAmount,
        currency: cur,
        staffId: cashEntry.staffId,
        description: `Prim (KK): %${cashEntry.staff.commissionRate} × ${amt.toLocaleString("tr-TR")} ${cur}`,
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
