# Multi-Tenant Event Registration Platform - Implementation Guide

## Overview

This guide documents the complete architecture for the multi-tenant event registration and matchmaking platform. The system supports:

- **Multiple distinct client organizations** with isolated data
- **Dynamic React forms** for event-specific registration
- **Cross-event candidate visibility** with strict subscription-based access control
- **Role-Based Access Control (RBAC)** with superusers and client admins
- **6-month access windows** for subscription tracking

## Architecture Components

### 1. Database Schema (SQL Migrations)

Location: `/migrations/001_multi_tenant_schema.sql`

#### Key Tables

##### `clients`
```sql
- client_id (PK)
- client_name (UNIQUE)
- address
- phone_number (UNIQUE)
- bank_details (JSON)
- contact_email
- is_active
```

**Purpose:** Stores master client organization records. Each client can have multiple events.

##### `client_core_committee` (1-to-1 with clients)
```sql
- committee_id (PK)
- client_id (FK, UNIQUE)
- adhyaksha_name, adhyaksha_phone, adhyaksha_email
- upa_adhyaksha_name, upa_adhyaksha_phone, upa_adhyaksha_email
- khajindar_name, khajindar_phone, khajindar_email
- sachiv_name, sachiv_phone, sachiv_email
- upasachiv_name, upasachiv_phone, upasachiv_email
```

**Purpose:** Stores committee member details (1-to-1 relationship with clients).

##### `events` (Modified)
```sql
Added columns:
- client_id (FK to clients)
- banner_url (VARCHAR)
- UNIQUE constraint: (client_id, is_active) WHERE is_active = TRUE
  → Enforces: Only ONE active event per client at a time
```

**Purpose:** Existing events table enhanced with multi-tenant support.

##### `candidate_event_registrations`
```sql
- registration_id (PK)
- batch_id (FK to candidates)
- event_id (FK to events)
- client_id (FK to clients)
- registration_date (TIMESTAMP)
- is_active (BOOLEAN)
- UNIQUE constraint: (batch_id, event_id)
  → Prevents duplicate registrations for same event
```

**Purpose:** Tracks which candidate is registered for which event.

##### `subscriptions`
```sql
- subscription_id (PK)
- batch_id (FK to candidates)
- event_id (FK to events)
- client_id (FK to clients)
- registration_date (TIMESTAMP) → Candidate's registration start date
- access_expiry_date (TIMESTAMP) → registration_date + 6 months
- is_active (BOOLEAN)
- UNIQUE constraint: (batch_id, event_id)
```

**Purpose:** Enforces strict 6-month access window. Used for visibility filtering and access control.

##### `client_admin_mapping`
```sql
- mapping_id (PK)
- admin_id (FK to admin_users)
- client_id (FK to clients)
- can_view_forms (BOOLEAN)
- can_generate_links (BOOLEAN)
- can_view_registrations (BOOLEAN)
- UNIQUE constraint: (admin_id, client_id)
```

**Purpose:** Maps which admin users can manage which clients.

---

## 2. React Components

### DynamicEventForm.jsx

Location: `/src/components/DynamicEventForm.jsx`

**Route:** `/register/:clientId/:eventId`

**Key Features:**

#### A. Dynamic Data Loading
```javascript
// On mount, fetches:
- Event details (name, dates, venue, banner_url)
- Client details (client_name, address, committee)
```

#### B. Smart Auto-Fill Logic
```javascript
// On mobile number input (10 digits):
GET /api/candidates/lookup?mobile=9876543210
  ↓
If found:
  - Pre-populate form with existing candidate data
  - Show "Welcome back!" alert
  - User links to new event instead of creating duplicate
  
If not found:
  - User creates new candidate record
```

#### C. Form Submission Flow
```javascript
// New Candidate Path:
POST /api/candidates/register
  ↓
1. Create candidate record in `candidates` table
2. Insert row in `candidate_event_registrations`
3. Create subscription (registration_date + 6 months)

// Existing Candidate Path:
POST /api/candidates/:batch_id/link-event
  ↓
1. Update candidate profile (if provided)
2. Call stored procedure: sp_link_candidate_to_event()
   - Insert into candidate_event_registrations
   - Create/update subscription
3. Redirect to browsing feed
```

**Styling:** `DynamicEventForm.css`
- Responsive design (mobile, tablet, desktop)
- Dark purple gradient header with banner support
- Modern form styling with focus states
- Grid-based layout for multi-column sections

