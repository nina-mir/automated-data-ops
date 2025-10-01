import { processBalloonsData } from './server_modules/dataProcessor.js';
import { getCacheStats } from './server_modules/geocodingService.js';
import { db } from './database/initDb.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const dataFilesDir = path.join(path.resolve(process.env.FETCHED_DIR));
const processedFilePath = path.join(dataFilesDir, 'processed.json');

console.log('🧪 Testing Data Processor\n');
console.log('='.repeat(60));

// Check if required files exist
console.log('\n🔍 Pre-flight checks...');
const currDir = path.join(dataFilesDir, process.env.CURRENT_DIR);
const file00 = path.join(currDir, '00.json');
const file23 = path.join(currDir, '23.json');

try {
    await fs.access(file00);
    console.log('   ✓ 00.json exists');
} catch {
    console.error('   ✗ 00.json NOT FOUND!');
    console.error(`     Expected at: ${file00}`);
    console.error('\n   Please run your download script first or ensure files are in the correct location.');
    process.exit(1);
}

try {
    await fs.access(file23);
    console.log('   ✓ 23.json exists');
} catch {
    console.error('   ✗ 23.json NOT FOUND!');
    console.error(`     Expected at: ${file23}`);
    console.error('\n   Please run your download script first or ensure files are in the correct location.');
    process.exit(1);
}

// Show initial cache stats
console.log('\n📊 Initial Cache Statistics:');
const initialStats = getCacheStats();
console.log(`   Total entries: ${initialStats.total}`);
Object.entries(initialStats.byType).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
});

console.log('\n' + '='.repeat(60));

// Run the processor
const result = await processBalloonsData();

console.log('='.repeat(60));

if (result.success) {
    // Show final cache stats
    console.log('\n📊 Final Cache Statistics:');
    const finalStats = getCacheStats();
    console.log(`   Total entries: ${finalStats.total}`);
    Object.entries(finalStats.byType).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`);
    });
    console.log(`\n   🆕 New entries added: ${finalStats.total - initialStats.total}`);
    
    // Show sample of processed data
    console.log('\n📄 Sample of processed data (first 3 trajectories):');
    try {
        const processedData = JSON.parse(await fs.readFile(processedFilePath, 'utf-8'));
        
        for (let i = 0; i < Math.min(3, processedData.length); i++) {
            const traj = processedData[i];
            console.log(`\n   Trajectory ${i + 1}:`);
            console.log(`      Start: [${traj.start[0].toFixed(2)}, ${traj.start[1].toFixed(2)}, ${traj.start[2].toFixed(2)}]`);
            const startType = Object.keys(traj['00.json'])[0];
            const startName = traj['00.json'][startType];
            console.log(`      Start Location: ${startType} = ${startName}`);
            console.log(`      End: [${traj.end[0].toFixed(2)}, ${traj.end[1].toFixed(2)}, ${traj.end[2].toFixed(2)}]`);
            const endType = Object.keys(traj['23.json'])[0];
            const endName = traj['23.json'][endType];
            console.log(`      End Location: ${endType} = ${endName}`);
        }
    } catch (error) {
        console.error('   Error reading processed file:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All tests passed!\n');
} else {
    console.log('\n❌ Processing failed - see errors above\n');
}

// Close database
db.close();