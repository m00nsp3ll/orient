# Transfer Workflow İyileştirmeleri - 2025-02-04

## Yapılan Değişiklikler

### 1. Appointments Sayfası Hataları Düzeltildi

**Sorun:** useEffect import hatası ve infinite render loop
**Dosya:** `src/components/calendar/weekly-calendar.tsx`

```typescript
// useEffect import eklendi
import { useMemo, useState, useEffect } from "react"

// Infinite loop düzeltildi - onWeekChange dependency array'den çıkarıldı
useEffect(() => {
  onWeekChange?.(weekStart, weekEnd)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [weekStart.getTime(), weekEnd.getTime()])
```

### 2. Transfer Bekliyor Kolonunda Şöför Seçimi İyileştirildi

**Problem:** Şöför seçildiği anda üst bara geçiyordu, "Bırakmaya Gönder" butonu çalışmıyordu.

**Çözüm:** `arrivalTime` field'ı kullanılarak workflow düzeltildi.

#### 2.1 IN_SERVICE → DROPPING_OFF Geçişi
**Dosya:** `src/app/(dashboard)/dashboard/operations/page.tsx`

```typescript
const handleStatusChange = async (transferId: string, newStatus: string) => {
  // IN_SERVICE -> DROPPING_OFF geçişinde şoför ve arrivalTime temizlenir
  const body: { status: string; driverId?: null; arrivalTime?: null } = { status: newStatus }

  const currentTransfer = transfers.find(t => t.id === transferId)
  if (currentTransfer?.status === "IN_SERVICE" && newStatus === "DROPPING_OFF") {
    body.driverId = null
    body.arrivalTime = null // Bırakış zamanını da temizle
  }
  // ...
}
```

#### 2.2 Bırakmaya Gönder Fonksiyonu
**Dosya:** `src/app/(dashboard)/dashboard/operations/page.tsx`

```typescript
const handleStartDropoff = async (transferId: string) => {
  try {
    const res = await fetch(`/api/transfers/${transferId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrivalTime: new Date() }),
    })

    if (res.ok) {
      const updatedTransfer = await res.json()
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? updatedTransfer : t))
      )
      toast.success("Şoför bırakılışa gönderildi")
    }
  } catch (error) {
    toast.error("İşlem başarısız")
  }
}
```

#### 2.3 TransferCard Güncellemesi
**Dosya:** `src/app/(dashboard)/dashboard/operations/components/transfer-card.tsx`

```typescript
const handleStatusChange = () => {
  // DROPPING_OFF durumunda "Bırakmaya Gönder" butonu onStartDropoff çağırır
  if (transfer.status === "DROPPING_OFF" && onStartDropoff) {
    if (!transfer.driverId) {
      toast.error("Lütfen önce şoför seçin!")
      return
    }
    onStartDropoff(transfer.id)
    return
  }
  // ...
}
```

#### 2.4 ActiveDriversBar Filtresi
**Dosya:** `src/app/(dashboard)/dashboard/operations/components/active-drivers-bar.tsx`

```typescript
// Yolda olan şoförleri bul - DROPPING_OFF için arrivalTime gerekli
const driverTransfers = transfers.filter(
  (t) =>
    t.driverId === driver.id &&
    (t.status === "PICKING_UP" ||
     (t.status === "DROPPING_OFF" && t.arrivalTime !== null))
)
```

#### 2.5 Transfer Bekliyor Kolonu Filtresi
**Dosya:** `src/app/(dashboard)/dashboard/operations/components/transfer-board.tsx`

```typescript
const getTransfersByStatus = (status: string) => {
  const filtered = transfers.filter((t) => t.status === status)

  // Transfer Bekliyor kolonunda şoför atanmamış VEYA bırakılışa gönderilmemiş olanları göster
  if (status === "DROPPING_OFF") {
    return filtered.filter((t) => !t.driverId || !t.arrivalTime)
  }

  return filtered
}
```

### 3. Demo Data Yükleme Özelliği

#### 3.1 API Endpoint
**Dosya:** `src/app/api/demo/reset-operations/route.ts` (YENİ)

```typescript
export async function POST(request: Request) {
  // 1. Seçili günün transferlerini sil
  // 2. Seçili günün randevularını sil
  // 3. Demo acentalar oluştur
  // 4. 14 demo operasyon kaydı oluştur
  //    - 5 PENDING
  //    - 2 AT_SPA
  //    - 2 IN_SERVICE
  //    - 3 DROPPING_OFF (arrivalTime null)
  //    - 2 COMPLETED
}
```

**ÖNEMLİ:** DROPPING_OFF transferleri artık `arrivalTime: null` ile oluşturuluyor.

```typescript
arrivalTime: ["IN_SERVICE", "COMPLETED"].includes(customer.status) ? startTime : null,
```

#### 3.2 Operasyon Sayfasında Demo Data Butonu
**Dosya:** `src/app/(dashboard)/dashboard/operations/page.tsx`

```typescript
// Icon import
import { CalendarIcon, RefreshCw, Database } from "lucide-react"

