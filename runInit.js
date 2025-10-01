import { initializeDatabase } from './database/initDb.js';
import { db } from './database/initDb.js';

console.log('🚀 Starting database initialization...\n');

initializeDatabase();

console.log('\nClosing database connection...');
db.close();
console.log('✅ All done!');