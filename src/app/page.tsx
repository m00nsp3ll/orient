import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, Sparkles } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold text-rose-600">Orient SPA</div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Giriş Yap</Button>
            </Link>
            <Link href="/register">
              <Button>Kayıt Ol</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Rahatlama ve Yenilenme İçin
            <span className="text-rose-600"> Online Randevu</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Orient SPA ile kolayca randevu alın. Profesyonel ekibimiz ve geniş
            hizmet yelpazemizle sizleri bekliyoruz.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Randevu Al
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Giriş Yap
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-8 mt-20">
          <div className="text-center p-6 rounded-xl bg-white shadow-sm">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Kolay Randevu</h3>
            <p className="text-gray-600">
              7/24 online randevu sistemi ile istediğiniz zaman randevu alın.
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-white shadow-sm">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Esnek Saatler</h3>
            <p className="text-gray-600">
              Geniş çalışma saatleri ile size uygun zamanı seçin.
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-white shadow-sm">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Uzman Kadro</h3>
            <p className="text-gray-600">
              Alanında uzman terapistlerimizle kaliteli hizmet.
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-white shadow-sm">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Premium Hizmet</h3>
            <p className="text-gray-600">
              En kaliteli ürünler ve konforlu ortam.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <div className="text-center text-gray-600">
          <p>&copy; 2024 Orient SPA. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  )
}
