"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Shield, Save } from "lucide-react"
import { STAFF_POSITIONS, PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from "@/lib/permissions"
import type { PermissionKey } from "@/lib/permissions"

type PermMatrix = Record<string, PermissionKey[]>

export function StaffPermissions() {
  const queryClient = useQueryClient()
  const [matrix, setMatrix] = useState<PermMatrix | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const { data: fetchedMatrix, isLoading } = useQuery<PermMatrix>({
    queryKey: ["permissions-matrix"],
    queryFn: async () => {
      const res = await fetch("/api/permissions", { method: "PATCH" })
      if (!res.ok) return DEFAULT_STAFF_PERMISSIONS
      return res.json()
    },
  })

  // Sync fetched data into local state (only on first load)
  if (fetchedMatrix && !matrix && !dirty) {
    setMatrix(fetchedMatrix)
  }

  const toggle = (position: string, key: PermissionKey) => {
    if (!matrix) return
    setMatrix(prev => {
      const current = prev![position] || []
      const next = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key]
      return { ...prev!, [position]: next }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!matrix) return
    setSaving(true)
    try {
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matrix),
      })
      if (!res.ok) throw new Error()
      toast.success("Yetkiler kaydedildi")
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ["permissions"] })
    } catch {
      toast.error("Yetkiler kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !matrix) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">Yetkiler yükleniyor...</CardContent>
      </Card>
    )
  }

  const specialPerms = PERMISSIONS.filter(p => p.isSpecial)
  const viewPerms = PERMISSIONS.filter(p => !p.isSpecial)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Personel Rolleri
        </CardTitle>
        <CardDescription>Hangi pozisyonun hangi sayfalara erişebileceğini yönetin</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-gray-700 min-w-[180px]">Yetki</th>
                {STAFF_POSITIONS.map(pos => (
                  <th key={pos} className="text-center py-2 px-3 font-medium text-gray-700 min-w-[90px]">{pos}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Özel (kırmızı) yetkiler */}
              <tr>
                <td colSpan={STAFF_POSITIONS.length + 1} className="pt-4 pb-1">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                    Özel Yetkiler
                  </Badge>
                </td>
              </tr>
              {specialPerms.map(perm => (
                <tr key={perm.key} className="border-b border-red-100 bg-red-50/30">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-red-700">{perm.label}</div>
                    <div className="text-[11px] text-red-500">{perm.description}</div>
                  </td>
                  {STAFF_POSITIONS.map(pos => {
                    const checked = (matrix[pos] || []).includes(perm.key)
                    return (
                      <td key={pos} className="text-center py-2.5 px-3">
                        <Switch
                          checked={checked}
                          onCheckedChange={() => toggle(pos, perm.key)}
                          className="data-[state=checked]:bg-red-600"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Görüntüleme yetkileri */}
              <tr>
                <td colSpan={STAFF_POSITIONS.length + 1} className="pt-5 pb-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                    Görüntüleme Yetkileri
                  </Badge>
                </td>
              </tr>
              {viewPerms.map(perm => (
                <tr key={perm.key} className="border-b">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-gray-700">{perm.label}</div>
                    <div className="text-[11px] text-gray-400">{perm.description}</div>
                  </td>
                  {STAFF_POSITIONS.map(pos => {
                    const checked = (matrix[pos] || []).includes(perm.key)
                    return (
                      <td key={pos} className="text-center py-2.5 px-3">
                        <Switch
                          checked={checked}
                          onCheckedChange={() => toggle(pos, perm.key)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <p className="text-xs text-gray-400">
            Admin kullanıcılar (User role) her zaman tam erişime sahiptir
          </p>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Kaydediliyor..." : "Yetkileri Kaydet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
