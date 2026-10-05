/**
 * clientController.js
 * 
 * Purpose: Manage clients, committee members, and client-specific operations
 */

import db, { table } from '../mysqlDb.js';

const normalizeHostname = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .split('/')[0]
  .split(':')[0]
  .replace(/^www\./, '');

const isValidHostname = (value) => value.length <= 253 &&
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);

const serializeJsonValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const defaultPublicTeamNames = [
  'विनीत / स्वागतोत्सुक व कार्यकारिणी समिती सदस्य',
  'समस्त भावसार क्षत्रिय महिला मंडळ',
  'समस्त भावसार क्षत्रिय युवा परिषद',
  'तांत्रिक सहाय्यता (Technical Helpline)',
  'नोंदणी सहाय्यता हेल्पलाईन',
  'स्मरणिका जाहिरात नियोजन समिती'
];

/**
 * Get client details
 * GET /api/clients/:clientId
 */
export const getClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const authorizedAdmin = req.userId && ['admin', 'super_user'].includes(String(req.role || '').toLowerCase())
      ? await db.query(
        `SELECT au.admin_id, au.is_super_user
         FROM admin_users au
         LEFT JOIN client_admin_mapping cam
           ON cam.admin_id = au.admin_id AND cam.client_id = ? AND cam.is_active = TRUE
         WHERE au.admin_id = ? AND au.is_active = TRUE
           AND (au.is_super_user = TRUE OR cam.mapping_id IS NOT NULL)
         LIMIT 1`,
        [clientId, req.userId]
      )
      : [];
    const canViewPrivateClientData = authorizedAdmin.length > 0;

    const client = await db.query(
            `SELECT client_id, client_name, address, phone_number, contact_email, public_slug,
              homepage_enabled, homepage_title, homepage_intro, homepage_content,
              registration_form_config, is_active
       FROM clients WHERE client_id = ? ${canViewPrivateClientData ? '' : 'AND is_active = TRUE'}`,
      [clientId]
    );

    if (client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const clientData = client[0];
    if (!canViewPrivateClientData) {
      return res.status(200).json({
        success: true,
        data: clientData,
      });
    }

    const domains = await db.query(
      `SELECT domain_id, hostname, is_primary, is_active
       FROM client_domains WHERE client_id = ? ORDER BY is_primary DESC, domain_id ASC`,
      [clientId]
    );
    clientData.domains = domains;
    clientData.custom_domain = domains[0]?.hostname || '';
    
    // Get committee members
    const committee = await db.query(
      `SELECT adhyaksha_name, adhyaksha_phone, adhyaksha_email,
              upa_adhyaksha_name, upa_adhyaksha_phone, upa_adhyaksha_email,
              khajindar_name, khajindar_phone, khajindar_email,
              sachiv_name, sachiv_phone, sachiv_email,
              upasachiv_name, upasachiv_phone, upasachiv_email
       FROM client_core_committee WHERE client_id = ?`,
      [clientId]
    );

    res.status(200).json({
      success: true,
      data: {
        ...clientData,
        committee: committee[0] || null,
      },
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
    });
  }
};

export const uploadClientLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Logo image is required.' });
    const result = await db.query(
      'UPDATE clients SET logo_data = ?, logo_mime_type = ? WHERE client_id = ?',
      [req.file.buffer, req.file.mimetype, req.params.clientId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Client not found.' });
    res.json({ success: true, message: 'Client logo uploaded successfully.' });
  } catch (error) {
    console.error('Error uploading client logo:', error);
    res.status(500).json({ success: false, message: 'Error uploading client logo.' });
  }
};

/**
 * Create new client (Superuser only)
 * POST /api/clients
 * 
 * Required fields: client_name, address, phone_number
 */
