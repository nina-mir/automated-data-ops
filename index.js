import { checkDirExists, filenames, fetchFile, archiveFiles } from './server_modules/dataFetchWriteOps.js';
import { robustGitPush } from './server_modules/gitOps.js';
import { processBalloonsData } from './server_modules/dataProcessor.js';
import { db } from './database/initDb.js';

console.log('🚀 Starting hourly data collection workflow...\n');
console.log('='.repeat(60));

const retryDownload = new Map(); // filename -> attempt count

// Basic setup of the file hierarchy
checkDirExists();

// Archive previous batch if we have 24 files
archiveFiles();

console.log('\n📥 Downloading JSON files from Windborne...\n');

// A loop to download JSON files sequentially
for (const filename of filenames) {
    try {
        let isWritten = await fetchFile(filename);
        if (isWritten) {
            console.log(`✓ ${filename}`);
        } else {
            console.error(`✗ Could not write ${filename}!`);
            retryDownload.set(filename, 0); // Start with 0 attempts
        }
    } catch (error) {
        console.log(`⚠ Will retry ${filename}`);
        retryDownload.set(filename, 0);
    }
}

// Retry failed downloads up to 5 times
if (retryDownload.size > 0) {
    console.log('\n🔄 Retrying failed downloads...\n');
    
    while (retryDownload.size > 0) {
        const currentRetries = new Map(retryDownload);
        
        for (const [filename, attempts] of currentRetries) {
            if (attempts >= 5) {
                console.error(`✗ Max retries (5) reached for ${filename}`);
                retryDownload.delete(filename);
                continue;
            }
            
            console.log(`   Retry ${attempts + 1}/5 for ${filename}`);
            const isWritten = await fetchFile(filename);
            
            if (isWritten) {
                console.log(`   ✓ Success on retry for ${filename}`);
                retryDownload.delete(filename);
            } else {
                retryDownload.set(filename, attempts + 1);
            }
            
            // Small delay between retries
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

console.log('\n' + '='.repeat(60));

// Check if downloads were successful
if (retryDownload.size > 0) {
    console.error('\n❌ Some files failed to download after retries:');
    for (const filename of retryDownload.keys()) {
        console.error(`   - ${filename}`);
    }
    console.error('\nSkipping data processing and git push due to incomplete download.');
    process.exit(1);
}

console.log('\n✅ All files downloaded successfully!\n');
console.log('='.repeat(60));

// Process balloon data (00.json and 23.json)
console.log('\n🎈 Processing balloon trajectory data...\n');

try {
    const processResult = await processBalloonsData();
    
    if (!processResult.success) {
        console.error('\n❌ Data processing failed:', processResult.error);
        console.error('Skipping git push.');
        process.exit(1);
    }
    
    console.log('\n' + '='.repeat(60));
    
} catch (error) {
    console.error('\n❌ Data processing error:', error.message);
    console.error(error.stack);
    console.error('Skipping git push.');
    process.exit(1);
}

// Git push - push both downloaded files AND processed.json
console.log('\n📤 Pushing to GitHub...\n');

try {
    // Push to GitHub
    const result = await robustGitPush(
        [], // empty array means add all files (including processed.json)
        'Automated update: new data files and processed trajectories'
    );

    if (result.success) {
        console.log('✅ Files successfully pushed to GitHub');
        console.log('   Cloudflare will serve the updated data on next request\n');
    } else {
        console.error('❌ GitHub push failed:', result.error);
        process.exit(1);
    }

} catch (error) {
    console.error('❌ Git push error:', error);
    process.exit(1);
}

console.log('='.repeat(60));
console.log('\n🎉 Hourly workflow complete!\n');

// Close database connection
db.close();