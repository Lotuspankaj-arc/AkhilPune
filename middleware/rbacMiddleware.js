/**
 * rbacMiddleware.js
 * 
 * Role-Based Access Control Middleware
 * 
 * Roles:
 * - Superuser: Can manage all clients, events, and system
 * - Client Admin: Can only manage their assigned client
 */

import jwt from 'jsonwebtoken';
import db from '../mysqlDb.js';

const ROLE_SUPER_USER = 'super_user';
const ROLE_ADMIN = 'admin';
const ROLE_CANDIDATE = 'candidate';

const normalizeRoleName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'user' ? ROLE_CANDIDATE : normalized;
};

const getJwtSecret = () => process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev_secret');

const readBearerPayload = (req) => {
  const authorization = String(req.headers.authorization || '');
  if (!/^Bearer\s+[^\s]+$/i.test(authorization)) return null;

  const token = authorization.replace(/^Bearer\s+/i, '');
  const secret = getJwtSecret();
  if (!secret) return null;

  try {
    return jwt.verify(token, secret);
  } catch (_) {
    return null;
  }
};

export const optionalBearerToken = (req, _res, next) => {
  const payload = readBearerPayload(req);
  if (payload) {
    req.user = payload;
    req.userId = payload.id;
    req.role = normalizeRoleName(payload.role);
  }
  next();
};

export const requireCandidateAuth = async (req, res, next) => {
  const payload = readBearerPayload(req);
  if (!payload) return res.status(401).json({ error: 'Missing or invalid access token' });

  try {
    const candidates = await db.query(
      `SELECT c.batch_id, ac.is_active AS credential_active, r.role_name, r.is_active AS role_active
       FROM candidates c
       INNER JOIN auth_credentials ac ON ac.user_id = c.batch_id
       INNER JOIN roles r ON r.role_id = ac.role_id
       WHERE c.batch_id = ? AND c.is_active = TRUE
       LIMIT 1`,
      [payload.id]
    );
    const candidate = candidates[0];
    if (!candidate || !candidate.credential_active || !candidate.role_active || normalizeRoleName(candidate.role_name) !== ROLE_CANDIDATE) {
      return res.status(401).json({ error: 'Candidate account is unavailable' });
    }

    req.user = { ...payload, role: ROLE_CANDIDATE };
    req.userId = payload.id;
    req.role = ROLE_CANDIDATE;
    res.set('Cache-Control', 'no-store');
    return next();
  } catch (error) {
    console.error('Candidate authentication error:', error);
    return res.status(500).json({ error: 'Authentication could not be verified' });
  }
};

export const requireCandidateProfileOwner = (req, res, next) => {
  if (String(req.userId) !== String(req.params?.batch_id)) {
    return res.status(403).json({ error: 'You can only access your own candidate profile' });
  }
  return next();
};

const redactAuditPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(redactAuditPayload);

  return Object.fromEntries(Object.entries(payload).map(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    const isSensitive = normalizedKey.includes('password') ||
      normalizedKey.includes('secret') ||
      normalizedKey.includes('private_key') ||
      normalizedKey.includes('photo_data') ||
      normalizedKey.includes('payment_details') ||
      normalizedKey.includes('razorpay_payment_id') ||
      normalizedKey.includes('razorpay_order_id') ||
      normalizedKey.includes('signature') ||
      normalizedKey.endsWith('_token') ||
      normalizedKey === 'token';
    return [key, isSensitive ? '[REDACTED]' : redactAuditPayload(value)];
  }));
};

const getAuthenticatedAdminId = (req) => {
  const existingRole = normalizeRoleName(req.user?.role);
  if (req.user?.id && [ROLE_SUPER_USER, ROLE_ADMIN].includes(existingRole)) return req.user.id;

  const decoded = readBearerPayload(req);
  const role = normalizeRoleName(decoded?.role);
  if (!decoded?.id || ![ROLE_SUPER_USER, ROLE_ADMIN].includes(role)) return null;

  req.user = decoded;
  req.userId = decoded.id;
  req.role = role;
  return decoded.id;
};

/**
 * Middleware: Check if user is a superuser
 * Usage: router.post('/admin/clients', requireSuperuser, controller.createClient)
 */
export const requireSuperuser = async (req, res, next) => {
  try {
    const adminId = getAuthenticatedAdminId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Missing admin authentication',
      });
    }

    const admin = await db.query(
      'SELECT admin_id, is_super_user FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [adminId]
    );

    if (admin.length === 0 || !admin[0].is_super_user) {
      return res.status(403).json({
        success: false,
        message: 'Superuser access required',
      });
    }

    req.admin = admin[0];
    next();
  } catch (error) {
    console.error('Error in requireSuperuser middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Middleware: Check if user is a client admin for specific client
 * Usage: router.get('/clients/:clientId/events', requireClientAdmin, controller.getEvents)
 */
export const requireClientAdmin = async (req, res, next) => {
  try {
    const adminId = getAuthenticatedAdminId(req);
    const clientId = req.params?.clientId || req.body?.clientId || req.body?.client_id || req.query?.clientId;

    if (!adminId || !clientId) {
      return res.status(401).json({
        success: false,
        message: 'Missing authentication or client ID',
      });
    }

    // Check if admin is superuser (superusers can access everything)
    const admin = await db.query(
      'SELECT admin_id, is_super_user FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [adminId]
    );

    if (admin.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    if (admin[0].is_super_user) {
      req.admin = admin[0];
      return next();
    }

    // Check if admin is mapped to this client
    const mapping = await db.query(
      `SELECT mapping_id, can_view_forms, can_generate_links, can_view_registrations
       FROM client_admin_mapping
       WHERE admin_id = ? AND client_id = ? AND is_active = TRUE`,
      [adminId, clientId]
    );

    if (mapping.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Not authorized for this client.',
      });
    }

    const activePlan = await db.query(
      `SELECT cs.client_subscription_id, cs.plan_id, cs.starts_at, cs.ends_at,
              sp.plan_name, sp.max_active_events, sp.max_candidates
       FROM client_subscriptions cs
       INNER JOIN subscription_plans sp ON sp.plan_id = cs.plan_id
       WHERE cs.client_id = ? AND cs.status = 'active' AND sp.is_active = TRUE
         AND cs.starts_at <= CURRENT_TIMESTAMP
         AND (cs.ends_at IS NULL OR cs.ends_at >= CURRENT_TIMESTAMP)
       ORDER BY cs.starts_at DESC, cs.client_subscription_id DESC
       LIMIT 1`,
      [clientId]
    );
    if (activePlan.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Client subscription plan is inactive or expired.',
      });
    }

    req.admin = admin[0];
    req.adminPermissions = mapping[0];
    req.clientSubscription = activePlan[0];
    next();
  } catch (error) {
    console.error('Error in requireClientAdmin middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error',
    });
  }
};