export const createClient = async (req, res) => {
  try {
    const {
      client_name,
      address,
      phone_number,
      contact_email,
      public_slug,
      homepage_enabled,
      homepage_title,
      homepage_intro,
      homepage_content,
      registration_form_config,
    } = req.body;

    if (!client_name || !address || !phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: client_name, address, phone_number',
      });
    }

    const query = `
      INSERT INTO clients (client_name, address, phone_number, contact_email, public_slug,
           homepage_enabled, homepage_title, homepage_intro, homepage_content,
           registration_form_config, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `;

    const result = await db.query(query, [
      client_name,
      address,
      phone_number,
      contact_email || null,
      public_slug || null,
      homepage_enabled !== false,
      homepage_title || null,
      homepage_intro || null,
      serializeJsonValue(homepage_content),
      serializeJsonValue(registration_form_config),
    ]);

    for (const teamName of defaultPublicTeamNames) {
      await db.query(
        `INSERT INTO teams (client_id, team_name, is_active)
         SELECT ?, ?, TRUE
         WHERE NOT EXISTS (
           SELECT 1 FROM teams WHERE client_id = ? AND team_name = ?
         )`,
        [result.insertId, teamName, result.insertId, teamName]
      );
    }

    const legacyPlan = await db.query(
      "SELECT plan_id FROM subscription_plans WHERE plan_code = 'legacy-unlimited' LIMIT 1"
    );
    if (legacyPlan.length > 0) {
      await db.query(
        `INSERT INTO client_subscriptions (client_id, plan_id, starts_at, ends_at, status, notes)
         VALUES (?, ?, CURRENT_TIMESTAMP, NULL, 'active', 'Automatic compatibility assignment. Replace with a Super User plan.')`,
        [result.insertId, legacyPlan[0].plan_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      client_id: result.insertId,
    });
  } catch (error) {
    console.error('Error creating client:', error);
    
    // Keep duplicate-key failures actionable for unique client names or legacy schemas.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A client with this name or phone number already exists. If this is a test client, apply migration 003_allow_shared_client_phone.sql to allow shared phone numbers.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating client',
    });
  }
};

/**
 * Update client core committee
 * PUT /api/clients/:clientId/committee
 */
