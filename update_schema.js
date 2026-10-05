import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function updateSchema() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'akhil_pune_bhavsar',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
        });

        // Ignore errors if columns already exist
        try {
            await conn.query(`ALTER TABLE auth_credentials ADD COLUMN role_id INT DEFAULT 3`);
            console.log('Added role_id');
        } catch (e) {
            console.log('role_id might already exist');
        }

        try {
            await conn.query(`ALTER TABLE auth_credentials ADD COLUMN user_id INT`);
            console.log('Added user_id');
        } catch (e) {
            console.log('user_id might already exist');
        }

        // Set default admin to role 1 (Super Admin typically)
        await conn.query(`UPDATE auth_credentials SET role_id = 1 WHERE email = 'admin@pcmc.com'`);
        console.log('Updated admin role');

        await conn.end();
        console.log('Done.');
    } catch (e) {
        console.error(e);
    }
}

updateSchema();