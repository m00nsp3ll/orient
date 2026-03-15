"use client"

import { useQuery } from "@tanstack/react-query"

interface ExchangeRateResponse {
  date: string
  rates: Record<string, { buying: number; selling: number }>
}

export function CurrencyTicker() {
  const { data, isLoading, isError } = useQuery<ExchangeRateResponse>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/exchange-rates")
      if (!res.ok) throw new Error("Failed to fetch rates")
      return res.json()
    },
    refetchInterval: 15 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    retry: 2,
  })

  if (isError || (!isLoading && !data)) return null

  const currencies = [
    { code: "USD", symbol: "$", color: "text-emerald-700 bg-emerald-50" },
    { code: "EUR", symbol: "€", color: "text-blue-700 bg-blue-50" },
    { code: "GBP", symbol: "£", color: "text-purple-700 bg-purple-50" },
  ]

  return (
    <div className="flex items-center gap-2">
      {isLoading
        ? currencies.map((c) => (
            <div
              key={c.code}
              className="h-6 w-20 rounded bg-gray-100 animate-pulse"
            />
          ))
        : currencies.map((c) => {
            const rate = data?.rates[c.code]
            if (!rate) return null
            return (
              <span
                key={c.code}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${c.color}`}
              >
                {c.symbol} {rate.selling.toFixed(2)}
              </span>
            )
          })}
    </div>
  )
}
