import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/layout/sidebar"
import { CurrencyTicker } from "@/components/layout/currency-ticker"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className="transition-all duration-300"
        style={{ paddingLeft: "var(--sidebar-width, 16rem)" } as React.CSSProperties}
      >
        <header className="sticky top-0 z-30 h-12 bg-white/80 backdrop-blur border-b pl-16 pr-4 lg:px-6 flex items-center justify-end">
          <CurrencyTicker />
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
