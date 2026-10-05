/**
 * candidateFeedController.js
 * 
 * Purpose: Candidate browsing feed with cross-event visibility
 * 
 * Key Features:
 * - Cross-event deduplication: Candidates see matches from all their registered events
 * - Subscription expiry checks: 6-month access window validation
 * - RBAC enforcement: Superusers vs client admins
 * - Interaction tracking: Likes, shortlists, and candidate-to-candidate visibility
 */

import db from '../mysqlDb.js';

const hasSharedActiveEvent = async (fromCandidateId, toCandidateId) => {
  const sharedEvent = await db.query(
    `SELECT cer_from.event_id
     FROM candidate_event_registrations cer_from
     INNER JOIN candidate_event_registrations cer_to
       ON cer_to.event_id = cer_from.event_id
      AND cer_to.client_id = cer_from.client_id
      AND cer_to.is_active = TRUE
     INNER JOIN subscriptions sub_from
       ON sub_from.batch_id = cer_from.batch_id
      AND sub_from.event_id = cer_from.event_id
      AND sub_from.client_id = cer_from.client_id
      AND sub_from.is_active = TRUE
      AND sub_from.access_expiry_date >= NOW()
     INNER JOIN subscriptions sub_to
       ON sub_to.batch_id = cer_to.batch_id
      AND sub_to.event_id = cer_to.event_id
      AND sub_to.client_id = cer_to.client_id
      AND sub_to.is_active = TRUE
      AND sub_to.access_expiry_date >= NOW()
     WHERE cer_from.batch_id = ? AND cer_to.batch_id = ? AND cer_from.is_active = TRUE
     LIMIT 1`,
    [fromCandidateId, toCandidateId]
  );
  return sharedEvent.length > 0;
};

/**
 * Get candidate feed for browsing (cross-event, deduplicated)
 * GET /api/feed/candidates?clientId=:clientId&eventId=:eventId&batchId=:batchId
 * 
 * Returns:
 * - Unique list of candidates from all events the user is registered for
 * - Filtered by gender (opposite to logged-in candidate)
 * - Excludes candidates with expired subscriptions
 * - Excludes self
 * - Sorted by registration date (newest first)
 * 
 * Accessibility Rules:
 * - Candidate 1 registered for Event 1 only → sees Event 1 profiles
 * - Candidate 1 registered for Event 1 + Event 2 → sees merged Event 1 + Event 2 profiles (no duplicates)
 */
export const getCandidateFeed = async (req, res) => {
  try {
    const { clientId, eventId } = req.query;
    const batchId = req.userId;

    if (!clientId || !batchId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: clientId, batchId',
      });
    }

    // Step 1: Verify candidate exists and has active subscription(s)
    const candidateCheck = await db.query(
      `SELECT c.batch_id, c.gender, c.first_name, c.mobile_number
       FROM candidates c
      JOIN subscriptions s ON c.batch_id = s.batch_id
      JOIN events e ON e.event_id = s.event_id AND e.client_id = s.client_id
      WHERE c.batch_id = ? AND s.client_id = ? AND s.is_active = TRUE AND s.access_expiry_date >= NOW()
       LIMIT 1`,
      [batchId, clientId]
    );

    if (candidateCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No active subscriptions found or subscription expired.',
      });
    }

    const loggedInCandidate = candidateCheck[0];
    const oppositeGender = loggedInCandidate.gender === 'Bride' ? 'Groom' : 'Bride';

    // Step 2: Get all events this candidate is registered for (within same client)
    const candidateEvents = await db.query(
      `SELECT DISTINCT cer.event_id
       FROM candidate_event_registrations cer
       JOIN subscriptions s ON cer.batch_id = s.batch_id AND cer.event_id = s.event_id
      JOIN events e ON e.event_id = cer.event_id AND e.client_id = cer.client_id
       WHERE cer.batch_id = ? AND cer.client_id = ? 
         AND cer.is_active = TRUE
         AND s.is_active = TRUE
         AND s.access_expiry_date >= NOW()`,
      [batchId, clientId]
    );

    if (candidateEvents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active events found',
        data: [],
      });
    }

    const eventIds = candidateEvents.map((e) => e.event_id);
    const eventPlaceholders = eventIds.map(() => '?').join(',');

    // Step 3: COMPLEX QUERY - Get unique candidates from all registered events
    // This implements cross-event deduplication
    const query = `
      SELECT DISTINCT
        c.batch_id,
        c.first_name,
        c.middle_name,
        c.last_name,
        c.gender,
        c.education_qualification,
        c.education_details,
        c.job_business_title,
        c.job_business_location,
        c.height,
        c.complexion,
        c.blood_group,
        c.gotra,
        c.kul,
        c.zodiac,
        c.selected_expectations,
        c.photo_path,
        c.registration_date,
        cer.event_id,
        cer.client_id,
        s.access_expiry_date,
        CASE WHEN s.is_active = TRUE AND s.access_expiry_date >= NOW() THEN 'active' ELSE 'expired' END AS subscription_status,
        COALESCE(ci.is_liked, FALSE) AS user_liked_this,
        COALESCE(ci.is_shortlisted, FALSE) AS user_shortlisted_this,
        COALESCE(reverse_ci.is_liked, FALSE) AS this_user_liked_me
      FROM candidates c
      INNER JOIN candidate_event_registrations cer 
        ON c.batch_id = cer.batch_id
      INNER JOIN subscriptions s 
        ON c.batch_id = s.batch_id AND cer.event_id = s.event_id
      INNER JOIN events e
        ON e.event_id = cer.event_id AND e.client_id = cer.client_id
      LEFT JOIN candidate_interactions ci
        ON ci.from_candidate_id = ? AND ci.to_candidate_id = c.batch_id
      LEFT JOIN candidate_interactions reverse_ci
        ON reverse_ci.from_candidate_id = c.batch_id AND reverse_ci.to_candidate_id = ?
      WHERE c.gender = ?
        AND c.batch_id != ?
        AND cer.event_id IN (${eventPlaceholders})
        AND cer.client_id = ?
        AND cer.is_active = TRUE
        AND c.is_active = TRUE
        AND s.is_active = TRUE
        AND s.access_expiry_date >= NOW()
      ORDER BY c.registration_date DESC
      LIMIT 100
    `;

    const params = [
      batchId, // for ci.from_candidate_id
      batchId, // for reverse_ci.from_candidate_id
      oppositeGender, // gender filter
      batchId, // exclude self
      ...eventIds,
      clientId,
    ];

    const candidates = await db.query(query, params);

    // Parse JSON expectations
    const enrichedCandidates = candidates.map((candidate) => {
      if (candidate.selected_expectations) {
        try {
          candidate.selected_expectations = JSON.parse(candidate.selected_expectations);
        } catch (e) {
          candidate.selected_expectations = [];
        }
      }
      return candidate;
    });

    res.status(200).json({
      success: true,
      message: `Found ${enrichedCandidates.length} candidates`,
      data: enrichedCandidates,
      stats: {
        total_events_registered: eventIds.length,
        total_candidates: enrichedCandidates.length,
      },
    });
  } catch (error) {
    console.error('Error fetching candidate feed:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate feed',
    });
  }
};

