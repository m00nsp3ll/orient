import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
    token: 'apify_api_Iv7tN1NajcTLBuZG5MaX6bbFCcWFsQ4cSh0i',
});

const input = {
    "searchStringsArray": [
        "Hotel",
        "Otel",
        "Apart otel",
        "Apart Hotel",
        "Resort hotel",
        "Butik otel",
        "Boutique hotel",
        "Beach hotel",
        "Spa hotel"
    ],
    "locationQuery": "Alanya, Turkey",
    "maxCrawledPlacesPerSearch": 500,
    "language": "tr",
    "placeMinimumStars": "",
    "skipClosedPlaces": true,
    "scrapePlaceDetailPage": false,
    "maxReviews": 0,
    "maxImages": 0,
    "customGeolocation": {
        "type": "Polygon",
        "coordinates": [
            [
                [31.70, 36.46],  // Batı-Güney (Çenger)
                [32.13, 36.46],  // Doğu-Güney (Kargıcak)
                [32.13, 36.66],  // Doğu-Kuzey
                [31.70, 36.66],  // Batı-Kuzey
                [31.70, 36.46]   // Kapatma (ilk nokta ile aynı)
            ]
        ]
    },
    "zoom": 14,
};

(async () => {
    console.log('Fetching hotels from Google Maps via Apify...');
    console.log('This may take a few minutes...\n');

    const run = await client.actor("nwua9Gu5YrADL7ZDj").call(input);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`Found ${items.length} hotels:\n`);

    const hotels = items.map((item: any) => ({
        name: item.title,
        address: item.address,
        googleMapsUrl: item.url,  // Direkt Google Maps linki
        placeId: item.placeId,
        rating: item.totalScore,
        reviewCount: item.reviewsCount,
        phone: item.phone,
        website: item.website,
        lat: item.location?.lat,
        lng: item.location?.lng,
        category: item.categoryName,
    }));

    // Output as JSON for seeding
    console.log(JSON.stringify(hotels, null, 2));
})();