---

## 3. Backend Controllers

### A. candidateController.js

**Endpoints:**

#### `POST /api/candidates/register`
Registers a new candidate for an event.

```javascript
Request Body:
{
  mobile_number, first_name, last_name, gender, marriage_type,
  event_id, client_id,
  [optional: photo, email, education_qualification, ...]
}

Response:
{
  success: true,
  batch_id: <new_batch_id>,
  subscription_expiry: <date>
}
```

**Process:**
1. Verify event belongs to client and is active
2. Upload photo to `/uploads` if provided
3. Create candidate record
4. Link to event via `candidate_event_registrations`
5. Create subscription (6 months)

#### `GET /api/candidates/lookup?mobile=9876543210`
Finds existing candidate by mobile number.

```javascript
Response (if found):
{
  success: true,
  data: {
    batch_id, first_name, middle_name, last_name, gender,
    birth_date, education_qualification, job_business_title,
    selected_expectations, [...all profile fields]
  }
}

Response (if not found):
{
  success: true,
  data: null
}
```

#### `POST /api/candidates/:batch_id/link-event`
Links existing candidate to a new event.

```javascript
Request Body:
{
  event_id, client_id,
  [optional: email, education_qualification, selected_expectations]
}

Process:
1. Verify candidate exists
2. Verify event belongs to client
3. Update candidate fields (if provided)
4. Call sp_link_candidate_to_event() stored procedure
   - Links to event
   - Creates subscription
```

---

### B. candidateFeedController.js

**Core Feature:** Cross-Event Visibility with Subscription Checks

#### `GET /api/feed/candidates?clientId=1&batchId=123&eventId=1`

**Critical Logic: Cross-Event Deduplication**

```
Scenario 1: Candidate registered for Event 1 only
  → Sees all opposite-gender candidates from Event 1

Scenario 2: Candidate registered for Event 1 AND Event 2
  → Sees merged list of candidates from Event 1 + Event 2
  → No duplicates (SELECT DISTINCT on batch_id)
  → All must have active subscriptions (access_expiry_date >= NOW())
```

**Complex Query Breakdown:**

```sql
SELECT DISTINCT c.batch_id, c.first_name, [...profile fields]
FROM candidates c
INNER JOIN candidate_event_registrations cer 
  ON c.batch_id = cer.batch_id
INNER JOIN subscriptions s
  ON c.batch_id = s.batch_id AND cer.event_id = s.event_id
LEFT JOIN candidate_interactions ci
  ON ci.from_candidate_id = ? AND ci.to_candidate_id = c.batch_id
WHERE 
  c.gender = ? (opposite gender)
  AND c.batch_id != ? (not self)
  AND cer.event_id IN (...) (candidate's registered events)
  AND s.access_expiry_date >= NOW() (active subscription check)
  AND s.is_active = TRUE
```

**Response:**
```javascript
{
  success: true,
  data: [
    {
      batch_id, first_name, last_name, gender,
      education_qualification, job_business_title,
      height, complexion, blood_group,
      selected_expectations, photo_path,
      user_liked_this, user_shortlisted_this,
      this_user_liked_me
    },
    ...
  ],
  stats: {
    total_events_registered: 2,
    total_candidates: 45
  }
}
```

#### `POST /api/feed/like`
Like/unlike a candidate.

```javascript
Body: { from_batch_id, to_batch_id, is_liked }
```

#### `GET /api/feed/matches?batchId=123&clientId=1`
Get mutual likes/matches.

```javascript
Response:
{
  success: true,
  data: [
    {
      batch_id, first_name, last_name,
      candidate_liked_me, i_liked_candidate,
      match_status: 'mutual_like' | 'they_liked_me' | 'i_liked_them'
    }
  ]
}
```

#### `GET /api/subscriptions/status?batchId=123&eventId=1`
Check subscription status.

```javascript
Response:
{
  success: true,
  status: 'active' | 'expired' | 'no_subscription',
  data: {
    access_expiry_date, days_remaining, registration_date
  }
}
```

---

### C. clientController.js

**Endpoints:**

#### `GET /api/clients/:clientId`
Fetch client details with committee.

#### `POST /api/clients` (Superuser only)
Create new client.

```javascript
Body: {
  client_name, address, phone_number, contact_email
}
```

#### `GET /api/clients` (Superuser only)
Get all clients.

