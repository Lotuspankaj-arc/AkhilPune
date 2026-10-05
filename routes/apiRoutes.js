/**
 * apiRoutes.js
 * 
 * Multi-tenant event registration API routes
 * Integrates all controllers with RBAC middleware
 * 
 * Usage in main Server.js:
 * import apiRoutes from './routes/apiRoutes.js';
 * app.use('/api', apiRoutes);
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { table } from '../mysqlDb.js';

// Controllers
import candidateController from '../controllers/candidateController.js';
import candidateFeedController from '../controllers/candidateFeedController.js';
import clientController from '../controllers/clientController.js';
import eventsController from '../controllers/eventsController.js';

// Middleware
import {
  requireSuperuser,
  requireClientAdmin,
  requirePermission,
  requireActiveSubscription,
  requireCandidateAuth,
  requireCandidateProfileOwner,
  optionalBearerToken,
  verifyEventClient,
  auditLog,
} from '../middleware/rbacMiddleware.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ==========================================
// CANDIDATE REGISTRATION ROUTES
// ==========================================

/**
 * Register new candidate or check if exists
 * POST /api/candidates/register
 */
router.post('/candidates/register', (_req, res) => res.status(410).json({
  success: false,
  message: 'This legacy registration endpoint is no longer available. Use the current registration flow.'
}));

/**
 * Lookup candidate by mobile number (for auto-fill)
 * GET /api/candidates/lookup?mobile=9876543210
 */
router.get('/candidates/lookup', requireCandidateAuth, candidateController.lookupCandidate);

/**
 * Link existing candidate to new event
 * POST /api/candidates/:batchId/link-event
 */
router.post(
  '/candidates/:batch_id/link-event',
  requireCandidateAuth,
  requireCandidateProfileOwner,
  verifyEventClient,
  candidateController.linkCandidateToEvent
);

/**
 * Get candidate profile by batch ID
 * GET /api/candidates/:batchId
 */
router.get('/candidates/:batch_id', requireCandidateAuth, requireCandidateProfileOwner, candidateController.getCandidateById);

// ==========================================
// CANDIDATE FEED & BROWSING ROUTES
// ==========================================

/**
 * Get candidate feed (cross-event, with subscription checks)
 * GET /api/feed/candidates?clientId=1&eventId=1&batchId=123
 */
router.get(
  '/feed/candidates',
  requireCandidateAuth,
  requireActiveSubscription,
  candidateFeedController.getCandidateFeed
);

/**
 * Like a candidate
 * POST /api/feed/like
 */
router.post('/feed/like', requireCandidateAuth, candidateFeedController.likeCandidate);

/**
 * Shortlist a candidate
 * POST /api/feed/shortlist
 */
router.post('/feed/shortlist', requireCandidateAuth, candidateFeedController.shortlistCandidate);

/**
 * Get candidate matches (mutual likes/shortlists)
 * GET /api/feed/matches?batchId=123&clientId=1
 */
router.get(
  '/feed/matches',
  requireCandidateAuth,
  requireActiveSubscription,
  candidateFeedController.getCandidateMatches
);

/**
 * Check subscription status
 * GET /api/subscriptions/status?batchId=123
 */
router.get('/subscriptions/status', requireCandidateAuth, candidateFeedController.checkSubscriptionStatus);

// ==========================================
// EVENTS ROUTES
// ==========================================