// Buton
<Button
  variant="outline"
  onClick={handleLoadDemoData}
  disabled={loading}
  className="gap-2"
>
  <Database className="h-4 w-4" />
  Demo Data Yükle
</Button>
```

## Yeni Transfer Workflow

1. **Hizmeti Bitir** (IN_SERVICE → DROPPING_OFF)
   - Şoför temizlenir (`driverId: null`)
   - Bırakış zamanı temizlenir (`arrivalTime: null`)
   - Transfer "Transfer Bekliyor" kolonuna düşer

2. **Şöför Seç** (Transfer Bekliyor'da)
   - Şoför seçilir
   - Transfer hala kolonunda kalır
   - **Üst bara GİTMEZ**

3. **Bırakmaya Gönder** Butonuna Bas
   - `arrivalTime` set edilir
   - Transfer "Transfer Bekliyor" kolonundan kaybolur
   - **Üst barda "Müşteri Bırakıyor" (turuncu) olarak görünür**

4. **Bırakıldı** (Üst bardaki popover'dan)
   - Transfer COMPLETED durumuna geçer
   - Tamamlananlara eklenir

## TypeScript Type Updates

### Transfer Interface
**Dosyalar:**
- `src/app/(dashboard)/dashboard/operations/page.tsx`
- `src/app/(dashboard)/dashboard/operations/components/transfer-board.tsx`

```typescript
interface Transfer {
  id: string
  status: string
  driverId: string | null
  arrivalTime: string | null
  dropoffTime: string | null  // Eklendi
  appointment: {
    // ...
    hotel: {
      // ...
      address: string | null  // Eklendi
      lat: number | null      // Eklendi
      lng: number | null      // Eklendi
    } | null
    agency: {               // Eklendi
      id: string
      name: string
      code: string
    } | null
  }
  // ...
}
```

## Test Adımları

1. **Demo Data Yükle** butonuna bas
2. "Hizmetti" kolonunda bir kart seç
3. **"Hizmeti Bitir"** butonuna bas → Kart "Transfer Bekliyor"a düşer
4. **Şöför seç** → Üst bara GİTMEZ, kolonunda kalır
5. **"Bırakmaya Gönder"** butonuna bas → Kart kaybolur, üst barda görünür
6. Üst bardaki şoför kartından **"✓ Bırakıldı"** → Tamamlananlara gider

## Önemli Notlar

- Demo data her yüklendiğinde o günün TÜM operasyonlarını siler
- DROPPING_OFF transferleri artık `arrivalTime: null` ile başlıyor
- Üst barda görünmek için `arrivalTime !== null` şartı gerekli
- "Bırakmaya Gönder" butonu yeni `onStartDropoff` prop'unu kullanıyor
