/**
 * eventsController.js
 * 
 * Purpose: Event management with multi-tenant validation
 * 
 * Key Features:
 * - One active event per client constraint
 * - Client-event association
 * - Banner URL management
 */

import db from '../mysqlDb.js';

const toSlug = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const toDateSlug = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const PUBLIC_EVENT_FIELDS = [
  'event_id', 'client_id', 'event_name', 'venue', 'event_type', 'start_date', 'end_date',
  'registration_cutoff_date', 'organizer_name', 'organizer_phone', 'organizer_whatsapp',
  'organizer_photo', 'banner_url', 'registration_banner_path', 'event_time', 'office_address',
  'razorpay_registration_amount', 'is_active'
];

const serializePublicEvent = (event) => Object.fromEntries(
  PUBLIC_EVENT_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(event || {}, field))
    .map((field) => [field, event[field]])
);

const redactEventPaymentFields = ({
  razorpay_key_id: _keyId,
  razorpay_key_secret: _keySecret,
  payment_gateway_id: _gatewayId,
  payment_gateway_secret: _gatewaySecret,
  organizer_photo_data: _organizerPhotoData,
  organizer_photo_mime_type: _organizerPhotoMimeType,
  registration_banner_data: _registrationBannerData,
  registration_banner_mime_type: _registrationBannerMimeType,
  ...event
}) => event;

/**
 * Get event by ID
 * GET /api/events/:eventId?clientId=:clientId
 */
export const getEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { clientId } = req.query;

    let query = 'SELECT * FROM events WHERE event_id = ? AND is_active = TRUE';
    let params = [eventId];

    // If clientId provided, verify ownership
    if (clientId) {
      query += ' AND client_id = ?';
      params.push(clientId);
    }

    const event = await db.query(query, params);

    if (event.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const eventData = serializePublicEvent(event[0]);

    res.status(200).json({
      success: true,
      data: eventData,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching event',
    });
  }
};

/**
 * Resolve a public registration URL using readable client and event slugs.
 * GET /api/events/registration/:clientSlug/:eventSlug
 */
export const getEventByRegistrationSlug = async (req, res) => {
  try {
    const { clientSlug, eventSlug } = req.params;
    const events = await db.query(
            `SELECT e.*, c.client_id, c.client_name, c.address AS client_address,
              c.phone_number AS client_phone_number, c.contact_email AS client_contact_email,
              c.public_slug, c.homepage_title, c.homepage_intro, c.registration_form_config
       FROM events e
       INNER JOIN clients c ON c.client_id = e.client_id
       WHERE e.is_active = TRUE AND c.is_active = TRUE`
    );
    const requestedClientSlug = toSlug(clientSlug);
    const requestedEventSlug = toSlug(eventSlug);
    const match = events.find((event) => {
      const clientSlugMatches = [event.public_slug, event.client_name]
        .filter(Boolean)
        .some((value) => toSlug(value) === requestedClientSlug);
      const eventSlugMatches = [
        `${event.event_name}-${toDateSlug(event.start_date)}`,
        `${event.event_name}-${event.start_date}`
      ].some((value) => toSlug(value) === requestedEventSlug);
      return clientSlugMatches && eventSlugMatches;
    });

    if (!match) {
      return res.status(404).json({ success: false, message: 'Active registration event not found.' });
    }

    const { client_address, client_phone_number, client_contact_email, public_slug,
      homepage_title, homepage_intro, registration_form_config } = match;
    return res.json({
      success: true,
      data: serializePublicEvent(match),
      client: {
        client_id: match.client_id,
        client_name: match.client_name,
        public_slug,
        address: client_address,
        phone_number: client_phone_number,
        contact_email: client_contact_email,
        homepage_title,
        homepage_intro,
        registration_form_config,
      },
    });
  } catch (error) {
    console.error('Error resolving registration event:', error);
    return res.status(500).json({ success: false, message: 'Error loading registration event.' });
  }
};

/**
 * Create event for a client (Client Admin or Superuser)
 * POST /api/events
 * 
 * Required: event_name, client_id, venue, start_date, end_date, registration_cutoff_date
 * Optional: banner_url and organizer details
 */
export const createEvent = async (req, res) => {
  try {
    if (req.admin?.is_super_user) {
      return res.status(403).json({
        success: false,
        message: 'Super Users can edit or activate events, but client admins create events.',
      });
    }

    const {
      client_id,
      event_name,
      venue,
      event_type,
      start_date,
      end_date,
      registration_cutoff_date,
      organizer_name,
      organizer_phone,
      organizer_whatsapp,
      organizer_photo,
      banner_url,
      razorpay_registration_amount,
    } = req.body;

    // Validation
    if (!client_id || !event_name || !venue || !start_date || !end_date || !registration_cutoff_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Check if client exists
    const clientCheck = await db.query(
      'SELECT client_id FROM clients WHERE client_id = ? AND is_active = TRUE',
      [client_id]
    );

    if (clientCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or is inactive',
      });
    }

    // Check for existing active event (one per client rule)
    const activeEventCheck = await db.query(
      'SELECT event_id FROM events WHERE client_id = ? AND is_active = TRUE',
      [client_id]
    );

    if (activeEventCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Client already has an active event. Only one active event per client is allowed.',
        existing_event_id: activeEventCheck[0].event_id,
      });
    }

    const query = `
      INSERT INTO events (
        client_id,
        event_name,
        venue,
        event_type,
        start_date,
        end_date,
        registration_cutoff_date,
        organizer_name,
        organizer_phone,
        organizer_whatsapp,
        organizer_photo,
        banner_url,
        razorpay_registration_amount,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
    `;

    const result = await db.query(query, [
      client_id,
      event_name,
      venue,
      event_type || null,
      start_date,
      end_date,
      registration_cutoff_date,
      organizer_name || null,
      organizer_phone || null,
      organizer_whatsapp || null,
      organizer_photo || null,
      banner_url || null,
      razorpay_registration_amount ?? null,
    ]);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event_id: result.insertId,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating event',
    });
  }
};

