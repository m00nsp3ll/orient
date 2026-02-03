// Alanya bölgeleri - adresten tespit için
const regionKeywords = [
  { name: "Okurcalar", keywords: ["okurcalar", "incekum"] },
  { name: "Avsallar", keywords: ["avsallar"] },
  { name: "Türkler", keywords: ["türkler", "turkler"] },
  { name: "Konaklı", keywords: ["konaklı", "konakli"] },
  { name: "Oba", keywords: ["oba"] },
  { name: "Tosmur", keywords: ["tosmur"] },
  { name: "Cikcilli", keywords: ["cikcilli"] },
  { name: "Kestel", keywords: ["kestel"] },
  { name: "Mahmutlar", keywords: ["mahmutlar"] },
  { name: "Kargıcak", keywords: ["kargıcak", "kargicak"] },
  { name: "Alanya Merkez", keywords: ["alanya", "çarşı", "carsi", "saray", "güllerpınarı", "hacet", "kadıpaşa", "kızlar pınarı", "dinek", "cumhuriyet"] },
];

// Hedef konum (verilen Google Maps linki)
const targetLocation = {
  lat: 36.5513889,
  lng: 31.9963889
};

// Haversine formülü ile iki nokta arası mesafe (km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Adresten bölgeyi tespit et
function determineRegionFromAddress(address: string): string {
  if (!address) return "Bilinmiyor";

  const lowerAddress = address.toLowerCase();

  // Önce spesifik bölgeleri kontrol et (Alanya Merkez en son)
  for (const region of regionKeywords) {
    if (region.name === "Alanya Merkez") continue; // Alanya Merkez'i en son kontrol et
    for (const keyword of region.keywords) {
      if (lowerAddress.includes(keyword)) {
        return region.name;
      }
    }
  }

  // Hiçbir spesifik bölge bulunamadıysa ve Alanya içeriyorsa
  if (lowerAddress.includes("alanya")) {
    return "Alanya Merkez";
  }

  return "Bilinmiyor";
}

// JSON kısmını parse et
import * as fs from 'fs';
const content = fs.readFileSync('/Users/harunsivasli/.claude/projects/-Users-harunsivasli-orient/f8aa5a36-9b34-45b2-b611-971a5489cfee/tool-results/toolu_vrtx_01NDzbeNfNa1unyQmJqLV8Wo.txt', 'utf-8');

// JSON array'i bul ve parse et
const jsonMatch = content.match(/Found \d+ hotels:\n\n(\[[\s\S]*\])\nnpm warn/);
if (!jsonMatch) {
  console.error('JSON verisi bulunamadı!');
  process.exit(1);
}

const hotels = JSON.parse(jsonMatch[1]);

console.log(`Toplam ${hotels.length} otel işleniyor...\n`);

// Otelleri işle
const processedHotels = hotels
  .filter((hotel: any) => hotel.lat && hotel.lng) // Koordinatı olmayanları filtrele
  .map((hotel: any) => {
    const region = determineRegionFromAddress(hotel.address);
    const distance = calculateDistance(
      targetLocation.lat,
      targetLocation.lng,
      hotel.lat,
      hotel.lng
    );

    return {
      name: hotel.name,
      region: region,
      distance: Math.round(distance * 10) / 10, // 1 ondalık basamak
      address: hotel.address,
      rating: hotel.rating,
      reviewCount: hotel.reviewCount,
      phone: hotel.phone,
      website: hotel.website,
      lat: hotel.lat,
      lng: hotel.lng
    };
  })
  .sort((a: any, b: any) => a.distance - b.distance); // Uzaklığa göre sırala

// Bölgelere göre grupla ve say
const regionCounts: { [key: string]: number } = {};
processedHotels.forEach((hotel: any) => {
  regionCounts[hotel.region] = (regionCounts[hotel.region] || 0) + 1;
});

console.log('=== BÖLGELERE GÖRE OTEL SAYILARI ===\n');
const regionOrder = ["Okurcalar", "Avsallar", "Türkler", "Konaklı", "Oba", "Alanya Merkez", "Cikcilli", "Tosmur", "Kestel", "Mahmutlar", "Kargıcak", "Bilinmiyor"];
Object.entries(regionCounts)
  .sort((a, b) => {
    return regionOrder.indexOf(a[0]) - regionOrder.indexOf(b[0]);
  })
  .forEach(([region, count]) => {
    console.log(`${region}: ${count} otel`);
  });

console.log(`\nToplam: ${processedHotels.length} otel\n`);

// JSON dosyasına kaydet
fs.writeFileSync(
  '/Users/harunsivasli/orient/scripts/hotels-processed.json',
  JSON.stringify(processedHotels, null, 2)
);

console.log('=== İLK 20 OTEL (En Yakın) ===\n');
processedHotels.slice(0, 20).forEach((hotel: any, index: number) => {
  console.log(`${index + 1}. ${hotel.name}`);
  console.log(`   Bölge: ${hotel.region} | Uzaklık: ${hotel.distance} km`);
  console.log('');
});

console.log('\nVeriler hotels-processed.json dosyasına kaydedildi.');