/**
 * Like/Unlike a candidate
 * POST /api/feed/like
 * 
 * Body: { from_batch_id, to_batch_id, is_liked }
 */
export const likeCandidate = async (req, res) => {
  try {
    const { to_batch_id, is_liked } = req.body;

    if (!to_batch_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const fromCandidateId = req.userId;
    if (String(fromCandidateId) === String(to_batch_id)) {
      return res.status(400).json({ success: false, message: 'You cannot interact with your own profile.' });
    }
    const targetCandidate = await db.query(
      'SELECT batch_id FROM candidates WHERE batch_id = ? AND is_active = TRUE',
      [to_batch_id]
    );
    if (targetCandidate.length === 0 || !(await hasSharedActiveEvent(fromCandidateId, to_batch_id))) {
      return res.status(403).json({ success: false, message: 'This profile is not available for interaction.' });
    }

    // Insert or update interaction for the authenticated candidate only.
    const query = `
      INSERT INTO candidate_interactions (from_candidate_id, to_candidate_id, is_liked)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_liked = VALUES(is_liked), updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(query, [fromCandidateId, to_batch_id, is_liked === true || is_liked === 'true']);

    res.status(200).json({
      success: true,
      message: is_liked ? 'Candidate liked' : 'Like removed',
    });
  } catch (error) {
    console.error('Error liking candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating like status',
    });
  }
};

/**
 * Shortlist a candidate
 * POST /api/feed/shortlist
 * 
 * Body: { from_batch_id, to_batch_id, is_shortlisted }
 */
export const shortlistCandidate = async (req, res) => {
  try {
    const { to_batch_id, is_shortlisted } = req.body;

    if (!to_batch_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const fromCandidateId = req.userId;
    if (String(fromCandidateId) === String(to_batch_id)) {
      return res.status(400).json({ success: false, message: 'You cannot interact with your own profile.' });
    }
    const targetCandidate = await db.query(
      'SELECT batch_id FROM candidates WHERE batch_id = ? AND is_active = TRUE',
      [to_batch_id]
    );
    if (targetCandidate.length === 0 || !(await hasSharedActiveEvent(fromCandidateId, to_batch_id))) {
      return res.status(403).json({ success: false, message: 'This profile is not available for interaction.' });
    }

    const query = `
      INSERT INTO candidate_interactions (from_candidate_id, to_candidate_id, is_shortlisted)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_shortlisted = VALUES(is_shortlisted), updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(query, [fromCandidateId, to_batch_id, is_shortlisted === true || is_shortlisted === 'true']);

    res.status(200).json({
      success: true,
      message: is_shortlisted ? 'Candidate shortlisted' : 'Shortlist removed',
    });
  } catch (error) {
    console.error('Error shortlisting candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shortlist status',
    });
  }
};

