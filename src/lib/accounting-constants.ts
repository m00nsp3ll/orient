export const EXPENSE_CATEGORIES = [
  { code: "GIDER_ELEKTRIK_SU",       label: "Elektrik - Su Gideri" },
  { code: "GIDER_YAKIT",             label: "Yakıt Gideri" },
  { code: "GIDER_PERSONEL_PRIM",     label: "Personel Prim Gideri" },
  { code: "GIDER_PERSONEL_MAAS",     label: "Personel Maaş Gideri" },
  { code: "GIDER_ARAC_YAKIT",        label: "Araç Yakıt Gideri" },
  { code: "GIDER_TELEFON_INTERNET",  label: "Telefon ve İnternet Faturaları" },
  { code: "GIDER_ARAC_BAKIM",        label: "Araç Bakım Giderleri" },
  { code: "GIDER_ISYERI_BAKIM",      label: "İşyeri Bakım Onarım Giderleri" },
  { code: "GIDER_SPA_MALZEME",       label: "Spa Malzeme Gideri" },
  { code: "GIDER_VERGI",             label: "Vergi Ödemeleri" },
  { code: "GIDER_SSK",               label: "SSK Primleri" },
  { code: "GIDER_KDV",               label: "KDV Ödemeleri" },
  { code: "GIDER_TRAFIK_CEZASI",     label: "Trafik Cezası Giderleri" },
  { code: "GIDER_MUTFAK",            label: "Ana Mutfak Giderleri" },
  { code: "GIDER_KIRA",              label: "Kira Gideri" },
  { code: "GIDER_LOJMAN",            label: "Lojman Gideri" },
  { code: "GIDER_HANUT_KOMISYONU",   label: "Hanut Komisyonu" },
  { code: "GIDER_DIGER",             label: "Diğer Giderler" },
  { code: "GIDER_KASA_TESLIM_BARIS", label: "Kasa Teslim - Barış Bey" },
] as const

export type ExpenseCategoryCode = typeof EXPENSE_CATEGORIES[number]["code"]

export const INCOME_SUB_CATEGORIES = [
  { code: "GELIR_CILT_BAKIMI", label: "Cilt Bakımı Geliri" },
  { code: "GELIR_EXTRA_PAKET", label: "Extra Paket Satışı" },
  { code: "GELIR_MASAJ",       label: "Masaj Satışı" },
  { code: "GELIR_MARKET",      label: "Market Geliri" },
] as const

export type IncomeSubCategoryCode = typeof INCOME_SUB_CATEGORIES[number]["code"]

export function staffAccountCode(staffId: string): string {
  return `CARI_PERSONEL_${staffId}`
}

export function agencyAccountCode(agencyId: string): string {
  return `CARI_ACENTA_${agencyId}`
}

export function getExpenseCategoryLabel(code: string): string {
  return EXPENSE_CATEGORIES.find(c => c.code === code)?.label ?? code
}

export function getIncomeSubCategoryLabel(code: string): string {
  return INCOME_SUB_CATEGORIES.find(c => c.code === code)?.label ?? "Resepsiyon Geliri"
}

export const ACCOUNT_LABELS: Record<string, string> = {
  GELIR_RESEPSIYON:  "Resepsiyon Geliri",
  GELIR_ACENTA:      "Acenta Geliri",
  GELIR_PERSONEL:    "Personel Geliri",
  GELIR_KREDI_KARTI: "Kredi Kartı Geliri",
}
