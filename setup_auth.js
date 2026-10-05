import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

async function setupDb() {
    const email = process.env.SUPER_USER_EMAIL;
    const password = process.env.SUPER_USER_PASSWORD;
    const dbPassword = process.env.DB_PASSWORD;
    if (!email || !password || !dbPassword) {
        throw new Error('Set SUPER_USER_EMAIL, SUPER_USER_PASSWORD, and DB_PASSWORD before running setup_auth.js.');
    }

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: dbPassword,
            database: process.env.DB_NAME || 'akhil_pune_bhavsar'
        });

        const hashedPassword = await bcrypt.hash(password, 10);

        await conn.query(`
            UPDATE auth_credentials 
            SET password = ? 
            WHERE email = ?
        `, [hashedPassword, email]);
        
        console.log('Admin password updated with bcrypt hash.');

        await conn.end();
        console.log('Done.');
    } catch (e) {
        console.error(e);
    }
}

setupDb();
