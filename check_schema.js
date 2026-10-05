import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
  if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required.');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'akhil_pune_bhavsar'
  });

  try {
    const [columns] = await connection.execute('DESCRIBE events');
    console.log('Events table schema:');
    columns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} - ${col.Null === 'YES' ? 'nullable' : 'not null'}`);
    });
  } finally {
    await connection.end();
  }
}

checkSchema();
