export type CurrencyCode = "EUR" | "USD" | "GBP" | "TRY"

export interface ExchangeRates {
  [code: string]: { buying: number; selling: number }
}

export function getCurrencySymbol(code: CurrencyCode | string): string {
  switch (code) {
    case "EUR": return "€"
    case "USD": return "$"
    case "GBP": return "£"
    case "TRY": return "₺"
    default: return code
  }
}

export function formatCurrency(amount: number, code: CurrencyCode | string): string {
  return `${getCurrencySymbol(code)} ${amount.toFixed(2)}`
}

/**
 * Convert between currencies using TCMB TRY selling rates (cross rate).
 * If from/to is TRY, direct conversion.
 * Otherwise: amount → TRY (via selling) → target (via selling).
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode | string,
  to: CurrencyCode | string,
  rates: ExchangeRates
): number | null {
  if (from === to) return amount
  if (amount <= 0) return null

  // Get TRY value of 1 unit of currency
  const getTRYRate = (code: string): number | null => {
    if (code === "TRY") return 1
    return rates[code]?.selling ?? null
  }

  const fromRate = getTRYRate(from)
  const toRate = getTRYRate(to)

  if (!fromRate || !toRate) return null

  // from → TRY → to
  const tryAmount = amount * fromRate
  return tryAmount / toRate
}
