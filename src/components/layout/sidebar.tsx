"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  BookOpen,
  LogOut,
} from "lucide-react"
import { useState } from "react"
import { usePermissions } from "@/hooks/use-permissions"
import type { PermissionKey } from "@/lib/permissions"

const navigation: { name: string; href: string; icon: any; roles: string[]; permissionKey?: PermissionKey }[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "STAFF", "AGENCY"], permissionKey: "dashboard_view" },
  { name: "Şoför Paneli", href: "/driver", icon: Car, roles: ["DRIVER"] },
  { name: "Randevular", href: "/dashboard/appointments", icon: Calendar, roles: ["ADMIN", "STAFF", "AGENCY"], permissionKey: "randevu_view" },
  { name: "Operasyon", href: "/dashboard/operations", icon: Truck, roles: ["ADMIN", "STAFF"], permissionKey: "operasyon_view" },
  { name: "Şoförler", href: "/dashboard/operations/drivers", icon: UserCog, roles: ["ADMIN", "STAFF"], permissionKey: "operasyon_view" },
  { name: "Hizmetler", href: "/dashboard/services", icon: Scissors, roles: ["ADMIN", "STAFF"], permissionKey: "hizmetler_view" },
  { name: "Personel", href: "/dashboard/staff", icon: Users, roles: ["ADMIN", "STAFF"], permissionKey: "personel_view" },
  { name: "Oteller", href: "/dashboard/hotels", icon: Hotel, roles: ["ADMIN", "STAFF"], permissionKey: "oteller_view" },
  { name: "Alınış Saatleri", href: "/dashboard/session-times", icon: Timer, roles: ["ADMIN", "STAFF"], permissionKey: "oteller_view" },
  { name: "Günlük Kasa", href: "/dashboard/kasa", icon: Wallet, roles: ["ADMIN", "STAFF"], permissionKey: "kasa_view" },
  { name: "Muhasebe", href: "/dashboard/muhasebe", icon: BookOpen, roles: ["ADMIN", "STAFF"], permissionKey: "muhasebe_view" },
  { name: "İstatistikler", href: "/dashboard/statistics", icon: BarChart3, roles: ["ADMIN", "STAFF"], permissionKey: "istatistik_view" },
  { name: "Acentalar", href: "/dashboard/agencies", icon: Building2, roles: ["ADMIN", "STAFF"], permissionKey: "acentalar_view" },
  { name: "Ayarlar", href: "/dashboard/settings", icon: Settings, roles: ["ADMIN", "STAFF", "AGENCY", "DRIVER"] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const { has } = usePermissions()

  const filteredNav = navigation.filter((item) => {
    const userRole = session?.user.role || ""
    // Rol listesinde yoksa hiç gösterme
    if (!item.roles.includes(userRole)) return false
    // STAFF kullanıcılar için permission kontrolü
    if (userRole === "STAFF" && item.permissionKey) {
      return has(item.permissionKey)
    }
    return true
  })

  return (
    <>
      {/* Mobile menu button — sadece menü kapalıyken göster */}
      {!mobileOpen && (
        <div className="lg:hidden fixed top-2.5 left-3 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <Link href="/dashboard" className="text-xl font-bold text-primary">
              Orient SPA
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
          <div className="p-4 border-t space-y-1">
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm min-w-0">
                <span className="font-medium truncate">{session?.user?.name}</span>
                <span className="text-xs text-gray-500">{session?.user?.role}</span>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
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
