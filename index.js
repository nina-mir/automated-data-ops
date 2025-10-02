import pino from 'pino';

import { checkDirExists, filenames, fetchFile, archiveFiles } from './server_modules/dataFetchWriteOps.js';
import { robustGitPush } from './server_modules/gitOps.js';
import { processBalloonsData } from './server_modules/dataProcessor.js';
import { db } from './database/initDb.js';

const logger = pino({
  transport: {
    target: 'pino-pretty',
  },
});

logger.info('🚀 Starting hourly data collection workflow...\n');
logger.info('='.repeat(60));

const retryDownload = new Map(); // filename -> attempt count

// Basic setup of the file hierarchy
checkDirExists();

// Archive previous batch if we have 24 files
archiveFiles();

logger.info('\n📥 Downloading JSON files from Windborne...\n');

// A loop to download JSON files sequentially
for (const filename of filenames) {
    try {
        let isWritten = await fetchFile(filename);
        if (isWritten) {
            logger.info(`✓ ${filename}`);
        } else {
            logger.error(`✗ Could not write ${filename}!`);
            retryDownload.set(filename, 0); // Start with 0 attempts
        }
    } catch (error) {
        logger.info(`⚠ Will retry ${filename}`);
        retryDownload.set(filename, 0);
    }
}

// Retry failed downloads up to 5 times
if (retryDownload.size > 0) {
    logger.info('\n🔄 Retrying failed downloads...\n');
    
    while (retryDownload.size > 0) {
        const currentRetries = new Map(retryDownload);
        
        for (const [filename, attempts] of currentRetries) {
            if (attempts >= 5) {
                logger.error(`✗ Max retries (5) reached for ${filename}`);
                retryDownload.delete(filename);
                continue;
            }
            
            logger.info(`   Retry ${attempts + 1}/5 for ${filename}`);
            const isWritten = await fetchFile(filename);
            
            if (isWritten) {
                logger.info(`   ✓ Success on retry for ${filename}`);
                retryDownload.delete(filename);
            } else {
                retryDownload.set(filename, attempts + 1);
            }
            
            // Small delay between retries
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

logger.info('\n' + '='.repeat(60));

// Check if downloads were successful
if (retryDownload.size > 0) {
    logger.error('\n❌ Some files failed to download after retries:');
    for (const filename of retryDownload.keys()) {
        logger.error(`   - ${filename}`);
    }
    logger.error('\nSkipping data processing and git push due to incomplete download.');
    process.exit(1);
}

logger.info('\n✅ All files downloaded successfully!\n');
logger.info('='.repeat(60));

// Process balloon data (00.json and 23.json)
logger.info('\n🎈 Processing balloon trajectory data...\n');

try {
    const processResult = await processBalloonsData();
    
    if (!processResult.success) {
        logger.error('\n❌ Data processing failed:', processResult.error);
        logger.error('Skipping git push.');
        process.exit(1);
    }
    
    logger.info('\n' + '='.repeat(60));
    
} catch (error) {
    logger.error('\n❌ Data processing error:', error.message);
    logger.error(error.stack);
    logger.error('Skipping git push.');
    process.exit(1);
}

// Git push - push both downloaded files AND processed.json
logger.info('\n📤 Pushing to GitHub...\n');

try {
    // Push to GitHub
    const result = await robustGitPush(
        [], // empty array means add all files (including processed.json)
        'Automated update: new data files and processed trajectories'
    );

    if (result.success) {
        logger.info('✅ Files successfully pushed to GitHub');
        logger.info('   Cloudflare will serve the updated data on next request\n');
    } else {
        logger.error('❌ GitHub push failed:', result.error);
        process.exit(1);
    }

} catch (error) {
    logger.error('❌ Git push error:', error);
    process.exit(1);
}

logger.info('='.repeat(60));
logger.info('\n🎉 Hourly workflow complete!\n');

// Close database connection
db.close();
