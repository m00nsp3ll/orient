# Orient SPA - Ürün Bağlamı

## Proje Özeti
Orient SPA, Alanya bölgesindeki bir SPA merkezi için geliştirilmiş randevu yönetim sistemidir. Sistem, acentaların otel misafirleri için SPA randevusu oluşturmasına ve yönetmesine olanak tanır.

## Hedef Kullanıcılar

### 1. Admin
- Tüm sistemi yönetir
- Personel, hizmetler, oteller, acentalar ve kotaları düzenler
- Tüm randevuları görüntüler ve yönetir

### 2. Staff (Personel)
- Kendi randevularını görüntüler
- Randevu durumlarını günceller
- Hizmetleri görüntüler

### 3. Agency (Acenta)
- Otel misafirleri için randevu oluşturur
- Kendi oluşturduğu randevuları yönetir
- Otel ve PAX (kişi sayısı) bilgisi girer

### 4. Driver (Şoför)
- Transfer görevlerini görüntüler
- Transfer durumlarını günceller (Yolda, Müşteri Alındı, Teslim Edildi vb.)
- Rota detaylarını ve haritayı görüntüler

### 5. Customer (Müşteri)
- Kendi randevularını görüntüler
- Online randevu talebi oluşturabilir

## Temel Özellikler

### Randevu Yönetimi
- Haftalık takvim görünümü
- Personel bazlı randevu takibi
- Durum yönetimi (Bekliyor, Onaylı, Tamamlandı, İptal)
- Çakışma kontrolü

### Otel & Bölge Yönetimi
- Alanya bölgelerinde otel tanımlaması
- Bölgeler: Alanya Merkez, Konaklı, Mahmutlar, Oba, Kestel, Kargıcak, Tosmur, Cikcilli, Avsallar, Türkler, Okurcalar, Payallar, İncekum
- Admin panelinden otel ekleme/düzenleme/silme

### Acenta Sistemi
- Acenta hesap yönetimi
- Otel seçimi ile randevu oluşturma
- PAX (kişi sayısı) girişi
- Misafir adı ve telefon bilgisi

### Kota Yönetimi
- Saat bazlı randevu kotaları
- Gün ve saat dilimi bazında maksimum randevu limiti

### Hizmet Yönetimi
- Kategori bazlı hizmet tanımlaması
- Süre ve fiyat bilgisi
- Masaj, Cilt Bakımı vb. kategoriler

### Transfer & Rota Yönetimi
- **Transfer Takibi**: Randevulu müşterilerin otelden alınış ve bırakılış süreçleri
- **Rota Optimizasyonu**: Aynı bölgedeki müşterileri en kısa yol ile toplama
- **Akıllı Atama**: Müsaitlik ve konuma göre şoför atama sistemi
- **Konum Doğrulama**: Google Maps entegrasyonu ile otel konumlarını haritadan seçme/doğrulama
- **Operasyon Paneli**: Canlı transfer durumu izleme ve yönetme

## İş Kuralları

1. **Randevu Çakışması**: Aynı personel aynı saatte iki randevu alamaz
2. **Kota Kontrolü**: Belirlenen saat diliminde maksimum randevu sayısı aşılamaz
3. **Acenta Randevuları**: Acentalar sadece kendi oluşturdukları randevuları görebilir
4. **Personel Çalışma Saatleri**: Randevular personel çalışma saatleri içinde oluşturulabilir
