# Orient SPA - Acenta Onay Sistemi Implementasyonu
**Tarih:** 2026-02-05

## Tamamlanan İşler

### 1. Acenta Onay Sistemi (Approval Workflow)

#### Approval Status Field
- Prisma schema'ya `approvalStatus` field eklendi
- Değerler: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`
- Acentalar randevu oluşturduğunda otomatik `PENDING_APPROVAL` olarak işaretlenir

#### Admin Onay/Reddetme API
- **Endpoint:** `/api/appointments/[id]/approve`
- Next.js 16+ params Promise issue düzeltildi
- Admin ve Staff yetkili
- `action: "approve" | "reject"` parametresi

#### Onay Bekleyen Rezervasyonlar Component
- **Dosya:** `/src/components/admin/pending-approvals.tsx`
- Rol bazlı görünüm:
  - **Admin:** Acenta kolonu + Onayla/Reddet butonları görür
  - **Acenta:** Sadece kendi rezervasyonlarını görür, buton yok
- 10 saniyelik otomatik yenileme
- Onay dialogu (rezervasyon detaylarıyla)

#### Dashboard Entegrasyonu
- Hem admin hem acenta dashboard'ında "Onay Bekleyen Rezervasyonlar" kartı
- Appointments sayfasından onay bekleyen kartı kaldırıldı
- Acenta panelinde acenta ismi kolonu gizlendi

### 2. Filtre Mantığı Düzeltmeleri

#### Acenta Takvimi
- Acentalar sadece **APPROVED** rezervasyonları takvimde görür
- Pending rezervasyonlar dashboard'da görünür, takvimde görünmez
- Admin onayladıktan sonra otomatik takvime düşer

#### API Filtreleme
- **Dosya:** `/src/app/api/appointments/route.ts`
- Acenta role: Varsayılan olarak `approvalStatus = "APPROVED"` filtresi
- `?approvalStatus=PENDING_APPROVAL` parametresiyle pending'leri çekebilir

### 3. Dashboard Metrikleri Düzeltmeleri

#### "Bekleyen" Kartı
- **Önce:** `status: "PENDING"` sayıyordu (hatalı)
- **Şimdi:** `approvalStatus: "PENDING_APPROVAL"` sayıyor
- Onay bekleyen rezervasyon sayısını gösterir

#### "Bugün Tamamlanan" Kartı
- **Önce:** Appointment.status = "COMPLETED" sayıyordu
- **Şimdi:** Appointment.status = "COMPLETED" sayıyor
- Transfer COMPLETED olduğunda appointment otomatik COMPLETED yapılıyor

#### "Toplam PAX" Kartı
- **Önce:** "Toplam Müşteri" idi
- **Şimdi:** "Bugünkü Toplam PAX"
- Prisma aggregate ile pax toplamı hesaplanıyor

### 4. Transfer ve Appointment Senkronizasyonu

#### Transfer Completion
- **Dosya:** `/src/app/api/transfers/[id]/route.ts`
- Transfer `COMPLETED` olduğunda:
  ```typescript
  await prisma.appointment.update({
    where: { id: transfer.appointmentId },
    data: { status: "COMPLETED" },
  })
  ```

### 5. Demo Data Güncelleme

#### Demo Operations Script
- **Dosya:** `/src/app/api/demo/reset-operations/route.ts`
- Operasyon demo data: 14 kayıt (APPROVED)
- Sunway Travel onay bekleyen: 5 kayıt (PENDING_APPROVAL)
- "Demo Data Yükle" butonu: Toplam 19 kayıt oluşturur

#### Demo Appointments Script
- **Dosya:** `/scripts/create-demo-appointments.ts`
- Mevcut dataları silmeden 5 onay bekleyen rezervasyon ekler
- Sunway Travel acentasından
- Adresi olan otellerden seçer

### 6. Otomatik Yenileme (Query Invalidation)

#### Pending Approvals Component
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["pending-approvals"] })
  queryClient.invalidateQueries({ queryKey: ["appointments"] })
  queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
  queryClient.invalidateQueries({ queryKey: ["appointments", "today"] })
}
```