export const updateCommittee = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      adhyaksha_volunteer_id,
      adhyaksha_name, adhyaksha_phone, adhyaksha_email,
      upa_adhyaksha_volunteer_id,
      upa_adhyaksha_name, upa_adhyaksha_phone, upa_adhyaksha_email,
      khajindar_volunteer_id,
      khajindar_name, khajindar_phone, khajindar_email,
      sachiv_volunteer_id,
      sachiv_name, sachiv_phone, sachiv_email,
      upasachiv_volunteer_id,
      upasachiv_name, upasachiv_phone, upasachiv_email,
    } = req.body;

    // Check if committee record exists
    const exists = await db.query(
      'SELECT committee_id FROM client_core_committee WHERE client_id = ?',
      [clientId]
    );

    if (exists.length === 0) {
      // Create new committee record
      const insertQuery = `
        INSERT INTO client_core_committee (
          client_id, adhyaksha_volunteer_id, adhyaksha_name, adhyaksha_phone, adhyaksha_email,
          upa_adhyaksha_volunteer_id, upa_adhyaksha_name, upa_adhyaksha_phone, upa_adhyaksha_email,
          khajindar_volunteer_id, khajindar_name, khajindar_phone, khajindar_email,
          sachiv_volunteer_id, sachiv_name, sachiv_phone, sachiv_email,
          upasachiv_volunteer_id, upasachiv_name, upasachiv_phone, upasachiv_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await db.query(insertQuery, [
        clientId,
        adhyaksha_volunteer_id || null,
        adhyaksha_name, adhyaksha_phone, adhyaksha_email,
        upa_adhyaksha_volunteer_id || null,
        upa_adhyaksha_name, upa_adhyaksha_phone, upa_adhyaksha_email,
        khajindar_volunteer_id || null,
        khajindar_name, khajindar_phone, khajindar_email,
        sachiv_volunteer_id || null,
        sachiv_name, sachiv_phone, sachiv_email,
        upasachiv_volunteer_id || null,
        upasachiv_name, upasachiv_phone, upasachiv_email,
      ]);
    } else {
      // Update existing committee record
      const updateQuery = `
        UPDATE client_core_committee SET
          adhyaksha_volunteer_id = ?, adhyaksha_name = ?, adhyaksha_phone = ?, adhyaksha_email = ?,
          upa_adhyaksha_volunteer_id = ?, upa_adhyaksha_name = ?, upa_adhyaksha_phone = ?, upa_adhyaksha_email = ?,
          khajindar_volunteer_id = ?, khajindar_name = ?, khajindar_phone = ?, khajindar_email = ?,
          sachiv_volunteer_id = ?, sachiv_name = ?, sachiv_phone = ?, sachiv_email = ?,
          upasachiv_volunteer_id = ?, upasachiv_name = ?, upasachiv_phone = ?, upasachiv_email = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `;

      await db.query(updateQuery, [
        adhyaksha_volunteer_id || null,
        adhyaksha_name, adhyaksha_phone, adhyaksha_email,
        upa_adhyaksha_volunteer_id || null,
        upa_adhyaksha_name, upa_adhyaksha_phone, upa_adhyaksha_email,
        khajindar_volunteer_id || null,
        khajindar_name, khajindar_phone, khajindar_email,
        sachiv_volunteer_id || null,
        sachiv_name, sachiv_phone, sachiv_email,
        upasachiv_volunteer_id || null,
        upasachiv_name, upasachiv_phone, upasachiv_email,
        clientId,
      ]);
    }

    res.status(200).json({
      success: true,
      message: 'Committee updated successfully',
    });
  } catch (error) {
    console.error('Error updating committee:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating committee',
    });
  }
};

/**
 * Get all clients (Superuser only)
 * GET /api/clients
 */
export const getAllClients = async (req, res) => {
  try {
    const clients = await db.query(
      `SELECT client_id, client_name, address, phone_number, contact_email, public_slug,
          homepage_enabled, homepage_title, homepage_intro, homepage_content,
          registration_form_config, is_active
       FROM clients ORDER BY client_name ASC`
    );

    const domains = await db.query(
      `SELECT domain_id, client_id, hostname, is_primary, is_active FROM client_domains
       WHERE is_active = TRUE ORDER BY is_primary DESC, domain_id ASC`
    );
    clients.forEach((client) => {
      client.domains = domains.filter((domain) => String(domain.client_id) === String(client.client_id));
      client.custom_domain = client.domains[0]?.hostname || '';
    });

    res.status(200).json({
      success: true,
      data: clients,
      total: clients.length,
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clients',
    });
  }
};

/**
 * Update client details (Superuser only)
 * PUT /api/clients/:clientId
 */
export const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      client_name,
      address,
      phone_number,
      contact_email,
      public_slug,
      homepage_enabled,
      homepage_title,
      homepage_intro,
      homepage_content,
      registration_form_config,
      custom_domain,
      is_active,
    } = req.body;

    const hostname = custom_domain === undefined ? undefined : normalizeHostname(custom_domain);
    if (hostname !== undefined && hostname && !isValidHostname(hostname)) {
      return res.status(400).json({ success: false, message: 'Enter a valid domain such as community.example.com.' });
    }

    if (hostname) {
      const duplicate = await db.query(
        'SELECT domain_id, client_id FROM client_domains WHERE hostname = ? LIMIT 1',
        [hostname]
      );
      if (duplicate.length > 0 && String(duplicate[0].client_id) !== String(clientId)) {
        return res.status(409).json({ success: false, message: 'This domain is already assigned to another client.' });
      }
    }

    const fields = [];
    const values = [];
    for (const [column, value] of Object.entries({
      client_name,
      address,
      phone_number,
      contact_email,
      public_slug,
      homepage_enabled,
      homepage_title,
      homepage_intro,
      homepage_content: serializeJsonValue(homepage_content),
      registration_form_config: serializeJsonValue(registration_form_config),
      is_active,
    })) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0 && custom_domain === undefined) {
      return res.status(400).json({ success: false, message: 'No client fields supplied.' });
    }

    if (fields.length > 0) {
      values.push(clientId);
      const result = await db.query(`UPDATE clients SET ${fields.join(', ')} WHERE client_id = ?`, values);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Client not found.' });
      }
    } else {
      const existingClient = await db.query('SELECT client_id FROM clients WHERE client_id = ?', [clientId]);
      if (existingClient.length === 0) return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    if (custom_domain !== undefined) {
      const existingDomain = await db.query(
        'SELECT domain_id FROM client_domains WHERE client_id = ? AND is_primary = TRUE ORDER BY domain_id LIMIT 1',
        [clientId]
      );

      if (!hostname) {
        await db.query('DELETE FROM client_domains WHERE client_id = ? AND is_primary = TRUE', [clientId]);
      } else if (existingDomain.length > 0) {
        await db.query(
          'UPDATE client_domains SET hostname = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE domain_id = ?',
          [hostname, existingDomain[0].domain_id]
        );
      } else {
        await db.query(
          `INSERT INTO client_domains (client_id, hostname, is_primary, is_active, created_by)
           VALUES (?, ?, TRUE, TRUE, ?)`,
          [clientId, hostname, req.admin?.admin_id || req.userId || null]
        );
      }
      await table('client_domains').refresh();
    }

    res.status(200).json({ success: true, message: 'Client updated successfully.' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, message: 'Error updating client' });
  }
};

export const updateHomepageContent = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      public_slug,
      homepage_enabled,
      homepage_title,
      homepage_intro,
      homepage_content,
      registration_form_config,
      custom_domain,
    } = req.body || {};

    const hostname = custom_domain === undefined ? undefined : normalizeHostname(custom_domain);
    if (hostname !== undefined && hostname && !isValidHostname(hostname)) {
      return res.status(400).json({ success: false, message: 'Enter a valid domain such as community.example.com.' });
    }

    if (hostname) {
      const duplicate = await db.query(
        'SELECT domain_id, client_id FROM client_domains WHERE hostname = ? LIMIT 1',
        [hostname]
      );
      if (duplicate.length > 0 && String(duplicate[0].client_id) !== String(clientId)) {
        return res.status(409).json({ success: false, message: 'This domain is already assigned to another client.' });
      }
    }

    const fields = [];
    const values = [];
    for (const [column, value] of Object.entries({
      public_slug,
      homepage_enabled,
      homepage_title,
      homepage_intro,
      homepage_content: serializeJsonValue(homepage_content),
      registration_form_config: serializeJsonValue(registration_form_config),
    })) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0 && custom_domain === undefined) {
      return res.status(400).json({ success: false, message: 'No homepage fields supplied.' });
    }

    if (fields.length > 0) {
      values.push(clientId);
      const result = await db.query(`UPDATE clients SET ${fields.join(', ')} WHERE client_id = ?`, values);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Client not found.' });
    } else {
      const existingClient = await db.query('SELECT client_id FROM clients WHERE client_id = ?', [clientId]);
      if (existingClient.length === 0) return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    if (custom_domain !== undefined) {
      const existingDomain = await db.query(
        'SELECT domain_id FROM client_domains WHERE client_id = ? AND is_primary = TRUE ORDER BY domain_id LIMIT 1',
        [clientId]
      );

      if (!hostname) {
        await db.query('DELETE FROM client_domains WHERE client_id = ? AND is_primary = TRUE', [clientId]);
      } else if (existingDomain.length > 0) {
        await db.query(
          'UPDATE client_domains SET hostname = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE domain_id = ?',
          [hostname, existingDomain[0].domain_id]
        );
      } else {
        await db.query(
          `INSERT INTO client_domains (client_id, hostname, is_primary, is_active, created_by)
           VALUES (?, ?, TRUE, TRUE, ?)`,
          [clientId, hostname, req.admin?.admin_id || req.userId || null]
        );
      }
      await table('client_domains').refresh();
    }

    res.status(200).json({ success: true, message: 'Homepage content updated successfully.' });
  } catch (error) {
    console.error('Error updating homepage content:', error);
    res.status(500).json({ success: false, message: 'Error updating homepage content.' });
  }
};

/**
 * Assign admin to client
 * POST /api/clients/:clientId/assign-admin
 * 
 * Body: { admin_id, can_view_forms, can_generate_links, can_view_registrations }
 */
export const assignAdminToClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { admin_id, can_view_forms, can_generate_links, can_view_registrations } = req.body;

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing admin_id',
      });
    }

    const existingAssignments = await db.query(
      'SELECT client_id FROM client_admin_mapping WHERE admin_id = ? AND is_active = TRUE',
      [admin_id]
    );
    if (existingAssignments.some((assignment) => Number(assignment.client_id) !== Number(clientId))) {
      return res.status(409).json({
        success: false,
        message: 'Each client admin can be assigned to only one client.',
      });
    }

    const query = `
      INSERT INTO client_admin_mapping (admin_id, client_id, can_view_forms, can_generate_links, can_view_registrations, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE 
        can_view_forms = VALUES(can_view_forms),
        can_generate_links = VALUES(can_generate_links),
        can_view_registrations = VALUES(can_view_registrations),
        is_active = VALUES(is_active)
    `;

    await db.query(query, [
      admin_id,
      clientId,
      can_view_forms !== false,
      can_generate_links !== false,
      can_view_registrations !== false,
    ]);

    res.status(200).json({
      success: true,
      message: 'Admin assigned to client successfully',
    });
  } catch (error) {
    console.error('Error assigning admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning admin to client',
    });
  }
};

/**
 * Get client admins
 * GET /api/clients/:clientId/admins
 */
export const getClientAdmins = async (req, res) => {
  try {
    const { clientId } = req.params;

    const admins = await db.query(
      `SELECT au.admin_id, au.name, au.email, au.phone_number, 
              cam.can_view_forms, cam.can_generate_links, cam.can_view_registrations
       FROM client_admin_mapping cam
       JOIN admin_users au ON cam.admin_id = au.admin_id
       WHERE cam.client_id = ? AND cam.is_active = TRUE`,
      [clientId]
    );

    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error('Error fetching client admins:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client admins',
    });
  }
};

const normalizePlanCode = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 50);

const parsePlanLimit = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
};

const getPlanPayload = (body = {}, existing = {}) => {
  const planCode = body.plan_code === undefined ? existing.plan_code : normalizePlanCode(body.plan_code);
  const planName = body.plan_name === undefined ? existing.plan_name : String(body.plan_name || '').trim();
  const description = body.description === undefined ? (existing.description || null) : String(body.description || '').trim() || null;
  const price = body.price === undefined ? Number(existing.price || 0) : Number(body.price);
  const billingCycle = body.billing_cycle === undefined ? (existing.billing_cycle || 'monthly') : String(body.billing_cycle || '').trim().toLowerCase();
  const maxActiveEvents = parsePlanLimit(body.max_active_events === undefined ? existing.max_active_events : body.max_active_events);
  const maxCandidates = parsePlanLimit(body.max_candidates === undefined ? existing.max_candidates : body.max_candidates);
  const isActive = body.is_active === undefined ? existing.is_active !== false : body.is_active !== false;

  if (!planCode || !planName) return { error: 'Plan code and plan name are required.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Plan price must be zero or a positive number.' };
  if (!['monthly', 'yearly', 'custom'].includes(billingCycle)) return { error: 'Billing cycle must be monthly, yearly, or custom.' };
  if (Number.isNaN(maxActiveEvents) || Number.isNaN(maxCandidates)) return { error: 'Plan limits must be positive whole numbers.' };

  return {
    plan_code: planCode,
    plan_name: planName,
    description,
    price,
    billing_cycle: billingCycle,
    max_active_events: maxActiveEvents,
    max_candidates: maxCandidates,
    is_active: isActive
  };
};

export const getSubscriptionPlans = async (_req, res) => {
  try {
    const plans = await db.query(
      `SELECT plan_id, plan_code, plan_name, description, price, billing_cycle,
              max_active_events, max_candidates, is_active, created_at, updated_at
       FROM subscription_plans
       ORDER BY is_active DESC, price ASC, plan_name ASC`
    );
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ success: false, message: 'Unable to load subscription plans.' });
  }
};

export const createSubscriptionPlan = async (req, res) => {
  try {
    const payload = getPlanPayload(req.body || {});
    if (payload.error) return res.status(400).json({ success: false, message: payload.error });

    const result = await db.query(
      `INSERT INTO subscription_plans
        (plan_code, plan_name, description, price, billing_cycle, max_active_events, max_candidates, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.plan_code, payload.plan_name, payload.description, payload.price, payload.billing_cycle,
        payload.max_active_events, payload.max_candidates, payload.is_active]
    );
    res.status(201).json({ success: true, message: 'Subscription plan created successfully.', plan_id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A plan with this code already exists.' });
    console.error('Error creating subscription plan:', error);
    res.status(500).json({ success: false, message: 'Unable to create subscription plan.' });
  }
};

export const updateSubscriptionPlan = async (req, res) => {
  try {
    const existingRows = await db.query('SELECT * FROM subscription_plans WHERE plan_id = ? LIMIT 1', [req.params.planId]);
    if (existingRows.length === 0) return res.status(404).json({ success: false, message: 'Subscription plan not found.' });

    const payload = getPlanPayload(req.body || {}, existingRows[0]);
    if (payload.error) return res.status(400).json({ success: false, message: payload.error });

    await db.query(
      `UPDATE subscription_plans
       SET plan_code = ?, plan_name = ?, description = ?, price = ?, billing_cycle = ?,
           max_active_events = ?, max_candidates = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE plan_id = ?`,
      [payload.plan_code, payload.plan_name, payload.description, payload.price, payload.billing_cycle,
        payload.max_active_events, payload.max_candidates, payload.is_active, req.params.planId]
    );
    res.json({ success: true, message: 'Subscription plan updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A plan with this code already exists.' });
    console.error('Error updating subscription plan:', error);
    res.status(500).json({ success: false, message: 'Unable to update subscription plan.' });
  }
};

export const getClientSubscription = async (req, res) => {
  try {
    const clientRows = await db.query('SELECT client_id, client_name FROM clients WHERE client_id = ? LIMIT 1', [req.params.clientId]);
    if (clientRows.length === 0) return res.status(404).json({ success: false, message: 'Client not found.' });

    const history = await db.query(
      `SELECT cs.client_subscription_id, cs.client_id, cs.plan_id, cs.starts_at, cs.ends_at,
              cs.status, cs.notes, cs.created_at, sp.plan_code, sp.plan_name, sp.price,
              sp.billing_cycle, sp.max_active_events, sp.max_candidates, sp.is_active AS plan_is_active
       FROM client_subscriptions cs
       INNER JOIN subscription_plans sp ON sp.plan_id = cs.plan_id
       WHERE cs.client_id = ?
       ORDER BY cs.starts_at DESC, cs.client_subscription_id DESC`,
      [req.params.clientId]
    );
    const current = history.find((subscription) => subscription.status === 'active'
      && subscription.plan_is_active !== 0
      && new Date(subscription.starts_at).getTime() <= Date.now()
      && (!subscription.ends_at || new Date(subscription.ends_at).getTime() >= Date.now())) || null;
    res.json({ success: true, client: clientRows[0], current, history });
  } catch (error) {
    console.error('Error fetching client subscription:', error);
    res.status(500).json({ success: false, message: 'Unable to load client subscription.' });
  }
};

export const assignClientSubscription = async (req, res) => {
  try {
    const { plan_id: planId, starts_at: startsAt, ends_at: endsAt, status = 'active', notes = '' } = req.body || {};
    const clientRows = await db.query('SELECT client_id FROM clients WHERE client_id = ? LIMIT 1', [req.params.clientId]);
    if (clientRows.length === 0) return res.status(404).json({ success: false, message: 'Client not found.' });

    const planRows = await db.query('SELECT plan_id FROM subscription_plans WHERE plan_id = ? AND is_active = TRUE LIMIT 1', [planId]);
    if (planRows.length === 0) return res.status(400).json({ success: false, message: 'Select an active subscription plan.' });
    if (!['active', 'paused', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid subscription status.' });

    const normalizedStart = startsAt ? String(startsAt).trim() : new Date().toISOString().slice(0, 19).replace('T', ' ');
    const normalizedEnd = endsAt ? String(endsAt).trim() : null;
    const startTime = new Date(normalizedStart).getTime();
    const endTime = normalizedEnd ? new Date(normalizedEnd).getTime() : null;
    if (!Number.isFinite(startTime) || (normalizedEnd && !Number.isFinite(endTime))) {
      return res.status(400).json({ success: false, message: 'Enter valid subscription dates.' });
    }
    if (endTime && endTime < startTime) return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });

    await db.query(
      `UPDATE client_subscriptions
       SET status = 'replaced', ends_at = COALESCE(ends_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE client_id = ? AND status = 'active'`,
      [req.params.clientId]
    );
    const result = await db.query(
      `INSERT INTO client_subscriptions
        (client_id, plan_id, starts_at, ends_at, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.clientId, planId, normalizedStart, normalizedEnd, status, String(notes || '').trim() || null, req.userId || null]
    );
    res.status(201).json({ success: true, message: 'Client subscription plan assigned successfully.', client_subscription_id: result.insertId });
  } catch (error) {
    console.error('Error assigning client subscription:', error);
    res.status(500).json({ success: false, message: 'Unable to assign client subscription plan.' });
  }
};

export default {
  getClient,
  createClient,
  updateClient,
  updateHomepageContent,
  updateCommittee,
  getAllClients,
  assignAdminToClient,
  getClientAdmins,
  uploadClientLogo,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getClientSubscription,
  assignClientSubscription,
};
