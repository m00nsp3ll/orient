# Orient SPA - Teknik Bağlam

## Teknoloji Stack

### Frontend
- **Next.js 16.1.6** - App Router ile React framework
- **TypeScript** - Tip güvenliği
- **Tailwind CSS v4** - Utility-first CSS
- **Radix UI** - Accessible UI primitives
- **Lucide React** - İkon kütüphanesi
- **TanStack React Query** - Server state yönetimi
- **React Hook Form + Zod** - Form yönetimi ve validasyon
- **Sonner** - Toast bildirimleri
- **date-fns** - Tarih işlemleri

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Veritabanı erişimi
- **PostgreSQL** - Veritabanı (Docker container)
- **NextAuth.js v4** - Authentication
- **bcryptjs** - Şifre hashleme

### 3. Harita & Konum
- **Google Maps JavaScript API** - Harita görüntüleme ve etkileşim
- **Google Maps Geocoding API** - Adres/Koordinat dönüşümü
- **Google Maps Directions API** - Rota çizimi ve mesafe/süre hesaplama
- **Haversine Formülü** - Mesafe bazlı sıralama ve optimizasyon

## Proje Yapısı

```
orient/
├── prisma/
│   ├── schema.prisma      # Veritabanı şeması
│   └── seed.ts            # Test verileri
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login/Register sayfaları
│   │   ├── (dashboard)/   # Dashboard sayfaları
│   │   └── api/           # API routes
│   ├── components/
│   │   ├── ui/            # Shadcn UI bileşenleri
│   │   ├── forms/         # Form bileşenleri
│   │   ├── calendar/      # Takvim bileşenleri
│   │   ├── maps/          # Harita ve konum bileşenleri
│   │   └── layout/        # Layout bileşenleri
│   ├── lib/
│   │   ├── auth.ts        # NextAuth yapılandırması
│   │   ├── prisma.ts      # Prisma client
│   │   └── utils.ts       # Utility fonksiyonları
│   └── middleware.ts      # Route koruması
└── memory-bank/           # Proje dokümantasyonu
```

## Veritabanı Modelleri

- **User** - Kullanıcı hesapları (Admin, Staff, Agency, Customer)
- **Staff** - Personel detayları
- **Agency** - Acenta detayları
- **Service** - SPA hizmetleri
- **ServiceCategory** - Hizmet kategorileri
- **Appointment** - Randevular
- **Transfer** - Transfer kayıtları
- **Driver** - Şoför detayları
- **Hotel** - Oteller
- **Region** - Bölgeler
- **TimeSlotQuota** - Saat kotaları
- **WorkingHours** - Personel çalışma saatleri

## Test Hesapları

| Rol | Email | Şifre |
|-----|-------|-------|
| Admin | admin@orientspa.com | admin123 |
| Staff | ayse@orientspa.com | staff123 |
| Agency | acenta@example.com | agency123 |
| Customer | musteri@example.com | customer123 |

## Komutlar

```bash
npm run dev                 # Geliştirme sunucusu
npx prisma db push          # Şema senkronizasyonu
npx prisma generate         # Client oluşturma
npx tsx prisma/seed.ts      # Test verileri
docker start orient-postgres # PostgreSQL başlat
```
