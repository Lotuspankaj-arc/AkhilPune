import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupDb() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        console.log('Dropping multi-tenant tables...');
        
        // Drop in reverse order of dependencies
        const tables = [
            'subscriptions',
            'candidate_event_registrations',
            'client_admin_mapping',
            'client_core_committee',
            'clients'
        ];

        for (const table of tables) {
            try {
                await connection.query(`DROP TABLE IF EXISTS ${table}`);
                console.log(`✓ Dropped ${table}`);
            } catch (error) {
                console.log(`⚠ ${table} not found (or already dropped)`);
            }
        }

        // Drop stored procedures
        const procedures = [
            'sp_calculate_subscription_expiry',
            'sp_link_candidate_to_event',
            'sp_get_candidate_feed'
        ];

        for (const proc of procedures) {
            try {
                await connection.query(`DROP PROCEDURE IF EXISTS ${proc}`);
                console.log(`✓ Dropped procedure ${proc}`);
            } catch (error) {
                console.log(`⚠ ${proc} not found (or already dropped)`);
            }
        }

        // Drop views
        const views = [
            'v_active_subscriptions',
            'v_unique_candidates_per_event'
        ];

        for (const view of views) {
            try {
                await connection.query(`DROP VIEW IF EXISTS ${view}`);
                console.log(`✓ Dropped view ${view}`);
            } catch (error) {
                console.log(`⚠ ${view} not found (or already dropped)`);
            }
        }

        console.log('\n✅ Database cleanup completed!');
        console.log('Ready for fresh migration...\n');
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

cleanupDb();