#### `PUT /api/clients/:clientId/committee`
Update/create committee members.

#### `POST /api/clients/:clientId/assign-admin` (Superuser only)
Assign admin user to client with permissions.

```javascript
Body: {
  admin_id,
  can_view_forms: boolean,
  can_generate_links: boolean,
  can_view_registrations: boolean
}
```

---

### D. eventsController.js

**Endpoints:**

#### `GET /api/events/:eventId?clientId=1`
Get event details.

```javascript
Response includes:
- Event details, banner_url, dates
- registration_count (total registered candidates)
- subscription_stats (active, expired counts)
```

#### `POST /api/events` (Client Admin, requires can_generate_links)
Create new event.

```javascript
Body: {
  client_id, event_name, venue, start_date, end_date,
  registration_cutoff_date, banner_url, organizer details...
}

Validation:
- Event belongs to client
- Check: Only ONE active event per client allowed
  → If active event exists, return 409 Conflict
```

#### `PUT /api/events/:eventId`
Update event details.

**One-Active-Per-Client Constraint:**
```
If is_active = TRUE in update:
  SELECT count(*) FROM events
  WHERE client_id = ? AND is_active = TRUE AND event_id != ?
  
  If count > 0 → return 409 Conflict
```

#### `GET /api/clients/:clientId/events`
Get all events for client.

#### `GET /api/events/:eventId/registration-link`
Generate shareable registration link.

```
Generates: /register/{client_id}/{event_id}
```

---

## 4. RBAC Middleware

Location: `/middleware/rbacMiddleware.js`

### Role Hierarchy

```
Superuser (is_super_user = TRUE in admin_users)
  ├─ Can manage all clients
  ├─ Can create events for any client
  ├─ Can assign admin users
  └─ No restrictions

Client Admin (mapped in client_admin_mapping)
  ├─ Can only access assigned clients
  ├─ Permissions per client:
  │  ├─ can_view_forms
  │  ├─ can_generate_links
  │  └─ can_view_registrations
  └─ Cannot see other clients' data
```

### Middleware Functions

#### `requireSuperuser`
```javascript
// Usage: router.post('/clients', requireSuperuser, controller)

// Checks:
1. admin_id extracted from req.user, req.body, or req.query
2. admin exists and is_super_user = TRUE
3. If not → 403 Forbidden
```

#### `requireClientAdmin`
```javascript
// Usage: router.get('/clients/:clientId/events', requireClientAdmin, controller)

// Checks:
1. admin_id + clientId required
2. If superuser → grant access
3. If client admin → verify mapping in client_admin_mapping
4. If not mapped → 403 Forbidden
```

#### `requirePermission(permissionName)`
```javascript
// Usage: router.post('/forms', requirePermission('can_generate_links'), controller)

// Checks specific permission in client_admin_mapping
// Superusers bypass this
```

#### `requireActiveSubscription`
```javascript
// Usage: router.get('/feed/candidates', requireActiveSubscription, controller)

// Checks:
1. batchId + clientId required
2. subscription_id exists
3. access_expiry_date >= NOW()
4. If expired or missing → 403 Forbidden
```

#### `verifyEventClient`
```javascript
// Ensures event belongs to provided client
```

#### `auditLog(actionType)`
```javascript
// Decorator: Logs all admin actions to activity_logs table
// Usage: router.post('/events', auditLog('create_event'), controller)
```

---

## 5. API Routes Integration

Location: `/routes/apiRoutes.js`

**Integration in Server.js:**
```javascript
const apiRoutes = require('./routes/apiRoutes');
app.use('/api', apiRoutes);
```

**Route Structure:**

```
/api
├── /candidates
│   ├── POST /register (multipart/form-data)
│   ├── GET /lookup?mobile=9876543210
│   ├── POST /:batch_id/link-event
│   └── GET /:batch_id
├── /feed
│   ├── GET /candidates (requireActiveSubscription)
│   ├── POST /like
│   ├── POST /shortlist
│   └── GET /matches
├── /subscriptions
│   └── GET /status
├── /events
│   ├── GET /:eventId
│   ├── POST / (requireClientAdmin, can_generate_links)
│   ├── PUT /:eventId
│   ├── GET /:eventId/registration-link
│   └── (nested under clients)
└── /clients
    ├── GET / (requireSuperuser)
    ├── POST / (requireSuperuser)
    ├── GET /:clientId
    ├── PUT /:clientId/committee
    ├── POST /:clientId/assign-admin (requireSuperuser)
    ├── GET /:clientId/admins (requireClientAdmin)
    ├── GET /:clientId/events
    └── POST /:clientId/link-admin
```