/**
 * Middleware: Verify specific permission for client admin
 * Usage: router.post('/forms', requirePermission('can_generate_links'), controller.generateForm)
 */
export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const adminId = getAuthenticatedAdminId(req);
      const clientId = req.params?.clientId || req.body?.clientId || req.body?.client_id || req.query?.clientId;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: 'Missing admin authentication',
        });
      }

      // Superusers bypass permission checks
      const admin = await db.query(
        'SELECT is_super_user FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
        [adminId]
      );

      if (admin.length > 0 && admin[0].is_super_user) {
        return next();
      }

      // Check client admin permissions
      if (clientId) {
        const mapping = await db.query(
          `SELECT ${permissionName} FROM client_admin_mapping
           WHERE admin_id = ? AND client_id = ? AND is_active = TRUE`,
          [adminId, clientId]
        );

        if (mapping.length === 0 || !mapping[0][permissionName]) {
          return res.status(403).json({
            success: false,
            message: `Permission denied. Required: ${permissionName}`,
          });
        }
      }

      next();
    } catch (error) {
      console.error('Error in requirePermission middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check error',
      });
    }
  };
};

/**
 * Middleware: Verify candidate subscription is active
 * Usage: router.get('/feed', requireActiveSubscription, controller.getCandidateFeed)
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const { clientId, eventId } = req.query;
    const requestedBatchId = req.query.batchId;
    const isCandidate = normalizeRoleName(req.user?.role) === ROLE_CANDIDATE;
    const batchId = isCandidate ? req.userId : requestedBatchId;

    if (!batchId || !clientId || (isCandidate && requestedBatchId && String(requestedBatchId) !== String(req.userId))) {
      return res.status(400).json({
        success: false,
        message: 'Missing batchId or clientId',
      });
    }

    let query = `
      SELECT subscription_id, access_expiry_date
      FROM subscriptions
      WHERE batch_id = ? AND client_id = ? AND is_active = TRUE AND access_expiry_date >= NOW()
    `;
    const params = [batchId, clientId];

    if (eventId) {
      query += ' AND event_id = ?';
      params.push(eventId);
    }

    const subscription = await db.query(query, params);

    if (subscription.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription. Please register for an event.',
      });
    }

    req.subscription = subscription[0];
    next();
  } catch (error) {
    console.error('Error in requireActiveSubscription middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Subscription verification error',
      error: error.message,
    });
  }
};

/**
 * Middleware: Verify event belongs to client
 * Usage: router.post('/events/:eventId/register', verifyEventClient, controller.register)
 */
export const verifyEventClient = async (req, res, next) => {
  try {
    const eventId = req.params?.eventId || req.query?.eventId || req.body?.event_id;
    const source = req.query && Object.keys(req.query).length > 0 ? req.query : req.body;
    const clientId = source?.clientId || source?.client_id;

    if (!eventId || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'Missing eventId or clientId',
      });
    }

    const event = await db.query(
      'SELECT event_id, client_id FROM events WHERE event_id = ? AND client_id = ? AND is_active = TRUE',
      [eventId, clientId]
    );

    if (event.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or does not belong to this client',
      });
    }

    req.event = event[0];
    next();
  } catch (error) {
    console.error('Error in verifyEventClient middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Event verification error',
    });
  }
};

/**
 * Middleware: Log admin actions for audit trail
 * Usage: router.post('/admin/...', auditLog('create_client'), controller.create)
 */
export const auditLog = (actionType) => {
  return async (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
      // Log only on success (status < 400)
      if (res.statusCode < 400 && req.admin?.admin_id) {
        const adminId = req.admin.admin_id;
        const tableName = req.params?.eventId ? 'events' : 
                          req.params?.clientId ? 'clients' : 
                          'admin_actions';
        const recordId = req.params?.eventId || req.params?.clientId || null;

        db.query(
          `INSERT INTO activity_logs (admin_id, action, table_name, record_id, new_values)
           VALUES (?, ?, ?, ?, ?)`,
          [adminId, actionType, tableName, recordId, JSON.stringify(redactAuditPayload(req.body))],
          (err) => {
            if (err) console.error('Error logging action:', err);
          }
        );
      }

      res.send = originalSend;
      return res.send(data);
    };

    next();
  };
};

