import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function resetForFreshOnboarding() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        await connection.beginTransaction();

        const [superAdmins] = await connection.query(
            'SELECT admin_id FROM admin_users WHERE is_super_user = TRUE AND is_active = TRUE ORDER BY admin_id ASC LIMIT 1'
        );
        if (superAdmins.length === 0) {
            throw new Error('No active Super User account was found. Reset cancelled.');
        }

        const superAdminId = superAdmins[0].admin_id;
        const statements = [
            'DELETE FROM candidate_interactions',
            'DELETE FROM subscriptions',
            'DELETE FROM candidate_event_registrations',
            'DELETE FROM registration_intents',
            'DELETE FROM activity_logs',
            'DELETE FROM candidates',
            'DELETE FROM client_admin_mapping',
            'DELETE FROM client_core_committee',
            'DELETE FROM events',
            'DELETE FROM clients',
            'DELETE FROM volunteer_team_assignments',
            'DELETE FROM teams',
            'DELETE FROM volunteers',
            'DELETE FROM volunteer_groups'
        ];

        for (const statement of statements) {
            try {
                await connection.query(statement);
            } catch (error) {
                if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
            }
        }

        await connection.query('DELETE FROM auth_credentials WHERE user_id <> ?', [superAdminId]);
        await connection.query('DELETE FROM admin_users WHERE admin_id <> ?', [superAdminId]);
        await connection.query('UPDATE admin_users SET is_active = TRUE WHERE admin_id = ?', [superAdminId]);

        // Keep lookup/master data and the super-user account; reset all tenant data.
        await connection.query('ALTER TABLE candidates AUTO_INCREMENT = 1');
        await connection.query('ALTER TABLE events AUTO_INCREMENT = 1');
        await connection.query('ALTER TABLE clients AUTO_INCREMENT = 1');

        await connection.commit();
        console.log('Fresh onboarding reset complete. The Super User account and password were preserved.');
    } catch (error) {
        await connection.rollback();
        console.error(`Reset failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

resetForFreshOnboarding();
