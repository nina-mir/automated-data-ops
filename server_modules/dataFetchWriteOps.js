import axios from 'axios';
import dotenv from 'dotenv';
import path from 'node:path';
import fs, { readdir } from 'node:fs/promises'

dotenv.config(); // Load environment variables
const baseURL = process.env.BASE_URL;
const dataFilesDir = path.join(path.resolve(process.env.FETCHED_DIR))
const currDir = path.join(dataFilesDir, process.env.CURRENT_DIR)
const archiveDir = path.join(dataFilesDir, process.env.ARCHIVE_DIR)
// TO-do include archiving methods to archive old data files by time-stamp

const padHour = (hour) => hour.toString().padStart(2, '0')
export const filenames = Array.from({ length: 24 }, (_, i) => `${padHour(i)}.json`)

export async function checkDirExists(){
    // Check if the directory exists, if not, create it recursively
    await fs.mkdir(dataFilesDir, { recursive: true });
    await fs.mkdir(currDir, { recursive: true });
    await fs.mkdir(archiveDir, { recursive: true });
}


export async function archiveFiles(){
    try {
        const currFiles = await readdir(currDir)
        
        // Check if we have exactly 24 files and they match our expected filenames
        if (currFiles.length === 24) {
            // Create timestamp for the archive folder (current time minus 1 hour)
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            
            // Format: YYYY-MM-DD-HH (using 24-hour format)
            const year = oneHourAgo.getFullYear();
            const month = String(oneHourAgo.getMonth() + 1).padStart(2, '0');
            const day = String(oneHourAgo.getDate()).padStart(2, '0');
            const hour = String(oneHourAgo.getHours()).padStart(2, '0');
            
            const archiveSubfolderName = `${year}-${month}-${day}-${hour}`;
            const archiveSubfolderPath = path.join(archiveDir, archiveSubfolderName);
            
            // Create the archive subdirectory
            await fs.mkdir(archiveSubfolderPath, { recursive: true });
            
            // Copy all files from current directory to archive subdirectory
            const copyPromises = currFiles.map(async (filename) => {
                const sourcePath = path.join(currDir, filename);
                const destPath = path.join(archiveSubfolderPath, filename);
                
                try {
                    await fs.copyFile(sourcePath, destPath);
                    console.log(`Archived: ${filename} -> ${archiveSubfolderName}/`);
                } catch (copyError) {
                    console.error(`Failed to copy ${filename}:`, copyError.message);
                    throw copyError; // Re-throw to handle in Promise.all
                }
            });
            
            await Promise.all(copyPromises);
            console.log(`Successfully archived 24 files to ${archiveSubfolderName}`);
            
            return {
                success: true,
                archiveFolder: archiveSubfolderName,
                filesArchived: currFiles.length
            };
            
        } else {
            console.log(`Not archiving - found ${currFiles.length} files, expected 24`);
            return {
                success: false,
                reason: `Expected 24 files, found ${currFiles.length}`
            };
        }
        
    } catch (error) {
        console.error('Archive error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}


function isValidJson(data) {
    try {
        const jsonString = JSON.stringify(data);
        return jsonString.length >= 1000;
    } catch {
        return false;
    }
}


export async function writeFileToDisk(filepath, data) {
    try {
        await fs.writeFile(filepath, JSON.stringify(data))
        return true
    } catch (error) {
        console.error(`[writing to disk] Error encountered : ${error}`)
        return false
        // update a flag to re-try erroneous downloads
    }
}


export async function fetchFile(filename) {
    try {
        const response = await axios({
            method: 'get',
            url: `${baseURL}/${filename}`,
            responseType: 'json'
        })

        // Validate JSON
        if (!isValidJson(response.data)) {
            console.error(`Invalid JSON for ${filename} - too short or malformed`)
            return false
        }

        const pathToWrite = path.join(currDir, filename)
        return await writeFileToDisk(pathToWrite, response.data)
    } catch (error) {
        console.error(`Download error for ${filename}:`, error.message)
        return false
    }
}
