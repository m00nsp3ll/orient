"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "next-auth/react"

export default function SettingsPage() {
  const { data: session } = useSession()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-gray-500">Sistem ayarlarını yönetin</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profil Bilgileri</CardTitle>
            <CardDescription>Hesap bilgileriniz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">Ad Soyad</label>
              <p className="font-medium">{session?.user?.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="font-medium">{session?.user?.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Rol</label>
              <p className="font-medium">{session?.user?.role}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İşletme Ayarları</CardTitle>
            <CardDescription>
              İşletme bilgilerinizi güncelleyin (Yakında)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Bu özellik yakında eklenecek.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
