import { geocode, geocodeBatch, getCacheStats } from './server_modules/geocodingService.js';
import { db } from './database/initDb.js';

console.log('🧪 Testing Geocoding Service\n');
console.log('='.repeat(50));

// Show initial cache stats
console.log('\n📊 Initial Cache Statistics:');
const initialStats = getCacheStats();
console.log(`   Total entries: ${initialStats.total}`);
Object.entries(initialStats.byType).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
});

console.log('\n' + '='.repeat(50));
console.log('\n🔍 Test 1: Geocode coordinates that should be in cache\n');

// Test with coordinates from your original 2000 items
await geocode(-62.93, 75.72);  // Indian Ocean
await geocode(68.4, 81.87);    // Russia
await geocode(47.8, -172.85);  // unknown

console.log('\n' + '='.repeat(50));
console.log('\n🔍 Test 2: Geocode NEW coordinates (will make API calls)\n');
console.log('⚠️  This will make actual API calls - please wait...\n');

// Test with new coordinates (not in cache)
await geocode(40.71, -74.01);   // New York, USA
await geocode(-33.87, 151.21);  // Sydney, Australia

console.log('\n' + '='.repeat(50));
console.log('\n🔍 Test 3: Batch geocoding (mix of cached and new)\n');

const testCoords = [
    { lat: -62.93, lon: 75.72 },   // Cached - Indian Ocean
    { lat: 68.4, lon: 81.87 },     // Cached - Russia
    { lat: 51.51, lon: -0.13 },    // New - London, UK
    { lat: 35.68, lon: 139.65 }    // New - Tokyo, Japan
];

const batchResults = await geocodeBatch(testCoords);

console.log('Batch Results:');
for (const [key, location] of batchResults) {
    const type = Object.keys(location)[0];
    const name = location[type];
    console.log(`   ${key} → ${type}: ${name}`);
}

console.log('\n' + '='.repeat(50));
console.log('\n📊 Final Cache Statistics:');
const finalStats = getCacheStats();
console.log(`   Total entries: ${finalStats.total}`);
Object.entries(finalStats.byType).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
});
console.log(`\n   New entries added: ${finalStats.total - initialStats.total}`);

console.log('\n' + '='.repeat(50));
console.log('\n✅ All tests complete!\n');

// Close database connection
db.close();