/**
 * Get candidate matches (mutual likes or shortlists)
 * GET /api/feed/matches?batchId=:batchId&clientId=:clientId
 */
export const getCandidateMatches = async (req, res) => {
  try {
    const { clientId } = req.query;
    const batchId = req.userId;

    if (!batchId || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters',
      });
    }

    // Verify active subscription
    const subCheck = await db.query(
      `SELECT subscription_id FROM subscriptions
       WHERE batch_id = ? AND client_id = ? AND is_active = TRUE AND access_expiry_date >= NOW()`,
      [batchId, clientId]
    );

    if (subCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No active subscription.',
      });
    }

    // Mutual likes: Both candidates liked each other
    const query = `
      SELECT DISTINCT
        c.batch_id,
        c.first_name,
        c.last_name,
        c.gender,
        c.education_qualification,
        c.job_business_title,
        c.height,
        c.photo_path,
        ci1.is_liked AS candidate_liked_me,
        ci2.is_liked AS i_liked_candidate,
        CASE 
          WHEN ci1.is_liked AND ci2.is_liked THEN 'mutual_like'
          WHEN ci1.is_liked THEN 'they_liked_me'
          WHEN ci2.is_liked THEN 'i_liked_them'
          ELSE 'no_interaction'
        END AS match_status
      FROM candidates c
      LEFT JOIN candidate_interactions ci1 
        ON ci1.from_candidate_id = c.batch_id AND ci1.to_candidate_id = ? AND ci1.is_liked = TRUE
      LEFT JOIN candidate_interactions ci2 
        ON ci2.from_candidate_id = ? AND ci2.to_candidate_id = c.batch_id AND ci2.is_liked = TRUE
      WHERE (ci1.is_liked = TRUE OR ci2.is_liked = TRUE)
        AND c.batch_id != ?
        AND EXISTS (
          SELECT 1
          FROM candidate_event_registrations viewer_cer
          INNER JOIN candidate_event_registrations target_cer
            ON target_cer.event_id = viewer_cer.event_id
           AND target_cer.client_id = viewer_cer.client_id
           AND target_cer.batch_id = c.batch_id
           AND target_cer.is_active = TRUE
          INNER JOIN subscriptions viewer_sub
            ON viewer_sub.batch_id = viewer_cer.batch_id
           AND viewer_sub.event_id = viewer_cer.event_id
           AND viewer_sub.client_id = viewer_cer.client_id
           AND viewer_sub.is_active = TRUE
           AND viewer_sub.access_expiry_date >= NOW()
          INNER JOIN subscriptions target_sub
            ON target_sub.batch_id = target_cer.batch_id
           AND target_sub.event_id = target_cer.event_id
           AND target_sub.client_id = target_cer.client_id
           AND target_sub.is_active = TRUE
           AND target_sub.access_expiry_date >= NOW()
          WHERE viewer_cer.batch_id = ?
            AND viewer_cer.client_id = ?
            AND viewer_cer.is_active = TRUE
        )
      ORDER BY ci1.created_at DESC
      LIMIT 50
    `;

    const matches = await db.query(query, [batchId, batchId, batchId, batchId, clientId]);

    res.status(200).json({
      success: true,
      data: matches,
      total: matches.length,
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching matches',
    });
  }
};

/**
 * Check subscription status
 * GET /api/subscriptions/status?batchId=:batchId&eventId=:eventId
 */
export const checkSubscriptionStatus = async (req, res) => {
  try {
    const { eventId } = req.query;
    const batchId = req.userId;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Missing batchId',
      });
    }

    const subscription = await db.query(
      `SELECT 
        subscription_id,
        batch_id,
        event_id,
        client_id,
        registration_date,
        access_expiry_date,
        is_active,
        CASE
          WHEN access_expiry_date >= NOW() THEN 'active'
          ELSE 'expired'
        END AS status,
        DATEDIFF(access_expiry_date, NOW()) AS days_remaining
       FROM subscriptions
       WHERE batch_id = ? ${eventId ? 'AND event_id = ?' : ''}
       ORDER BY access_expiry_date DESC`,
      eventId ? [batchId, eventId] : [batchId]
    );

    if (subscription.length === 0) {
      return res.status(200).json({
        success: true,
        status: 'no_subscription',
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      status: subscription[0].status,
      data: subscription,
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
    });
  }
};

export default {
  getCandidateFeed,
  likeCandidate,
  shortlistCandidate,
  getCandidateMatches,
  checkSubscriptionStatus,
};
