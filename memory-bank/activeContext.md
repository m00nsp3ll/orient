# Orient SPA - Aktif Bağlam

## Son Çalışma Oturumu
**Tarih:** 2026-02-05

## Tamamlanan İşler

### Acenta Onay Sistemi (Approval Workflow)

1. **Approval Status Field**
   - Prisma schema'ya `approvalStatus` eklendi (PENDING_APPROVAL, APPROVED, REJECTED)
   - Acentalar randevu oluşturduğunda otomatik PENDING_APPROVAL

2. **Admin Onay/Reddetme API**
   - `/api/appointments/[id]/approve` endpoint
   - Next.js 16+ params Promise issue düzeltildi
   - Admin ve Staff yetkili

3. **Onay Bekleyen Rezervasyonlar Component**
   - Rol bazlı görünüm (Admin: tüm acentalar, Acenta: sadece kendisi)
   - 10 saniyelik otomatik yenileme
   - Onay dialogu ile detay gösterimi

4. **Dashboard Entegrasyonu**
   - Hem admin hem acenta dashboard'ında görünür
   - Appointments sayfasından kaldırıldı
   - Acenta panelinde acenta ismi kolonu gizli

### Filtre ve Takvim Düzeltmeleri

1. **Acenta Takvimi**
   - Acentalar sadece APPROVED rezervasyonları görür
   - Pending rezervasyonlar takvimde görünmez
   - Admin onayladıktan sonra takvime düşer

2. **API Filtreleme**
   - Acenta için varsayılan: `approvalStatus = "APPROVED"`
   - Parametreyle pending'ler çekilebilir

### Dashboard Metrikleri Düzeltmeleri

1. **"Bekleyen" Kartı**
   - `approvalStatus: "PENDING_APPROVAL"` sayıyor (doğru)

2. **"Bugün Tamamlanan" Kartı**
   - Transfer COMPLETED olduğunda appointment otomatik COMPLETED

3. **"Toplam PAX" Kartı**
   - "Toplam Müşteri" → "Bugünkü Toplam PAX"
   - Prisma aggregate ile toplamı hesaplıyor

### Otomatik Yenileme (Query Invalidation)

1. **Pending Approvals**
   - Onay/Red sonrası tüm queryler invalidate
   - F5'e gerek kalmadı

2. **Appointment Form**
   - Yeni randevu oluşturulunca dashboard otomatik güncelleniyor

### Demo Data Sistemi

1. **Demo Operations**
   - 14 operasyon kaydı (APPROVED - transferli)
   - 5 onay bekleyen rezervasyon (PENDING_APPROVAL)
   - "Demo Data Yükle" butonu toplam 19 kayıt oluşturur

2. **Demo Appointments Script**
   - Mevcut dataları korur
   - 5 onay bekleyen ekler
   - Sunway Travel acentasından

## Önemli Dosyalar

### API Endpoints
- `src/app/api/appointments/[id]/approve/route.ts`
- `src/app/api/appointments/route.ts`
- `src/app/api/dashboard/stats/route.ts`
- `src/app/api/transfers/[id]/route.ts`
- `src/app/api/demo/reset-operations/route.ts`

### Components
- `src/components/admin/pending-approvals.tsx`
- `src/components/forms/appointment-form.tsx`

### Pages
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/dashboard/appointments/page.tsx`

### Scripts
- `scripts/create-demo-appointments.ts`

## Environment Variables
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orient_spa?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyBlA-1EN7u4pfYGIVOnC9Tl-3kX8L2YubQ"
```

## Test Hesapları

| Rol | Email | Şifre |
|-----|-------|-------|
| Admin | admin@orientspa.com | admin123 |
| Şoför | sofor@orientspa.com | driver123 |
| Acenta 1 (Sunway) | ahmet@turizm.com | test123 |
| Acenta 2 | mehmet@suntravel.com | test123 |
| Acenta 3 | ayse@blueholiday.com | test123 |

## Hızlı Erişim

```bash
# Sunucu
npm run dev

# Veritabanı
docker start orient-postgres
npx prisma db push
npx prisma generate

# Demo Data
npx tsx scripts/create-demo-appointments.ts
```

## Sonraki Oturum İçin Yapılacaklar

### Approval System
- [ ] Admin onayladığında otomatik transfer kaydı oluştur
- [ ] Acenta email bildirimi (onaylandı/reddedildi)
- [ ] Toplu onaylama özelliği
- [ ] Reddetme nedeni ekleme

### Rota Sistemi
- [ ] Otellerin adres bilgilerini kontrol et
- [ ] Rota atandığında transfer durumlarını güncelle
- [ ] Rota geçmişi/kayıt sistemi

### Genel
- [ ] Randevu düzenleme özelliği
- [ ] Raporlama dashboard'u
- [ ] Mobil uygulama (daha sonra)
- [ ] Push notification (daha sonra)
