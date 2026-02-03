import * as fs from 'fs';

// Otel OLMAYAN yerleri tespit etmek için blacklist
const BLACKLIST_KEYWORDS = [
  // Yeme-içme
  'restoran', 'restaurant', 'cafe', 'kafe', 'kahve', 'bistro', 'bar', 'pub', 'disco', 'gece klubü',
  // Su sporları / Plaj
  'water sport', 'watersport', 'dalış', 'diving', 'surf', 'jet ski',
  // Konut / Emlak
  'lojman', 'rezidans', 'residence', 'emlak', 'real estate', 'construction', 'inşaat', 'kiralık',
  // Market / Alışveriş
  'market', 'süpermarket', 'supermarket', 'mağaza', 'shop', 'mall',
  // Sağlık / Güzellik
  'kuaför', 'berber', 'güzellik', 'beauty', 'spa center', 'hamam', 'eczane', 'pharmacy', 'hastane', 'hospital', 'klinik',
  // Spor / Eğlence
  'gym', 'spor salonu', 'fitness', 'lunapark', 'aquapark', 'aqua park', 'eğlence',
  // Ulaşım
  'rent a car', 'otopark', 'parking', 'transfer', 'taxi', 'taksi', 'havalimanı', 'airport',
  // Eğitim / Dini
  'okul', 'school', 'üniversite', 'yurt', 'öğrenci', 'mosque', 'cami', 'kilise', 'church',
  // Finans
  'döviz', 'exchange', 'banka', 'bank', 'atm',
  // Diğer
  'plaj', 'beach club', 'sahil', 'deniz kum', 'tatil evleri', 'bungalow evleri',
];

// Sadece bu kelimeleri içeriyorsa (otel kelimesi yoksa) eleme
const STANDALONE_BLACKLIST = [
  'lunapark', 'aquapark', 'plajı', 'plaj', 'market', 'lojman', 'construction', 'inşaat',
  'water sports', 'watersports', 'diving', 'dalış', 'öğrenci yurdu', 'sunday market'
];

// Otel olduğunu gösteren whitelist
const WHITELIST_KEYWORDS = [
  'hotel', 'otel', 'apart', 'resort', 'motel', 'hostel', 'pansiyon', 'butik otel', 'boutique'
];

function isHotel(name: string): boolean {
  const lowerName = name.toLowerCase();

  // Önce kesin otel olmayanları ele
  for (const keyword of STANDALONE_BLACKLIST) {
    if (lowerName.includes(keyword) && !WHITELIST_KEYWORDS.some(w => lowerName.includes(w))) {
      return false;
    }
  }

  // Otel kelimesi varsa ve sadece lojman/residence değilse kabul et
  const hasHotelKeyword = WHITELIST_KEYWORDS.some(w => lowerName.includes(w));

  if (hasHotelKeyword) {
    // Sadece lojman veya construction ise reddet
    if (lowerName.includes('lojman') && !lowerName.includes('hotel') && !lowerName.includes('otel')) {
      return false;
    }
    if (lowerName.includes('construction') || lowerName.includes('inşaat')) {
      return false;
    }
    return true;
  }

  // Otel kelimesi yoksa ve blacklist'te varsa reddet
  for (const keyword of BLACKLIST_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return false;
    }
  }

  // Club ile başlayıp hotel/otel içermeyenler
  if (lowerName.startsWith('club ') && !lowerName.includes('hotel') && !lowerName.includes('otel')) {
    return false;
  }

  return true;
}

// JSON verisini oku
const content = fs.readFileSync(
  '/Users/harunsivasli/.claude/projects/-Users-harunsivasli-orient/f8aa5a36-9b34-45b2-b611-971a5489cfee/tool-results/toolu_vrtx_01YJpGv3XJRBVDcQGMj9ZKA3.txt',
  'utf-8'
);

// JSON array'i bul ve parse et - satır 636'dan sonra başlıyor
const lines = content.split('\n');
const jsonStartIndex = lines.findIndex(line => line.includes('Found') && line.includes('hotels:'));
if (jsonStartIndex === -1) {
  console.error('JSON başlangıcı bulunamadı!');
  process.exit(1);
}

// JSON kısmını al (Found X hotels: satırından sonra)
const jsonPart = lines.slice(jsonStartIndex + 2).join('\n');
const jsonEndIndex = jsonPart.lastIndexOf(']');
const jsonStr = jsonPart.substring(0, jsonEndIndex + 1);

let hotels;
try {
  hotels = JSON.parse(jsonStr);
} catch (e) {
  console.error('JSON parse hatası:', e);
  process.exit(1);
}
console.log(`Toplam ${hotels.length} kayıt bulundu.\n`);

// Filtrele
const filteredHotels = hotels.filter((h: any) => isHotel(h.name || ''));
const removedHotels = hotels.filter((h: any) => !isHotel(h.name || ''));

console.log(`✅ ${filteredHotels.length} otel kaldı`);
console.log(`❌ ${removedHotels.length} kayıt elendi\n`);

console.log('=== ELENEN KAYITLAR (ilk 30) ===\n');
removedHotels.slice(0, 30).forEach((h: any, i: number) => {
  console.log(`${i + 1}. ${h.name}`);
});

console.log('\n=== KALAN OTELLER (ilk 30) ===\n');
filteredHotels.slice(0, 30).forEach((h: any, i: number) => {
  console.log(`${i + 1}. ${h.name}`);
});

// Filtrelenmiş veriyi kaydet
fs.writeFileSync(
  '/Users/harunsivasli/orient/scripts/hotels-filtered.json',
  JSON.stringify(filteredHotels, null, 2)
);

console.log('\n✅ Filtrelenmiş veriler hotels-filtered.json dosyasına kaydedildi.');