/**
 * Update event
 * PUT /api/events/:eventId
 */
export const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      event_name,
      venue,
      event_type,
      start_date,
      end_date,
      registration_cutoff_date,
      organizer_name,
      organizer_phone,
      organizer_whatsapp,
      organizer_photo,
      banner_url,
      razorpay_registration_amount,
      is_active,
    } = req.body;

    const existingEvent = await db.query('SELECT client_id FROM events WHERE event_id = ?', [eventId]);
    if (existingEvent.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (!req.admin?.is_super_user) {
      const mapping = await db.query(
        'SELECT mapping_id FROM client_admin_mapping WHERE admin_id = ? AND client_id = ? AND is_active = TRUE',
        [req.admin?.admin_id, existingEvent[0].client_id]
      );
      if (mapping.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied for this client event.' });
      }
    }

    // If activating event, check for one-active-per-client rule
    if (is_active === true) {
      const event = await db.query(
        'SELECT client_id FROM events WHERE event_id = ?',
        [eventId]
      );

      if (event.length > 0) {
        const activeEventCheck = await db.query(
          'SELECT event_id FROM events WHERE client_id = ? AND is_active = TRUE AND event_id != ?',
          [event[0].client_id, eventId]
        );

        if (activeEventCheck.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Cannot activate. Client already has an active event.',
          });
        }
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (event_name !== undefined) {
      updateFields.push('event_name = ?');
      updateValues.push(event_name);
    }
    if (venue !== undefined) {
      updateFields.push('venue = ?');
      updateValues.push(venue);
    }
    if (event_type !== undefined) {
      updateFields.push('event_type = ?');
      updateValues.push(event_type);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(end_date);
    }
    if (registration_cutoff_date !== undefined) {
      updateFields.push('registration_cutoff_date = ?');
      updateValues.push(registration_cutoff_date);
    }
    if (organizer_name !== undefined) {
      updateFields.push('organizer_name = ?');
      updateValues.push(organizer_name);
    }
    if (organizer_phone !== undefined) {
      updateFields.push('organizer_phone = ?');
      updateValues.push(organizer_phone);
    }
    if (organizer_whatsapp !== undefined) {
      updateFields.push('organizer_whatsapp = ?');
      updateValues.push(organizer_whatsapp);
    }
    if (organizer_photo !== undefined) {
      updateFields.push('organizer_photo = ?');
      updateValues.push(organizer_photo);
    }
    if (banner_url !== undefined) {
      updateFields.push('banner_url = ?');
      updateValues.push(banner_url);
    }
    if (razorpay_registration_amount !== undefined) {
      updateFields.push('razorpay_registration_amount = ?');
      updateValues.push(razorpay_registration_amount);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(eventId);

    const query = `UPDATE events SET ${updateFields.join(', ')} WHERE event_id = ?`;
    await db.query(query, updateValues);

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating event',
    });
  }
};

/**
 * Get all events for a client
 * GET /api/clients/:clientId/events
 */
export const getClientEvents = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { includeInactive } = req.query;

    let query = 'SELECT * FROM events WHERE client_id = ?';
    const params = [clientId];

    if (includeInactive !== 'true') {
      query += ' AND is_active = TRUE';
    }

    query += ' ORDER BY start_date DESC';

    const events = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: events.map(redactEventPaymentFields),
      total: events.length,
    });
  } catch (error) {
    console.error('Error fetching client events:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client events',
    });
  }
};

/**
 * Get public registration link for event
 * GET /api/events/:eventId/registration-link
 */
export const getRegistrationLink = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await db.query(
      `SELECT e.event_id, e.client_id, e.event_name, e.start_date, c.client_name, c.public_slug
       FROM events e
       JOIN clients c ON e.client_id = c.client_id
      WHERE e.event_id = ? AND e.is_active = TRUE AND c.is_active = TRUE`,
      [eventId]
    );

    if (event.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const { client_id, event_id, client_name, public_slug, event_name, start_date } = event[0];
    const registrationLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/register/${toSlug(public_slug || client_name)}/${toSlug(`${event_name}-${toDateSlug(start_date)}`)}`;

    res.status(200).json({
      success: true,
      registration_link: registrationLink,
      event_id,
      client_id,
    });
  } catch (error) {
    console.error('Error generating registration link:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating registration link',
    });
  }
};

export default {
  getEvent,
  getEventByRegistrationSlug,
  createEvent,
  updateEvent,
  getClientEvents,
  getRegistrationLink,
};