#### Appointment Form
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["appointments"] })
  queryClient.invalidateQueries({ queryKey: ["pending-appointments"] })
  queryClient.invalidateQueries({ queryKey: ["pending-approvals"] })
  queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
  queryClient.invalidateQueries({ queryKey: ["appointments", "today"] })
}
```

**Sonuç:** Artık F5'e basmadan tüm veriler otomatik güncelleniyor!

## Değiştirilen Dosyalar

### API Endpoints
- `/src/app/api/appointments/[id]/approve/route.ts` - Next.js 16+ params fix + onay/red logic
- `/src/app/api/appointments/route.ts` - Acenta filtreleme
- `/src/app/api/dashboard/stats/route.ts` - Metrik hesaplamaları
- `/src/app/api/transfers/[id]/route.ts` - Transfer completion sync
- `/src/app/api/demo/reset-operations/route.ts` - Demo data 14+5

### Components
- `/src/components/admin/pending-approvals.tsx` - Rol bazlı UI, otomatik yenileme
- `/src/components/forms/appointment-form.tsx` - Query invalidation

### Pages
- `/src/app/(dashboard)/dashboard/page.tsx` - Pending approvals eklendi, metrikler
- `/src/app/(dashboard)/dashboard/appointments/page.tsx` - Pending card kaldırıldı

### Scripts
- `/scripts/create-demo-appointments.ts` - 5 onay bekleyen ekler

### Database
- `prisma/schema.prisma` - approvalStatus field

## Teknik Detaylar

### Next.js 16+ Params Pattern
```typescript
// Eski
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
}

// Yeni
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const id = params.id
}
```

### Prisma Aggregate for PAX
```typescript
const totalPax = await prisma.appointment.aggregate({
  where: {
    startTime: { gte: dayStart, lte: dayEnd },
    status: { not: "CANCELLED" },
  },
  _sum: {
    pax: true,
  },
})

return totalPax._sum.pax || 0
```

## Test Senaryoları

### 1. Acenta Rezervasyon Oluşturma
- Acenta panelinden yeni randevu oluştur
- Otomatik `PENDING_APPROVAL` olarak işaretlenir
- Dashboard'da "Onay Bekleyen" kartında görünür
- Takvimde **görünmez**

### 2. Admin Onaylama
- Admin dashboard'da onay bekleyen rezervasyonları görür
- "Onayla" butonuna tıklar
- F5'e basmadan:
  - "Bekleyen" sayısı azalır
  - "Bugünün Randevuları" sayısı artar
  - Rezervasyon takvimde görünür
  - Transfer kaydı oluşturulur (henüz yok - TODO)

### 3. Demo Data
- Operasyon Paneli → "Demo Data Yükle" butonu
- 14 operasyon kaydı (transferli)
- 5 onay bekleyen rezervasyon (transfersiz)
- Toplam 19 kayıt

## Önemli Notlar

### Approval Workflow
1. Acenta randevu oluşturur → `PENDING_APPROVAL`
2. Admin onaylar → `APPROVED` + transfer oluşturulur
3. Şoför atar → Transfer başlar
4. Transfer completed → Appointment `COMPLETED`

### Query Keys
- `["appointments"]` - Tüm randevular
- `["appointments", "today"]` - Bugünün randevuları
- `["pending-approvals"]` - Onay bekleyen rezervasyonlar
- `["dashboard-stats"]` - Dashboard metrikleri

## TODO - Gelecek Oturum

- [ ] Admin onayladığında otomatik transfer kaydı oluştur
- [ ] Acenta email bildirimi (onaylandı/reddedildi)
- [ ] Toplu onaylama özelliği
- [ ] Reddetme nedeni ekleme
- [ ] Onay geçmişi raporu
