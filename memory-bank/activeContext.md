# Orient SPA - Aktif Bağlam

## Son Çalışma Oturumu
**Tarih:** 2026-02-04

## Tamamlanan İşler

### Operasyon Paneli - Rota Planlama Sistemi
1. **Rota Oluşturma Modal**
   - Tam ekran modal (98vw x 95vh)
   - Sol panel: Mevcut transferler listesi
   - Sağ panel: Rota sırası (drag-drop ile sıralama)
   - Bölge/Saat sıralama toggle butonları

2. **Rota Optimizasyonu**
   - "Konuma Göre Sırala" butonu
   - Haversine mesafe formülü ile en yakın komşu algoritması
   - Orient SPA'dan başlayarak en yakın noktaları sıralar

3. **Google Maps Entegrasyonu**
   - Leaflet yerine Google Maps kullanımı
   - Otel adreslerinden Geocoding ile koordinat çözümleme
   - Gerçek yol rotaları (Directions API)
   - Özel markerlar: Yeşil "S" (SPA), Mavi numaralı duraklar
   - Rota bilgisi kutusu: durak sayısı, mesafe, süre

4. **Rota Atama Onay Dialogu**
   - "Rotayı Ata" butonunda onay penceresi
   - Şoför, durak sayısı, toplam kişi bilgisi
   - Harita önizlemesi
   - Durak listesi badge'leri

5. **Konum Seçici (Location Picker)**
   - Otel düzenleme/ekleme formlarında harita entegrasyonu
   - Koordinatı olmayan oteller için manuel konum işaretleme
   - Sürükle-bırak marker ile hassas konum belirleme
   - Uydu ve sokak görünümü desteği

### Operasyon Paneli - Workflow İyileştirmeleri
1. **Kolon İsimleri Güncellendi**
   - AT_SPA → "Müşteri Bekliyor"
   - DROPPING_OFF → "Transfer Bekliyor"

2. **Şoför Atama Kuralları**
   - PENDING: Şoför atanabilir
   - PICKING_UP: Şoför değiştirilemez (gösterilir)
   - DROPPING_OFF: Aynı şoför birden fazla transfere atanabilir

3. **REST Ödeme Uyarısı**
   - IN_SERVICE ve DROPPING_OFF durumlarında uyarı dialogu
   - "Ödeme Alındı, Devam Et" onay butonu

4. **Bölge/Şoför Gruplama**
   - PENDING ve DROPPING_OFF: Bölgeye göre gruplama
   - PICKING_UP: Şoföre göre gruplama

5. **Boşta Olan Şoförler Barı**
   - Yolda olanlar (mavi/turuncu) ve boşta olanlar (yeşil)
   - Kompakt yan yana görünüm

### Randevu Formu Düzeltmeleri
- DatePicker timezone sorunu çözüldü
- Bugünün tarihi seçildiğinde geçmiş saatler disabled
- Tüm saatler gösteriliyor (müsait olmayanlar disabled)

### OneSignal Devre Dışı
- Push notification şimdilik kapatıldı
- Mobil uygulama daha sonra yapılacak

### Google Maps API
- API Key eklendi: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Geocoding API aktif
- Directions API aktif

## Önemli Dosyalar

### Rota Planlama
- `src/app/(dashboard)/dashboard/operations/components/route-planner-modal.tsx`
- `src/app/(dashboard)/dashboard/operations/components/route-map-preview.tsx`

### Operasyon Paneli
- `src/app/(dashboard)/dashboard/operations/page.tsx`
- `src/app/(dashboard)/dashboard/operations/components/active-drivers-bar.tsx`
- `src/app/(dashboard)/dashboard/operations/components/transfer-card.tsx`
- `src/app/(dashboard)/dashboard/operations/components/transfer-board.tsx`
- `src/app/(dashboard)/dashboard/operations/components/driver-selector.tsx`

### API
- `src/app/api/availability/route.ts` (timezone fix)

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
| Acenta 1 | ahmet@turizm.com | test123 |
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
```

## Sonraki Oturum İçin Yapılacaklar

### Rota Sistemi
- [ ] Otellerin adres bilgilerini kontrol et (bazıları eksik olabilir)
- [ ] Rota atandığında transfer durumlarını güncelle
- [ ] Rota geçmişi/kayıt sistemi

### Genel
- [ ] Randevu düzenleme özelliği
- [ ] Raporlama dashboard'u
- [ ] Mobil uygulama (daha sonra)
- [ ] Push notification (daha sonra)
