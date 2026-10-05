import mysql from 'mysql2/promise';

async function listDbTables() {
    if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required.');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        const [dbRows] = await conn.query('SELECT DATABASE() AS db');
        const [tables] = await conn.query('SHOW TABLES');
        console.log(JSON.stringify({ db: dbRows[0]?.db || null, tables }, null, 2));
    } finally {
        await conn.end();
    }
}

listDbTables().catch((error) => {
    console.error('Failed to list database tables:', error.message);
    process.exit(1);
});