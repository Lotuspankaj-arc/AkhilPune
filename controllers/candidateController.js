/**
 * Backend Controllers for Multi-Tenant Event Registration Platform
 * 
 * Files:
 * 1. candidateController.js - Registration, lookup, and event linking
 * 2. candidateFeedController.js - Cross-event visibility with subscription checks
 * 3. clientController.js - Client data management
 * 4. eventsController.js - Event management with client validation
 * 5. rbacMiddleware.js - Role-based access control
 */

// ==========================================
// 1. candidateController.js
// ==========================================

import db from '../mysqlDb.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const SAFE_CANDIDATE_FIELDS = [
  'batch_id', 'event_id', 'email', 'first_name', 'middle_name', 'last_name', 'gender', 'marriage_type',
  'address_line', 'pincode', 'city_village', 'tehsil', 'district', 'state', 'mobile_number',
  'whatsapp_number', 'height', 'complexion', 'education_qualification', 'education_details',
  'education_category', 'job_business_title', 'annual_income', 'job_business_location', 'mamekul',
  'birth_date', 'birth_time', 'birth_place', 'blood_group', 'gotra', 'kul', 'zodiac', 'gan', 'nadi',
  'charan', 'nakshatra', 'selected_expectations', 'other_expectations', 'photo_path',
  'attended_active_event', 'registration_date', 'updated_at', 'is_active'
];

const serializeCandidate = (candidate) => Object.fromEntries(
  SAFE_CANDIDATE_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(candidate || {}, field))
    .map((field) => [field, candidate[field]])
);

const getRegisteredEvents = async (batchId) => db.query(
  `SELECT cer.event_id, e.event_name, e.client_id, cer.event_registration_code,
          cer.registration_date, e.start_date, e.end_date
   FROM candidate_event_registrations cer
   INNER JOIN events e ON e.event_id = cer.event_id
   WHERE cer.batch_id = ? AND cer.is_active = TRUE
   ORDER BY cer.registration_date DESC, cer.registration_id DESC`,
  [batchId]
);

/**
 * Register a new candidate or link existing candidate to event
 * POST /api/candidates/register
 * 
 * Handles:
 * - New candidate registration with event linking
 * - Photo upload
 * - Subscription creation with 6-month access window
 */
