import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addRazorpayFieldsToClients() {
  if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required.');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'akhil_pune_bhavsar'
  });

  try {
    console.log('🎯 Adding Razorpay fields to clients table...\n');

    // Check if columns already exist
    const [columns] = await connection.execute('DESCRIBE clients');
    const columnNames = columns.map(col => col.Field);
    
    const columnsToAdd = [
      { name: 'razorpay_key_id', type: 'VARCHAR(255)', exists: columnNames.includes('razorpay_key_id') },
      { name: 'razorpay_key_secret', type: 'TEXT', exists: columnNames.includes('razorpay_key_secret') },
      { name: 'registration_amount', type: 'DECIMAL(10,2)', exists: columnNames.includes('registration_amount') }
    ];

    for (const col of columnsToAdd) {
      if (col.exists) {
        console.log(`✅ Column '${col.name}' already exists`);
        continue;
      }

      const query = `ALTER TABLE clients ADD COLUMN ${col.name} ${col.type} DEFAULT NULL`;
      await connection.execute(query);
      console.log(`✅ Added column '${col.name}' (${col.type})`);
    }

    // Update sample client with test Razorpay keys
    console.log('\n🎯 Updating sample client with Razorpay details...');
    const updateQuery = `
      UPDATE clients 
      SET 
        razorpay_key_id = ?,
        razorpay_key_secret = ?,
        registration_amount = ?
      WHERE client_id = 1
    `;
    
    // Using test keys from Razorpay docs (these are dummy keys)
    await connection.execute(updateQuery, [
      'rzp_test_1DP5V5X6XnW3XQ',  // Test key ID
      'dummyKeySecretForTesting123456',  // Test key secret
      '500.00'  // Registration amount: 500 INR
    ]);
    console.log('✅ Updated Pune client (ID: 1) with test Razorpay keys');

    // Verify
    const [clients] = await connection.execute(
      'SELECT client_id, client_name, razorpay_key_id, registration_amount FROM clients WHERE client_id = 1'
    );
    console.log('\n📋 Updated Client Details:');
    console.log(JSON.stringify(clients[0], null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

addRazorpayFieldsToClients();
