"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  LayoutDashboard,
  Users,
  Scissors,
  Settings,
  Menu,
  X,
  Building2,
  Hotel,
  Truck,
  UserCog,
  BarChart3,
  Car,
  Timer,
  Wallet,
} from "lucide-react"
import { useState } from "react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "STAFF", "AGENCY"] },
  { name: "Şoför Paneli", href: "/driver", icon: Car, roles: ["DRIVER"] },
  { name: "Randevular", href: "/dashboard/appointments", icon: Calendar, roles: ["ADMIN", "STAFF", "AGENCY"] },
  { name: "Operasyon", href: "/dashboard/operations", icon: Truck, roles: ["ADMIN", "STAFF"] },
  { name: "Şoförler", href: "/dashboard/operations/drivers", icon: UserCog, roles: ["ADMIN"] },
  { name: "Hizmetler", href: "/dashboard/services", icon: Scissors, roles: ["ADMIN", "STAFF"] },
  { name: "Personel", href: "/dashboard/staff", icon: Users, roles: ["ADMIN", "STAFF"] },
  { name: "Oteller", href: "/dashboard/hotels", icon: Hotel, roles: ["ADMIN"] },
  { name: "Alınış Saatleri", href: "/dashboard/session-times", icon: Timer, roles: ["ADMIN"] },
  { name: "Günlük Kasa", href: "/dashboard/kasa", icon: Wallet, roles: ["ADMIN"] },
  { name: "İstatistikler", href: "/dashboard/statistics", icon: BarChart3, roles: ["ADMIN", "STAFF"] },
  { name: "Acentalar", href: "/dashboard/agencies", icon: Building2, roles: ["ADMIN"] },
  { name: "Ayarlar", href: "/dashboard/settings", icon: Settings, roles: ["ADMIN"] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredNav = navigation.filter((item) => {
    const userRole = session?.user.role || ""
    return item.roles.includes(userRole)
  })

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b">
            <Link href="/dashboard" className="text-xl font-bold text-primary">
              Orient SPA
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">{session?.user?.name}</span>
                    <span className="text-xs text-gray-500">
                      {session?.user?.role}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}