export const registerCandidate = async (req, res) => {
  try {
    const {
      mobile_number,
      first_name,
      middle_name,
      last_name,
      email,
      gender,
      marriage_type,
      birth_date,
      birth_place,
      height,
      education_qualification,
      education_details,
      job_business_title,
      annual_income,
      job_business_location,
      complexion,
      blood_group,
      gotra,
      kul,
      zodiac,
      gan,
      nadi,
      nakshatra,
      charan,
      address_line,
      pincode,
      city_village,
      tehsil,
      district,
      state,
      whatsapp_number,
      selected_expectations,
      other_expectations,
      consent_agreed,
      NULL,
      client_id,
      event_id,
    } = req.body;

    // Validation
    if (!mobile_number || !first_name || !gender || !marriage_type || !event_id || !client_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Verify event belongs to client and is active
    const eventCheck = await db.query(
      'SELECT event_id FROM events WHERE event_id = ? AND client_id = ? AND is_active = TRUE',
      [event_id, client_id]
    );

    if (eventCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or is inactive',
      });
    }

    let photoPath = null;
    let photoMimeType = null;
    let photoData = null;

    // Handle photo upload
    if (req.file) {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${uuidv4()}-${Date.now()}${path.extname(req.file.originalname)}`;
      const filepath = path.join(uploadDir, filename);

      // Save file to disk
      await fs.promises.writeFile(filepath, req.file.buffer);

      photoPath = `uploads/${filename}`;
      photoMimeType = req.file.mimetype;
      photoData = req.file.buffer;
    }

    // Parse expectations JSON if provided as string
    let expectationsJson = null;
    if (selected_expectations) {
      expectationsJson = typeof selected_expectations === 'string' 
        ? JSON.parse(selected_expectations)
        : selected_expectations;
    }

    // Insert new candidate
    const insertQuery = `
      INSERT INTO candidates (
        event_id,
        marriage_type,
        gender,
        first_name,
        middle_name,
        last_name,
        address_line,
        pincode,
        city_village,
        tehsil,
        district,
        state,
        mobile_number,
        whatsapp_number,
        height,
        education_qualification,
        education_details,
        job_business_title,
        annual_income,
        job_business_location,
        birth_date,
        birth_place,
        complexion,
        blood_group,
        gotra,
        kul,
        zodiac,
        gan,
        nadi,
        nakshatra,
        charan,
        selected_expectations,
        other_expectations,
        photo_path,
        photo_mime_type,
        photo_data,
        email,
        consent_agreed,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      null,
      marriage_type,
      gender,
      first_name,
      middle_name || null,
      last_name || null,
      address_line,
      pincode,
      city_village || null,
      tehsil || null,
      district || null,
      state || null,
      mobile_number,
      whatsapp_number || mobile_number,
      height || null,
      education_qualification || null,
      education_details || null,
      job_business_title || null,
      annual_income || null,
      job_business_location || null,
      birth_date || null,
      birth_place || null,
      complexion || null,
      blood_group || null,
      gotra || null,
      kul || null,
      zodiac || null,
      gan || null,
      nadi || null,
      nakshatra || null,
      charan || null,
      expectationsJson ? JSON.stringify(expectationsJson) : null,
      other_expectations || null,
      photoPath,
      photoMimeType,
      photoData,
      email || null,
      consent_agreed === true || consent_agreed === 'true',
      true,
    ];

    const result = await db.query(insertQuery, values);
    const batch_id = result.insertId;

    // Candidate profile is independent from event membership. Keep the
    // event_id value for legacy readers, but use normalized mapping tables.
    const now = new Date();
    await db.query(
      `CALL sp_link_candidate_to_event(?, ?, ?, ?)`,
      [batch_id, event_id, client_id, now]
    );

    const subscription = await db.query(
      `SELECT access_expiry_date FROM subscriptions WHERE batch_id = ? AND event_id = ?`,
      [batch_id, event_id]
    );
    const expiryDate = subscription[0]?.access_expiry_date || null;

    res.status(201).json({
      success: true,
      message: 'Candidate registered successfully',
      batch_id,
      subscription_expiry: expiryDate,
    });
  } catch (error) {
    console.error('Error registering candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering candidate',
    });
  }
};

/**
 * Lookup candidate by mobile number
 * GET /api/candidates/lookup?mobile=9876543210
 * 
 * Returns: Existing candidate data for auto-fill
 */
export const lookupCandidate = async (req, res) => {
  try {
    const { mobile } = req.query;
    const normalizedMobile = String(mobile || '').trim();

    if (!/^\d{10}$/.test(normalizedMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number',
      });
    }

    const candidate = await db.query(
      `SELECT 
        c.batch_id, c.first_name, c.middle_name, c.last_name, c.email, c.gender,
        birth_date, birth_place, height, education_qualification, education_details,
        job_business_title, annual_income, job_business_location, complexion, blood_group,
        gotra, kul, zodiac, gan, nadi, nakshatra, charan, address_line, pincode,
        city_village, tehsil, district, state, mobile_number, whatsapp_number, selected_expectations,
        education_category, mamekul, birth_time, other_expectations, photo_path,
        attended_active_event, registration_date, updated_at, is_active
       FROM candidates
       WHERE batch_id = ? AND mobile_number = ? AND is_active = TRUE
       LIMIT 1`,
      [req.userId, normalizedMobile]
    );

    if (candidate.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Candidate not found',
        data: null,
      });
    }

    // Parse JSON expectations field
    const candidateData = serializeCandidate(candidate[0]);
    candidateData.registered_events = await getRegisteredEvents(candidate[0].batch_id);
    if (candidateData.selected_expectations) {
      try {
        candidateData.selected_expectations = JSON.parse(candidateData.selected_expectations);
      } catch (e) {
        candidateData.selected_expectations = [];
      }
    }

    res.status(200).json({
      success: true,
      data: candidateData,
    });
  } catch (error) {
    console.error('Error looking up candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error looking up candidate',
    });
  }
};

