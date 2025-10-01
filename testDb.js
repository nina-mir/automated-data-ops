import { db } from './database/initDb.js';

/**
 * Test query to check if coordinates exist in cache
 */
function testLookup(lat, lon) {
    const query = db.prepare(`
        SELECT location_type, location_name, created_at 
        FROM geocache 
        WHERE lat = ? AND lon = ?
    `);
    
    const result = query.get(lat, lon);
    
    if (result) {
        console.log(`✓ Found: ${lat}, ${lon}`);
        console.log(`  Type: ${result.location_type}`);
        console.log(`  Name: ${result.location_name}`);
        console.log(`  Cached: ${result.created_at}\n`);
    } else {
        console.log(`✗ Not found: ${lat}, ${lon}\n`);
    }
    
    return result;
}

/**
 * Test insert of new coordinate
 */
function testInsert(lat, lon, type, name) {
    const insert = db.prepare(`
        INSERT OR IGNORE INTO geocache (lat, lon, location_type, location_name)
        VALUES (?, ?, ?, ?)
    `);
    
    const result = insert.run(lat, lon, type, name);
    
    if (result.changes > 0) {
        console.log(`✓ Inserted: ${lat}, ${lon} - ${type}: ${name}\n`);
    } else {
        console.log(`⚠ Already exists: ${lat}, ${lon}\n`);
    }
}

// Run some tests
console.log('🧪 Testing database operations...\n');

// Test with coordinates that should exist from your 2000 items
testLookup(-62.93, 75.72);  // Should find Indian Ocean
testLookup(68.4, 81.87);    // Should find Russia
testLookup(47.8, -172.85);  // Should find unknown

// Test with new coordinate (won't exist)
testLookup(40.71, -74.01);  // New York - won't be in cache

// Test insert
testInsert(40.71, -74.01, 'country', 'United States');

// Verify it was inserted
testLookup(40.71, -74.01);

console.log('✅ Tests complete!');

db.close();