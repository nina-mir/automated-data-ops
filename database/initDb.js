import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_DIR = path.join(process.cwd(), 'database');
const DB_PATH = path.join(DB_DIR, 'geocache.db');
const STARTING_CACHE_PATH = path.join(process.cwd(), 'startingAPIinfo.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

/**
 * Creates the geocache table if it doesn't exist
 */
function createTable() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS geocache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            location_type TEXT NOT NULL,
            location_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lat, lon)
        )
    `;
    
    db.exec(createTableSQL);
    
    // Create index for faster lookups
    db.exec('CREATE INDEX IF NOT EXISTS idx_lat_lon ON geocache(lat, lon)');
    
    console.log('✓ Database table created/verified');
}

/**
 * Migrates data from startingAPIinfo.json into SQLite
 */
function migrateStartingData() {
    // Check if starting cache file exists
    if (!fs.existsSync(STARTING_CACHE_PATH)) {
        console.log('⚠ No startingAPIinfo.json found - skipping migration');
        return 0;
    }
    
    try {
        // Read the JSON file
        const rawData = fs.readFileSync(STARTING_CACHE_PATH, 'utf-8');
        const cacheData = JSON.parse(rawData);
        
        // Prepare insert statement
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO geocache (lat, lon, location_type, location_name)
            VALUES (?, ?, ?, ?)
        `);
        
        // Use transaction for bulk insert (much faster)
        const insertMany = db.transaction((entries) => {
            let inserted = 0;
            for (const entry of entries) {
                const result = insertStmt.run(entry.lat, entry.lon, entry.type, entry.name);
                if (result.changes > 0) inserted++;
            }
            return inserted;
        });
        
        // Parse and prepare data for insertion
        const entries = [];
        for (const [coords, locationObj] of Object.entries(cacheData)) {
            const [lat, lon] = coords.split(',').map(parseFloat);
            
            // Extract location type and name
            // Format: { "country": "Brazil" } or { "ocean": "Atlantic" } or { "unknown": "unknown" }
            const locationType = Object.keys(locationObj)[0];
            const locationName = locationObj[locationType];
            
            entries.push({ lat, lon, type: locationType, name: locationName });
        }
        
        // Insert all entries
        const insertedCount = insertMany(entries);
        
        console.log(`✓ Migrated ${insertedCount} entries from startingAPIinfo.json`);
        console.log(`  (${entries.length - insertedCount} duplicates skipped)`);
        
        return insertedCount;
        
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        throw error;
    }
}

/**
 * Display database statistics
 */
export function showStats() {
    const stats = db.prepare('SELECT COUNT(*) as total FROM geocache').get();
    const byType = db.prepare(`
        SELECT location_type, COUNT(*) as count 
        FROM geocache 
        GROUP BY location_type
    `).all();
    
    console.log('\n📊 Database Statistics:');
    console.log(`   Total entries: ${stats.total}`);
    byType.forEach(row => {
        console.log(`   - ${row.location_type}: ${row.count}`);
    });
}

/**
 * Main initialization function
 */
export function initializeDatabase() {
    console.log('🗄️  Initializing SQLite database...\n');
    console.log(`Database path: ${DB_PATH}`);
    console.log(`Starting cache path: ${STARTING_CACHE_PATH}\n`);
    
    createTable();
    const migrated = migrateStartingData();
    showStats();
    
    console.log('\n✅ Database initialization complete!\n');
    
    // Suggest deleting the JSON file after successful migration
    if (migrated > 0) {
        console.log('💡 You can now safely delete startingAPIinfo.json');
    }
    
    return db;
}

// Export database instance for use in other modules
export { db };
