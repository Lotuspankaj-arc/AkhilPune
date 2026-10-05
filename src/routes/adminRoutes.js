import express from 'express';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2';

const router = express.Router();

const resolveDb = (req, res) => {
    const db = req?.db || req?.app?.locals?.db;
    if (!db || typeof db.query !== 'function') {
        res.status(500).json({ error: 'Database connection not available for admin route' });
        return null;
    }
    return db;
};

// Middleware: Verify Admin/Super User Token
export const verifyAdminToken = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing access token' });
    }

    const token = auth.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware: Check if user is super user or admin
const checkAdminAccess = (db) => {
    return (req, res, next) => {
        const userId = req.user.id;
        db.query(
            `SELECT a.id, a.role_id, r.role_name FROM admins a 
             JOIN roles r ON a.role_id = r.id 
             WHERE a.user_id = ? AND a.is_active = TRUE`,
            [userId],
            (err, results) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (results.length === 0) return res.status(403).json({ error: 'Not authorized as admin' });
                
                req.admin = results[0];
                next();
            }
        );
    };
};

// ===== SUPER USER ENDPOINTS =====

// 1. Create/Promote User to Admin
router.post('/create-admin', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { user_id, role_name = 'admin' } = req.body;

    // Only super users can create admins
    db.query(
        `SELECT a.role_id, r.role_name FROM admins a 
         JOIN roles r ON a.role_id = r.id 
         WHERE a.user_id = ? AND r.role_name = 'super_user'`,
        [req.user.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length === 0) return res.status(403).json({ error: 'Only super users can create admins' });

            // Get role_id
            db.query(
                'SELECT id FROM roles WHERE role_name = ?',
                [role_name],
                (err, roleResults) => {
                    if (err || roleResults.length === 0) {
                        return res.status(400).json({ error: 'Invalid role' });
                    }

                    const roleId = roleResults[0].id;

                    // Create admin
                    db.query(
                        'INSERT INTO admins (user_id, role_id, created_by, is_active) VALUES (?, ?, ?, TRUE)',
                        [user_id, roleId, req.user.id],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({ 
                                    error: 'Failed to create admin', 
                                    details: err.message 
                                });
                            }

                            // Log activity
                            db.query(
                                'INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                                [results[0].id, 'create_admin', 'admins', result.insertId, JSON.stringify({ user_id, role_name })],
                                () => {}
                            );

                            res.status(201).json({ message: 'Admin created successfully', admin_id: result.insertId });
                        }
                    );
                }
            );
        }
    );
});