---

## 6. Stored Procedures

### `sp_calculate_subscription_expiry`
```sql
IN: p_registration_date (TIMESTAMP)
OUT: p_expiry_date (TIMESTAMP) → registration_date + 6 months
```

### `sp_link_candidate_to_event`
```sql
IN: p_batch_id, p_event_id, p_client_id, p_registration_date

Process:
1. Calculate expiry_date = registration_date + 6 months
2. INSERT/UPDATE candidate_event_registrations
3. INSERT/UPDATE subscriptions
```

---

## 7. Database Views

### `v_active_subscriptions`
```sql
Shows:
- Only non-expired subscriptions
- Join with candidates, events, clients
- Useful for quick visibility checks
```

### `v_unique_candidates_per_event`
```sql
Shows:
- Unique candidates per event (deduplicated by batch_id)
- Used for feed generation
```

---

## Implementation Checklist

### Database
- [ ] Run migration: `001_multi_tenant_schema.sql`
- [ ] Verify all tables created
- [ ] Test stored procedures
- [ ] Test views

### Backend
- [ ] Update `Server.js` to include API routes
  ```javascript
  const apiRoutes = require('./routes/apiRoutes');
  app.use('/api', apiRoutes);
  ```
- [ ] Install dependencies: `multer`, `uuid`
  ```
  npm install multer uuid
  ```
- [ ] Create `/controllers` directory
- [ ] Create `/middleware` directory
- [ ] Create `/routes` directory
- [ ] Copy all controller files
- [ ] Copy middleware files
- [ ] Copy routes file
- [ ] Test all endpoints

### Frontend
- [ ] Create `/src/components/DynamicEventForm.jsx`
- [ ] Create `/src/components/DynamicEventForm.css`
- [ ] Add route to React Router:
  ```javascript
  import DynamicEventForm from './components/DynamicEventForm';
  
  <Route path="/register/:clientId/:eventId" element={<DynamicEventForm />} />
  ```
- [ ] Install/verify axios available
- [ ] Test form with mock data

### Testing
- [ ] Test new candidate registration
- [ ] Test existing candidate auto-fill
- [ ] Test event linking
- [ ] Test cross-event visibility
- [ ] Test subscription expiry blocking
- [ ] Test RBAC (superuser vs client admin)
- [ ] Test one-active-event-per-client constraint

---

## Security Considerations

1. **Photo Upload:** Validated to image MIME types, 5MB limit
2. **SQL Injection:** All queries use prepared statements
3. **RBAC:** Enforced at controller and middleware levels
4. **Subscription Checks:** Prevent expired candidate access
5. **Audit Logging:** Track all admin actions

---

## Performance Optimization

1. **Indexes:** Created on:
   - `events(client_id, is_active)`
   - `subscriptions(access_expiry_date, is_active)`
   - `candidate_event_registrations(registration_date)`

2. **DISTINCT on batch_id:** Ensures deduplication without memory overhead

3. **Subscription Cache:** Consider Redis for frequent expiry checks

---

## Future Enhancements

1. **Messaging System:** Direct messages between matched candidates
2. **Payment Integration:** Razorpay integration for paid registrations
3. **Analytics Dashboard:** Client-specific reporting
4. **Email Notifications:** On likes, matches, subscription expiry
5. **Admin Dashboard:** Manage clients, view analytics, control events
6. **Mobile App:** Native iOS/Android app

---

## Troubleshooting

### Issue: "Client already has an active event"
- **Cause:** Trying to create/activate second event for client
- **Fix:** Deactivate existing event first or use different client

### Issue: Access denied for candidate feed
- **Cause:** Subscription expired or not found
- **Fix:** Re-register candidate or check subscription status endpoint

### Issue: Auto-fill not working
- **Cause:** Mobile number not found or API error
- **Fix:** Check `/candidates/lookup` endpoint response

### Issue: One active event constraint not enforced
- **Cause:** Database migration not run
- **Fix:** Execute `001_multi_tenant_schema.sql` migration

---

## Contact & Support

For issues or questions, refer to the relevant controller/middleware documentation within this guide.