/**
 * Link existing candidate to a new event
 * POST /api/candidates/:batch_id/link-event
 * 
 * Handles:
 * - Linking existing candidate to new event
 * - Creating subscription entry
 * - Updating candidate profile if needed
 */
export const linkCandidateToEvent = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const {
      event_id,
      client_id,
      // Optional fields to update
      email,
      education_qualification,
      education_details,
      job_business_title,
      annual_income,
      job_business_location,
      selected_expectations,
    } = req.body;

    if (!batch_id || !event_id || !client_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Verify candidate exists
    const candidateCheck = await db.query(
      'SELECT batch_id FROM candidates WHERE batch_id = ?',
      [batch_id]
    );

    if (candidateCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Verify event belongs to client
    const eventCheck = await db.query(
      'SELECT event_id FROM events WHERE event_id = ? AND client_id = ? AND is_active = TRUE',
      [event_id, client_id]
    );

    if (eventCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or is inactive',
      });
    }

    // Update candidate profile if provided
    if (email || education_qualification || job_business_title) {
      const updateFields = [];
      const updateValues = [];

      if (email) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }
      if (education_qualification) {
        updateFields.push('education_qualification = ?');
        updateValues.push(education_qualification);
      }
      if (education_details) {
        updateFields.push('education_details = ?');
        updateValues.push(education_details);
      }
      if (job_business_title) {
        updateFields.push('job_business_title = ?');
        updateValues.push(job_business_title);
      }
      if (annual_income) {
        updateFields.push('annual_income = ?');
        updateValues.push(annual_income);
      }
      if (job_business_location) {
        updateFields.push('job_business_location = ?');
        updateValues.push(job_business_location);
      }
      if (selected_expectations) {
        updateFields.push('selected_expectations = ?');
        updateValues.push(
          typeof selected_expectations === 'string'
            ? selected_expectations
            : JSON.stringify(selected_expectations)
        );
      }

      updateValues.push(batch_id);

      if (updateFields.length > 0) {
        await db.query(
          `UPDATE candidates SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE batch_id = ?`,
          updateValues
        );
      }
    }

    // Call stored procedure to link candidate to event
    const now = new Date();
    await db.query(
      'CALL sp_link_candidate_to_event(?, ?, ?, ?)',
      [batch_id, event_id, client_id, now]
    );

    // Get subscription details
    const subscription = await db.query(
      `SELECT subscription_id, access_expiry_date FROM subscriptions
       WHERE batch_id = ? AND event_id = ?`,
      [batch_id, event_id]
    );

    res.status(200).json({
      success: true,
      message: 'Candidate linked to event successfully',
      batch_id,
      event_id,
      subscription_expiry: subscription[0]?.access_expiry_date,
    });
  } catch (error) {
    console.error('Error linking candidate to event:', error);
    res.status(500).json({
      success: false,
      message: 'Error linking candidate to event',
    });
  }
};

/**
 * Get candidate by ID (for profile viewing)
 */
export const getCandidateById = async (req, res) => {
  try {
    const { batch_id } = req.params;

    const candidate = await db.query(
      `SELECT ${SAFE_CANDIDATE_FIELDS.join(', ')}
       FROM candidates WHERE batch_id = ? AND is_active = TRUE`,
      [batch_id]
    );

    if (candidate.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    const data = serializeCandidate(candidate[0]);
    data.registered_events = await getRegisteredEvents(candidate[0].batch_id);
    if (data.selected_expectations) {
      try {
        data.selected_expectations = JSON.parse(data.selected_expectations);
      } catch (e) {
        data.selected_expectations = [];
      }
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate',
    });
  }
};

export default {
  registerCandidate,
  lookupCandidate,
  linkCandidateToEvent,
  getCandidateById,
};
