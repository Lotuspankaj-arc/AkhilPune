import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

async function runReset() {
    if (!process.env.DB_PASSWORD || !process.env.SUPER_USER_EMAIL || !process.env.SUPER_USER_PASSWORD) {
        throw new Error('DB_PASSWORD, SUPER_USER_EMAIL, and SUPER_USER_PASSWORD are required.');
    }
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    const superEmail = process.env.SUPER_USER_EMAIL;
    const superPassword = process.env.SUPER_USER_PASSWORD;

    try {
        await conn.beginTransaction();

        // Ensure role ids exist
        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, 'super_user', TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = 'super_user')`
        );
        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, 'admin', TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = 'admin')`
        );
        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, 'candidate', TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = 'candidate')`
        );

        const [[superRole]] = await conn.query(
            "SELECT role_id FROM roles WHERE LOWER(role_name)='super_user' ORDER BY role_id ASC LIMIT 1"
        );

        // Ensure a super admin profile exists
        const [superAdminRows] = await conn.query(
            'SELECT admin_id FROM admin_users WHERE is_super_user = TRUE ORDER BY admin_id ASC LIMIT 1'
        );

        let superAdminId;
        if (superAdminRows.length === 0) {
            const [insertAdmin] = await conn.query(
                "INSERT INTO admin_users (name, phone_number, is_super_user, is_active) VALUES ('Super User', '', TRUE, TRUE)"
            );
            superAdminId = insertAdmin.insertId;
        } else {
            superAdminId = superAdminRows[0].admin_id;
            await conn.query('UPDATE admin_users SET is_active = TRUE WHERE admin_id = ?', [superAdminId]);
        }

        // Remove all test data for clean start
        await conn.query('DELETE FROM volunteer_team_assignments');
        await conn.query('DELETE FROM teams');
        await conn.query('DELETE FROM volunteers');
        await conn.query('DELETE FROM candidates');
        await conn.query('DELETE FROM events');

        // Remove all non-super admins
        await conn.query('DELETE FROM admin_users WHERE admin_id <> ?', [superAdminId]);

        // Remove all credentials except super email
        await conn.query('DELETE FROM auth_credentials WHERE LOWER(email) <> LOWER(?)', [superEmail]);

        const [superCred] = await conn.query(
            'SELECT id FROM auth_credentials WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [superEmail]
        );
        const passwordHash = await bcrypt.hash(superPassword, 10);

        if (superCred.length === 0) {
            await conn.query(
                'INSERT INTO auth_credentials (email, password, user_id, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
                [superEmail, passwordHash, superAdminId, superRole.role_id]
            );
        } else {
            await conn.query(
                'UPDATE auth_credentials SET password = ?, user_id = ?, role_id = ?, is_active = TRUE WHERE id = ?',
                [passwordHash, superAdminId, superRole.role_id, superCred[0].id]
            );
        }

        await conn.commit();
        console.log('Reset complete.');
        console.log(`Super user: ${superEmail}`);
        console.log(`Super password: ${superPassword}`);
    } catch (err) {
        await conn.rollback();
        console.error('Reset failed:', err);
        process.exitCode = 1;
    } finally {
        await conn.end();
    }
}

runReset();
