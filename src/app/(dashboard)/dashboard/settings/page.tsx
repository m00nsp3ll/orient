"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { KeyRound } from "lucide-react"

export default function SettingsPage() {
  const { data: session } = useSession()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Tüm alanları doldurun")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifreler eşleşmiyor")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Yeni şifre en az 6 karakter olmalı")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Şifre değiştirilemedi")
      } else {
        toast.success("Şifre başarıyla değiştirildi")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-gray-500">Hesap ayarlarınızı yönetin</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil Bilgileri</CardTitle>
          <CardDescription>Hesap bilgileriniz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">Ad Soyad</label>
            <p className="font-medium">{session?.user?.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <p className="font-medium">{session?.user?.email || "—"}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Rol</label>
            <p className="font-medium">{session?.user?.role}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Şifre Değiştir
          </CardTitle>
          <CardDescription>Mevcut şifrenizi girerek yeni şifre belirleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mevcut Şifre</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Yeni Şifre</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Yeni Şifre (Tekrar)</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Kaydediliyor..." : "Şifreyi Değiştir"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
