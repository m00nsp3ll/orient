"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import type { PermissionKey } from "@/lib/permissions"

export function usePermissions() {
  const { data: session } = useSession()

  const { data: permissions = [], isLoading } = useQuery<PermissionKey[]>({
    queryKey: ["permissions", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/permissions")
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000,
  })

  const isAdmin = session?.user?.role === "ADMIN"

  return {
    permissions,
    isLoading,
    has: (key: PermissionKey) => isAdmin || permissions.includes(key),
    isAdmin,
    position: session?.user?.position ?? null,
  }
}
