import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { geocodeBatch } from './geocodingService.js';

dotenv.config();

const dataFilesDir = path.join(path.resolve(process.env.FETCHED_DIR));
const currDir = path.join(dataFilesDir, process.env.CURRENT_DIR);
const processedFilePath = path.join(dataFilesDir, 'processed.json');

/**
 * Round coordinate to 2 decimal places
 */
function roundToDecimalPlaces(num) {
    return Math.round(num * 100) / 100;
}

/**
 * Read JSON file
 */
async function readJsonFile(filename) {
    try {
        const filePath = path.join(currDir, filename);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        throw error;
    }
}

/**
 * Extract unique coordinates from balloon data
 */
function extractUniqueCoordinates(data00, data23) {
    const uniqueCoords = new Map();
    
    // Process 00.json
    for (const coord of data00) {
        const lat = roundToDecimalPlaces(coord[0]);
        const lon = roundToDecimalPlaces(coord[1]);
        const key = `${lat},${lon}`;
        
        if (!uniqueCoords.has(key)) {
            uniqueCoords.set(key, { lat, lon });
        }
    }
    
    // Process 23.json
    for (const coord of data23) {
        const lat = roundToDecimalPlaces(coord[0]);
        const lon = roundToDecimalPlaces(coord[1]);
        const key = `${lat},${lon}`;
        
        if (!uniqueCoords.has(key)) {
            uniqueCoords.set(key, { lat, lon });
        }
    }
    
    return Array.from(uniqueCoords.values());
}

/**
 * Build trajectory data structure
 */
function buildTrajectories(data00, data23, geocodeResults) {
    const trajectories = [];
    
    // Process first 1000 balloons (or however many exist)
    const balloonCount = Math.min(data00.length, data23.length);
    
    for (let i = 0; i < balloonCount; i++) {
        const startCoord = data00[i];
        const endCoord = data23[i];
        
        const startLat = roundToDecimalPlaces(startCoord[0]);
        const startLon = roundToDecimalPlaces(startCoord[1]);
        const startKey = `${startLat},${startLon}`;
        
        const endLat = roundToDecimalPlaces(endCoord[0]);
        const endLon = roundToDecimalPlaces(endCoord[1]);
        const endKey = `${endLat},${endLon}`;
        
        const trajectory = {
            start: startCoord,
            end: endCoord,
            '00.json': geocodeResults.get(startKey) || { unknown: 'unknown' },
            '23.json': geocodeResults.get(endKey) || { unknown: 'unknown' }
        };
        
        trajectories.push(trajectory);
    }
    
    return trajectories;
}

/**
 * Main processing function
 */
export async function processBalloonsData() {
    console.log('\n🎈 Starting balloon data processing...\n');
    console.log('='.repeat(60));
    
    try {
        // Step 1: Read JSON files
        console.log('\n📂 Step 1: Reading data files...');
        const data00 = await readJsonFile('00.json');
        const data23 = await readJsonFile('23.json');
        console.log(`   ✓ 00.json: ${data00.length} balloons`);
        console.log(`   ✓ 23.json: ${data23.length} balloons`);
        
        // Step 2: Extract unique coordinates
        console.log('\n📍 Step 2: Extracting unique coordinates...');
        const uniqueCoords = extractUniqueCoordinates(data00, data23);
        console.log(`   ✓ Found ${uniqueCoords.length} unique coordinates`);
        
        // Step 3: Batch geocode all unique coordinates
        console.log('\n🌍 Step 3: Geocoding coordinates...');
        const geocodeResults = await geocodeBatch(uniqueCoords);
        
        // Step 4: Build trajectory data structure
        console.log('\n🔨 Step 4: Building trajectory data structure...');
        const trajectories = buildTrajectories(data00, data23, geocodeResults);
        console.log(`   ✓ Created ${trajectories.length} trajectory records`);
        
        // Step 5: Write to processed.json
        console.log('\n💾 Step 5: Writing processed data to disk...');
        await fs.writeFile(
            processedFilePath,
            JSON.stringify(trajectories, null, 2),
            'utf-8'
        );
        console.log(`   ✓ Saved to: ${processedFilePath}`);
        
        // Step 6: Statistics
        console.log('\n📊 Processing Statistics:');
        console.log(`   - Balloons processed: ${trajectories.length}`);
        console.log(`   - Unique coordinates: ${uniqueCoords.length}`);
        console.log(`   - Output file size: ${(JSON.stringify(trajectories).length / 1024).toFixed(2)} KB`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Balloon data processing complete!\n');
        
        return {
            success: true,
            trajectoriesCount: trajectories.length,
            uniqueCoordinates: uniqueCoords.length,
            outputPath: processedFilePath
        };
        
    } catch (error) {
        console.error('\n❌ Processing failed:', error.message);
        console.error(error.stack);
        
        return {
            success: false,
            error: error.message
        };
    }
}