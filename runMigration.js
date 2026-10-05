import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        const migrationFile = path.join(
            __dirname,
            process.env.MIGRATION_FILE || path.join('migrations', '001_clean_schema.sql')
        );
        const sqlContent = readFileSync(migrationFile, 'utf-8');
        
        // Simple split by semicolon
        const allStatements = sqlContent.split(';').map(s => {
            // Remove SQL comments (both -- and /* */)
            let cleaned = s.replace(/--[^\n]*/g, '') // Remove -- comments
                          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
                          .trim();
            return cleaned;
        });
        const statements = allStatements.filter(s => s && s.length > 0);
        
        console.log(`Total split statements: ${allStatements.length}`);
        console.log(`Final statements: ${statements.length}\n`);
        
        console.log(`\nFound ${statements.length} statements to execute\n`);
        
        // Log all statements for debugging
        for (let i = 0; i < statements.length; i++) {
            const firstLine = statements[i].split('\n')[0];
            console.log(`Statement ${i + 1}: ${firstLine}`);
        }
        console.log('');
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                console.log(`[${i + 1}/${statements.length}] ${statement.substring(0, 60)}...`);
                await connection.query(statement);
                console.log(`✓\n`);
            } catch (error) {
                // Ignore if already applied
                if (error.message.includes('Duplicate column') || 
                    error.message.includes('Duplicate key') ||
                    error.message.includes('already exists')) {
                    console.log(`⚠ Already applied\n`);
                } else {
                    console.error(`✗ Failed`);
                    console.error('Error:', error.message, '\n');
                    throw error;
                }
            }
        }
        
        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

runMigration();