// 2. Update Admin Role
router.put('/update-admin/:admin_id', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { admin_id } = req.params;
    const { role_name, is_active } = req.body;

    // Only super users can update admins
    db.query(
        `SELECT a.role_id, r.role_name FROM admins a 
         JOIN roles r ON a.role_id = r.id 
         WHERE a.user_id = ? AND r.role_name = 'super_user'`,
        [req.user.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length === 0) return res.status(403).json({ error: 'Only super users can update admins' });

            let updates = [];
            let values = [];

            if (role_name) {
                updates.push('role_id = (SELECT id FROM roles WHERE role_name = ?)');
                values.push(role_name);
            }
            if (is_active !== undefined) {
                updates.push('is_active = ?');
                values.push(is_active);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(admin_id);

            db.query(
                `UPDATE admins SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
                values,
                (err) => {
                    if (err) return res.status(500).json({ error: 'Database update failed' });

                    // Log activity
                    db.query(
                        'INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                        [results[0].id, 'update_admin', 'admins', admin_id, JSON.stringify(req.body)],
                        () => {}
                    );

                    res.status(200).json({ message: 'Admin updated successfully' });
                }
            );
        }
    );
});

// 3. Deactivate Admin
router.delete('/deactivate-admin/:admin_id', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { admin_id } = req.params;

    // Only super users can deactivate admins
    db.query(
        `SELECT a.role_id, r.role_name FROM admins a 
         JOIN roles r ON a.role_id = r.id 
         WHERE a.user_id = ? AND r.role_name = 'super_user'`,
        [req.user.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length === 0) return res.status(403).json({ error: 'Only super users can deactivate admins' });

            db.query(
                'UPDATE admins SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
                [admin_id],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Database update failed' });

                    // Log activity
                    db.query(
                        'INSERT INTO activity_logs (admin_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
                        [results[0].id, 'deactivate_admin', 'admins', admin_id],
                        () => {}
                    );

                    res.status(200).json({ message: 'Admin deactivated successfully' });
                }
            );
        }
    );
});

// ===== EVENT MANAGEMENT =====

// 4. Get All Events
router.get('/events', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    db.query('SELECT * FROM events ORDER BY event_year DESC', (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json({ events: results });
    });
});

// 5. Create Event
router.post('/events', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { event_year, registration_cutoff_day, last_edit_day } = req.body;

    if (!event_year || !registration_cutoff_day || !last_edit_day) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.query(
        'INSERT INTO events (event_year, registration_cutoff_day, last_edit_day) VALUES (?, ?, ?)',
        [event_year, registration_cutoff_day, last_edit_day],
        (err, result) => {
            if (err) {
                return res.status(500).json({ 
                    error: 'Failed to create event', 
                    details: err.message 
                });
            }

            // Log activity
            db.query(
                'INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'create_event', 'events', result.insertId, JSON.stringify(req.body)],
                () => {}
            );

            res.status(201).json({ message: 'Event created successfully', event_id: result.insertId });
        }
    );
});

// 6. Update Event
router.put('/events/:event_id', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { event_id } = req.params;
    const { registration_cutoff_day, last_edit_day } = req.body;

    let updates = [];
    let values = [];

    if (registration_cutoff_day !== undefined) {
        updates.push('registration_cutoff_day = ?');
        values.push(registration_cutoff_day);
    }
    if (last_edit_day !== undefined) {
        updates.push('last_edit_day = ?');
        values.push(last_edit_day);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(event_id);

    db.query(
        `UPDATE events SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values,
        (err) => {
            if (err) return res.status(500).json({ error: 'Database update failed' });

            db.query(
                'INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'update_event', 'events', event_id, JSON.stringify(req.body)],
                () => {}
            );

            res.status(200).json({ message: 'Event updated successfully' });
        }
    );
});

// ===== USER MANAGEMENT =====

// 7. Get All Users (for admin)
router.get('/users', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const query = `
        SELECT c.id, c.email, c.first_name, c.middle_name, c.last_name, c.mobile,
               c.whatsapp, c.expectations, c.admin_notes, c.is_active, c.is_admin,
               c.created_at, r.role_name
        FROM candidates c
        LEFT JOIN admins a ON a.user_id = c.id
        LEFT JOIN roles r ON a.role_id = r.id
         ORDER BY c.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json({ users: results });
    });
});

// 8. Deactivate User (Admin can deactivate users)
router.put('/deactivate-user/:user_id', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { user_id } = req.params;
    const { reason } = req.body;

    db.query(
        'UPDATE candidates SET is_active = FALSE, admin_notes = ?, last_admin_action_by = ? WHERE id = ?',
        [reason || 'Deactivated by admin', req.user.id, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Database update failed' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

            db.query(
                'INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'deactivate_user', 'candidates', user_id, JSON.stringify({ reason })],
                () => {}
            );

            res.status(200).json({ message: 'User deactivated successfully' });
        }
    );
});

// 9. Activate User
router.put('/activate-user/:user_id', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { user_id } = req.params;

    db.query(
        'UPDATE candidates SET is_active = TRUE, admin_notes = NULL, last_admin_action_by = ? WHERE id = ?',
        [req.user.id, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Database update failed' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

            db.query(
                'INSERT INTO activity_logs (admin_id, action, table_name, record_id) VALUES (?, ?, ?, ?)',
                [req.user.id, 'activate_user', 'candidates', user_id],
                () => {}
            );

            res.status(200).json({ message: 'User activated successfully' });
        }
    );
});

// 10. Edit User Profile (Admin can edit any user's profile)
router.put('/edit-user/:user_id', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const { user_id } = req.params;
    const updates = req.body;

    const allowedFields = ['first_name', 'middle_name', 'last_name', 'email', 'mobile', 'whatsapp', 'expectations', 'admin_notes'];
    const setParts = [];
    const values = [];

    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
            setParts.push(`${field} = ?`);
            values.push(updates[field]);
        }
    }

    if (setParts.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    db.query(
        `UPDATE candidates SET ${setParts.join(', ')}, last_admin_action_by = ? WHERE id = ?`,
        [...values, req.user.id, user_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Database update failed' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

            db.query(
                'INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'edit_user', 'candidates', user_id, JSON.stringify(updates)],
                () => {}
            );

            res.status(200).json({ message: 'User profile updated successfully' });
        }
    );
});

// 11. Get Activity Logs
router.get('/activity-logs', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const query = `
        SELECT l.*, a.user_id, c.first_name, c.last_name 
        FROM activity_logs l
        JOIN admins a ON l.admin_id = a.id
        JOIN candidates c ON a.user_id = c.id
        ORDER BY l.created_at DESC
        LIMIT 100
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json({ logs: results });
    });
});

// 12. Get Admin List
router.get('/admins', verifyAdminToken, (req, res) => {
    const db = resolveDb(req, res);
    if (!db) return;
    const query = `
        SELECT a.id, a.user_id, c.email, c.first_name, c.last_name, c.mobile,
               r.role_name, a.is_active, a.created_at
        FROM admins a
        JOIN candidates c ON a.user_id = c.id
        JOIN roles r ON a.role_id = r.id
        ORDER BY a.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json({ admins: results });
    });
});

export default router;
export { checkAdminAccess };
