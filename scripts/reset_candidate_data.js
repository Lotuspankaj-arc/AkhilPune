import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const runReset = async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        await connection.beginTransaction();

        const statements = [
            'DELETE FROM candidate_interactions',
            'DELETE FROM subscriptions',
            'DELETE FROM candidate_event_registrations',
            'DELETE FROM registration_intents',
            'DELETE FROM candidates'
        ];

        for (const statement of statements) {
            try {
                await connection.query(statement);
            } catch (error) {
                if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
            }
        }

        const [candidateRoleRows] = await connection.query(
            "SELECT role_id FROM roles WHERE LOWER(role_name) = 'candidate' LIMIT 1"
        );
        if (candidateRoleRows.length > 0) {
            await connection.query(
                'DELETE FROM auth_credentials WHERE role_id = ?',
                [candidateRoleRows[0].role_id]
            );
        }

        await connection.query('ALTER TABLE candidates AUTO_INCREMENT = 1');
        await connection.query('ALTER TABLE registration_intents AUTO_INCREMENT = 1');
        await connection.commit();
        console.log('Candidate data reset complete. Super users, admins, clients, and events were preserved.');
    } catch (error) {
        await connection.rollback();
        console.error(`Candidate data reset failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
};

runReset();
