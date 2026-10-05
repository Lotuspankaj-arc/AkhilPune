import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Non-destructive admin login fixer.
 * Ensures the 'super_user' role, a super-user admin profile, and matching
 * auth_credentials row exist for the given email/password - WITHOUT deleting
 * any existing candidates, events, volunteers, or other admins.
 *
 * Usage:
 *   node scripts/fix_admin_login.js [email] [password]
 * Defaults: admin@pcmc.com / Password123
 */
async function fixAdminLogin() {
    const email = process.argv[2] || process.env.SUPER_USER_EMAIL;
    const password = process.argv[3] || process.env.SUPER_USER_PASSWORD;
    const dbPassword = process.env.DB_PASSWORD;
    if (!email || !password || !dbPassword) {
        throw new Error('Provide email/password arguments or SUPER_USER_EMAIL/SUPER_USER_PASSWORD, plus DB_PASSWORD.');
    }

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: dbPassword,
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, 'super_user', TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = 'super_user')`
        );

        const [[superRole]] = await conn.query(
            "SELECT role_id FROM roles WHERE LOWER(role_name) = 'super_user' ORDER BY role_id ASC LIMIT 1"
        );

        const [superAdminRows] = await conn.query(
            'SELECT admin_id FROM admin_users WHERE is_super_user = TRUE ORDER BY admin_id ASC LIMIT 1'
        );

        let superAdminId;
        if (superAdminRows.length === 0) {
            const [insertAdmin] = await conn.query(
                "INSERT INTO admin_users (name, phone_number, is_super_user, is_active) VALUES ('Super User', '', TRUE, TRUE)"
            );
            superAdminId = insertAdmin.insertId;
            console.log(`Created new super admin profile (admin_id=${superAdminId}).`);
        } else {
            superAdminId = superAdminRows[0].admin_id;
            await conn.query('UPDATE admin_users SET is_active = TRUE WHERE admin_id = ?', [superAdminId]);
            console.log(`Reusing existing super admin profile (admin_id=${superAdminId}).`);
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [existingCred] = await conn.query(
            'SELECT id FROM auth_credentials WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );

        if (existingCred.length === 0) {
            await conn.query(
                'INSERT INTO auth_credentials (email, password, user_id, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
                [email, passwordHash, superAdminId, superRole.role_id]
            );
            console.log('Created new auth_credentials row.');
        } else {
            await conn.query(
                'UPDATE auth_credentials SET password = ?, user_id = ?, role_id = ?, is_active = TRUE WHERE id = ?',
                [passwordHash, superAdminId, superRole.role_id, existingCred[0].id]
            );
            console.log('Updated existing auth_credentials row.');
        }

        await conn.commit();
        console.log('\n✅ Admin login fixed. No other data was modified.');
        console.log(`Email:    ${email}`);
        console.log('Password: updated');
    } catch (err) {
        await conn.rollback();
        console.error('❌ Fix failed:', err);
        process.exitCode = 1;
    } finally {
        await conn.end();
    }
}

fixAdminLogin();
