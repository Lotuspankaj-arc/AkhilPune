import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ override: true });
const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'akhil_pune_bhavsar'
});
await connection.query(
    'UPDATE events SET registration_cutoff_date = ? WHERE event_id = ?',
    ['2026-12-31 23:59:59', 2]
);
const [rows] = await connection.query(
    'SELECT event_id, event_name, is_active, registration_cutoff_date FROM events WHERE event_id = ?',
    [2]
);
console.log(JSON.stringify(rows, null, 2));
await connection.end();