router.get('/events/active-banner', async (_req, res) => {
  try {
    const events = table('events')
      .find((event) => event.is_active)
      .sort((first, second) => new Date(second.start_date || 0) - new Date(first.start_date || 0));

    if (events.length === 0) return res.status(404).json({ error: 'No active event found' });

    const event = events[0];
    const client = table('clients').findOne((item) => String(item.client_id) === String(event.client_id));
    const cutoffDate = event.registration_cutoff_date ? new Date(event.registration_cutoff_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return res.json({
      event: {
        eventId: event.event_id,
        eventName: event.event_name,
        startDate: event.start_date,
        endDate: event.end_date,
        cutoffDate: event.registration_cutoff_date,
        venue: event.venue,
        eventTime: event.event_time || '9:00 AM to 5:00 PM',
        organizerName: event.organizer_name,
        organizerPhone: event.organizer_phone,
        communityName: client?.client_name || '',
        officeAddress: event.office_address || client?.address || '',
        officePhone: event.organizer_phone || client?.phone_number || '',
        registrationOpen: cutoffDate ? cutoffDate >= today : false,
        organizerPhoto: event.organizer_photo,
        registrationBannerPath: event.registration_banner_path
      }
    });
  } catch (error) {
    console.error('Active banner fetch error:', error);
    return res.status(500).json({ error: 'Failed to load active event banner' });
  }
});

/**
 * Resolve public event registration URL by readable names
 * GET /api/events/registration/:clientSlug/:eventSlug
 */
router.get('/events/registration/:clientSlug/:eventSlug', eventsController.getEventByRegistrationSlug);

/**
 * Get event by ID
 * GET /api/events/:eventId?clientId=1
 */
router.get('/events/:eventId', eventsController.getEvent);

/**
 * Create new event (Client Admin or Superuser)
 * POST /api/events
 */
router.post(
  '/events',
  requireClientAdmin,
  requirePermission('can_generate_links'),
  auditLog('create_event'),
  eventsController.createEvent
);

/**
 * Update event
 * PUT /api/events/:eventId
 */
router.put(
  '/events/:eventId',
  requireClientAdmin,
  auditLog('update_event'),
  eventsController.updateEvent
);

/**
 * Get all events for a client
 * GET /api/clients/:clientId/events?includeInactive=true
 */
router.get(
  '/clients/:clientId/events',
  requireClientAdmin,
  eventsController.getClientEvents
);

/**
 * Get public registration link for event
 * GET /api/events/:eventId/registration-link
 */
router.get('/events/:eventId/registration-link', eventsController.getRegistrationLink);

// ==========================================
// CLIENT ROUTES (Superuser & Client Admin)
// ==========================================

/**
 * Get client details
 * GET /api/clients/:clientId
 */
router.get('/clients/:clientId', optionalBearerToken, clientController.getClient);

/**
 * Create new client (Superuser only)
 * POST /api/clients
 */
router.post(
  '/clients',
  requireSuperuser,
  auditLog('create_client'),
  clientController.createClient
);

/**
 * Update client details (Superuser only)
 * PUT /api/clients/:clientId
 */
router.put(
  '/clients/:clientId',
  requireSuperuser,
  auditLog('update_client'),
  clientController.updateClient
);

router.put(
  '/clients/:clientId/homepage',
  requireClientAdmin,
  auditLog('update_homepage'),
  clientController.updateHomepageContent
);

router.post(
  '/clients/:clientId/logo',
  requireSuperuser,
  upload.single('logo'),
  clientController.uploadClientLogo
);

/**
 * Get all clients (Superuser only)
 * GET /api/clients
 */
router.get('/clients', requireSuperuser, clientController.getAllClients);

/**
 * Subscription plan catalog and client assignment (Super User only)
 */
router.get('/subscription-plans', requireSuperuser, clientController.getSubscriptionPlans);
router.post('/subscription-plans', requireSuperuser, auditLog('create_subscription_plan'), clientController.createSubscriptionPlan);
router.put('/subscription-plans/:planId', requireSuperuser, auditLog('update_subscription_plan'), clientController.updateSubscriptionPlan);
router.get('/clients/:clientId/subscription', requireSuperuser, clientController.getClientSubscription);
router.put('/clients/:clientId/subscription', requireSuperuser, auditLog('assign_client_subscription'), clientController.assignClientSubscription);

/**
 * Update client core committee
 * PUT /api/clients/:clientId/committee
 */
router.put(
  '/clients/:clientId/committee',
  requireClientAdmin,
  auditLog('update_committee'),
  clientController.updateCommittee
);

/**
 * Assign admin to client (Superuser only)
 * POST /api/clients/:clientId/assign-admin
 */
router.post(
  '/clients/:clientId/assign-admin',
  requireSuperuser,
  auditLog('assign_admin'),
  clientController.assignAdminToClient
);

/**
 * Get client admins
 * GET /api/clients/:clientId/admins
 */
router.get(
  '/clients/:clientId/admins',
  requireClientAdmin,
  clientController.getClientAdmins
);

// ==========================================
// ERROR HANDLING
// ==========================================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({
        success: false,
        message: 'File size exceeds 5MB limit',
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Request could not be processed.',
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next();
});

export default router;
