import { db } from '../database/initDb.js';

// Prepared statements for performance
const lookupStmt = db.prepare(`
    SELECT location_type, location_name 
    FROM geocache 
    WHERE lat = ? AND lon = ?
`);

const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO geocache (lat, lon, location_type, location_name)
    VALUES (?, ?, ?, ?)
`);

/**
 * Fetches water body name from GeoNames API
 */
async function getWaterBodyName(lat, lon) {
    const username = 'ninamirf';
    const url = `http://api.geonames.org/extendedFindNearbyJSON?lat=${lat}&lng=${lon}&username=${username}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data) {
            const keys = Object.keys(data);
            const geoItem = keys[0];
            
            if (data[keys[0]]?.name) {
                return {
                    [geoItem]: data[keys[0]].name
                };
            }
        }
    } catch (error) {
        console.error(`GeoNames API error for ${lat}, ${lon}:`, error.message);
    }
    
    return { 'unknown': 'unknown' };
}

/**
 * Identifies coordinates using Nominatim (OpenStreetMap) with GeoNames fallback
 */
async function identifyCoordinates(latitude, longitude) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=1&addressdetails=1`;

    try {
        const response = await fetch(nominatimUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'jobApp2WindBorneSystem/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.address && data.address.country) {
            return {
                'country': data.address.country
            };
        } else {
            // Not a country, try to identify water body
            const response = await getWaterBodyName(latitude, longitude);
            return response;
        }
    } catch (error) {
        console.error(`Nominatim API error for ${latitude}, ${longitude}:`, error.message);
        return { 'unknown': 'unknown' };
    }
}

/**
 * Main geocoding function with SQLite cache
 * Returns: { "country": "Brazil" } or { "ocean": "Atlantic" } or { "unknown": "unknown" }
 */
export async function geocode(lat, lon) {
    // Step 1: Check SQLite cache
    const cached = lookupStmt.get(lat, lon);
    
    if (cached) {
        console.log(`[CACHE HIT] ${lat}, ${lon} → ${cached.location_type}: ${cached.location_name}`);
        return {
            [cached.location_type]: cached.location_name
        };
    }
    
    // Step 2: Not in cache, make API call
    console.log(`[CACHE MISS] ${lat}, ${lon} - calling API...`);
    
    const result = await identifyCoordinates(lat, lon);
    
    // Step 3: Save to SQLite for future use
    const locationType = Object.keys(result)[0];
    const locationName = result[locationType];
    
    insertStmt.run(lat, lon, locationType, locationName);
    console.log(`[SAVED] ${lat}, ${lon} → ${locationType}: ${locationName}`);
    
    return result;
}

/**
 * Batch geocode multiple coordinates with rate limiting
 * @param {Array<{lat: number, lon: number}>} coordinates - Array of coordinate objects
 * @param {number} delayMs - Delay between API calls in milliseconds (default 1200)
 * @returns {Promise<Map>} Map of "lat,lon" -> location object
 */
export async function geocodeBatch(coordinates, delayMs = 1200) {
    const results = new Map();
    let apiCallsMade = 0;
    
    console.log(`\n📍 Starting batch geocoding of ${coordinates.length} coordinates...`);
    
    for (const coord of coordinates) {
        const key = `${coord.lat},${coord.lon}`;
        
        const result = await geocode(coord.lat, coord.lon);
        results.set(key, result);
        
        // Only delay if we actually made an API call (cache miss)
        const cached = lookupStmt.get(coord.lat, coord.lon);
        if (!cached || apiCallsMade === 0) {
            apiCallsMade++;
            // Add delay before next iteration to respect rate limits
            if (coordinates.indexOf(coord) < coordinates.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    
    console.log(`\n✅ Batch complete: ${apiCallsMade} API calls made, ${coordinates.length - apiCallsMade} from cache\n`);
    
    return results;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    const stats = db.prepare('SELECT COUNT(*) as total FROM geocache').get();
    const byType = db.prepare(`
        SELECT location_type, COUNT(*) as count 
        FROM geocache 
        GROUP BY location_type
    `).all();
    
    return {
        total: stats.total,
        byType: byType.reduce((acc, row) => {
            acc[row.location_type] = row.count;
            return acc;
        }, {})
    };
}