"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { toast.error("Kullanıcı adı ve şifre gerekli"); return }
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })
      if (result?.error) {
        toast.error("Kullanıcı adı veya şifre hatalı")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      toast.error("Giriş yapılırken bir hata oluştu")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Orient SPA</CardTitle>
          <CardDescription>Hesabınıza giriş yapın</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Kullanıcı Adı</Label>
              <Input
                type="text"
                placeholder="Kullanıcı adınız"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Şifre</Label>
              <Input
                type="password"
                placeholder="********"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
