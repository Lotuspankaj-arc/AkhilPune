import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function createSampleEvent() {
  if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required.');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'akhil_pune_bhavsar'
  });

  try {
    console.log('🎯 Creating Sample Event...');
    
    const insertQuery = `
      INSERT INTO events (
        event_id,
        event_name,
        venue,
        start_date,
        end_date,
        registration_cutoff_date,
        client_id,
        banner_url,
        is_active,
        created_by,
        created_at
      ) VALUES (
        1,
        'Pune Matrimony Meet 2024',
        'The Orchid Hotel, Pune',
        '2024-12-15',
        '2024-12-17',
        '2024-12-15',
        1,
        'https://example.com/banner.jpg',
        1,
        1,
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        event_name = 'Pune Matrimony Meet 2024',
        is_active = 1
    `;

    const result = await connection.execute(insertQuery);
    console.log('✅ Event created/updated successfully');
    console.log('Result:', result);

    // Verify event exists
    const [events] = await connection.execute(
      'SELECT * FROM events WHERE event_id = 1'
    );
    console.log('Event Details:', events[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

createSampleEvent();
