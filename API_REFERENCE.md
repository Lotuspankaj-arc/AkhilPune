# Multi-Tenant Platform - API Reference

## Quick Links
- [Authentication](#authentication)
- [Candidates](#candidates)
- [Feed & Browsing](#feed--browsing)
- [Subscriptions](#subscriptions)
- [Events](#events)
- [Clients](#clients)

---

## Authentication

All admin endpoints require one of:
- `admin_id` in request body
- `admin_id` in query parameters
- `admin_id` in request headers (Authorization)

**Superuser:** `is_super_user = TRUE` in admin_users table
**Client Admin:** Mapped in `client_admin_mapping` table

---

## Candidates

### Register New Candidate
```http
POST /api/candidates/register
Content-Type: multipart/form-data

Parameters:
- mobile_number* (string, 10 digits)
- first_name* (string)
- last_name (string)
- middle_name (string)
- email (string)
- gender* (enum: 'Bride', 'Groom')
- marriage_type* (enum: 'First', 'Remarriage', 'Divorcee')
- event_id* (integer)
- client_id* (integer)
- birth_date (date, YYYY-MM-DD)
- birth_place (string)
- height (string, e.g., "5'6\"")
- education_qualification (string)
- education_details (string)
- job_business_title (string)
- annual_income (string)
- job_business_location (string)
- complexion (string)
- blood_group (string)
- gotra (string)
- kul (string)
- zodiac (string)
- gan (string)
- nadi (string)
- nakshatra (string)
- charan (string)
- address_line* (text)
- pincode* (string, 6 digits)
- city_village (string)
- tehsil (string)
- district (string)
- state* (string)
- whatsapp_number (string)
- selected_expectations (JSON array)
- other_expectations (text)
- consent_agreed* (boolean)
- photo (file, image only, max 5MB)

Response (201):
{
  "success": true,
  "message": "Candidate registered successfully",
  "batch_id": 123,
  "subscription_expiry": "2026-09-01T00:00:00Z"
}
```

### Lookup Candidate
```http
GET /api/candidates/lookup?mobile=9876543210

Response (200):
{
  "success": true,
  "data": {
    "batch_id": 123,
    "first_name": "John",
    "last_name": "Doe",
    "gender": "Groom",
    "birth_date": "1995-05-15",
    "education_qualification": "B.Tech",
    "job_business_title": "Software Engineer",
    "annual_income": "800000",
    "selected_expectations": ["Educated", "Employed"],
    [...other profile fields]
  }
}

// If not found:
{
  "success": true,
  "data": null
}
```

### Link Candidate to Event
```http
POST /api/candidates/:batch_id/link-event
Content-Type: application/json

Body:
{
  "event_id": 1,
  "client_id": 1,
  "email": "john@example.com",
  "education_qualification": "B.Tech",
  "selected_expectations": ["Educated", "Employed"]
}

Response (200):
{
  "success": true,
  "message": "Candidate linked to event successfully",
  "batch_id": 123,
  "event_id": 1,
  "subscription_expiry": "2026-09-01T00:00:00Z"
}
```

### Get Candidate Profile
```http
GET /api/candidates/:batch_id

Response (200):
{
  "success": true,
  "data": {
    "batch_id": 123,
    "first_name": "John",
    "mobile_number": "9876543210",
    [...all candidate fields],
    "registration_date": "2025-09-01T10:30:00Z"
  }
}
```

---

## Feed & Browsing

### Get Candidate Feed (Cross-Event)
```http
GET /api/feed/candidates?clientId=1&eventId=1&batchId=123

Query Parameters:
- clientId* (integer)
- batchId* (integer) - logged-in candidate's batch_id
- eventId (integer, optional)

Prerequisites:
- Candidate must have active subscription (checked by middleware)

Response (200):
{
  "success": true,
  "message": "Found 45 candidates",
  "data": [
    {
      "batch_id": 456,
      "first_name": "Jane",
      "last_name": "Smith",
      "gender": "Bride",
      "birth_date": "1998-03-20",
      "education_qualification": "M.Tech",
      "job_business_title": "Engineer",
      "height": "5'5\"",
      "complexion": "Fair",
      "blood_group": "O+",
      "selected_expectations": ["Educated", "Settled Abroad"],
      "photo_path": "uploads/abc123.jpg",
      "registration_date": "2025-08-15T09:15:00Z",
      "event_id": 1,
      "user_liked_this": false,
      "user_shortlisted_this": false,
      "this_user_liked_me": true
    },
    ...
  ],
  "stats": {
    "total_events_registered": 2,
    "total_candidates": 45
  }
}

Error Responses:
403 - No active subscription found
400 - Missing required parameters
```

### Like a Candidate
```http
POST /api/feed/like
Content-Type: application/json

Body:
{
  "from_batch_id": 123,
  "to_batch_id": 456,
  "is_liked": true
}

Response (200):
{
  "success": true,
  "message": "Candidate liked"
}
```

### Shortlist a Candidate
```http
POST /api/feed/shortlist
Content-Type: application/json

Body:
{
  "from_batch_id": 123,
  "to_batch_id": 456,
  "is_shortlisted": true
}

Response (200):
{
  "success": true,
  "message": "Candidate shortlisted"
}
```

### Get Candidate Matches
```http
GET /api/feed/matches?batchId=123&clientId=1

Query Parameters:
- batchId* (integer)
- clientId* (integer)

Response (200):
{
  "success": true,
  "data": [
    {
      "batch_id": 456,
      "first_name": "Jane",
      "last_name": "Smith",
      "gender": "Bride",
      "education_qualification": "M.Tech",
      "height": "5'5\"",
      "photo_path": "uploads/xyz789.jpg",
      "candidate_liked_me": true,
      "i_liked_candidate": true,
      "match_status": "mutual_like"
    },
    ...
  ],
  "total": 8
}
```

---

## Subscriptions

### Check Subscription Status
```http
GET /api/subscriptions/status?batchId=123&eventId=1

Query Parameters:
- batchId* (integer)
- eventId (integer, optional)

Response (200):
{
  "success": true,
  "status": "active" | "expired" | "no_subscription",
  "data": [
    {
      "subscription_id": 789,
      "batch_id": 123,
      "event_id": 1,
      "client_id": 1,
      "registration_date": "2025-09-01T10:00:00Z",
      "access_expiry_date": "2026-03-01T10:00:00Z",
      "status": "active",
      "days_remaining": 180
    }
  ]
}
```

---

## Events

### Get Event Details
```http
GET /api/events/:eventId?clientId=1

Query Parameters:
- clientId (integer, optional - for verification)

Response (200):
{
  "success": true,
  "data": {
    "event_id": 1,
    "client_id": 1,
    "event_name": "Pune Matrimony Circle 2025",
    "venue": "YMCA, Pune",
    "event_type": "Matrimony",
    "start_date": "2025-09-15",
    "end_date": "2025-09-20",
    "registration_cutoff_date": "2025-09-10",
    "organizer_name": "Raj Patel",
    "organizer_phone": "9876543210",
    "banner_url": "https://cdn.example.com/banner.jpg",
    "is_active": true,
    "registration_count": 145,
    "subscription_stats": {
      "total": 145,
      "active": 140,
      "expired": 5
    }
  }
}
```

### Create Event
```http
POST /api/events
Content-Type: application/json
Headers: admin_id: 1 (must be client admin or superuser)

Body:
{
  "client_id": 1,
  "event_name": "Pune Matrimony Circle 2025",
  "venue": "YMCA, Pune",
  "event_type": "Matrimony",
  "start_date": "2025-09-15",
  "end_date": "2025-09-20",
  "registration_cutoff_date": "2025-09-10",
  "organizer_name": "Raj Patel",
  "organizer_phone": "9876543210",
  "organizer_whatsapp": "9876543210",
  "banner_url": "https://cdn.example.com/banner.jpg",
  "razorpay_key_id": "rzp_test_xxx",
  "razorpay_registration_amount": 500
}

Response (201):
{
  "success": true,
  "message": "Event created successfully",
  "event_id": 1
}

Error: 409 - Client already has an active event
{
  "success": false,
  "message": "Client already has an active event. Only one active event per client is allowed.",
  "existing_event_id": 2
}
```

### Update Event
```http
PUT /api/events/:eventId
Content-Type: application/json
Headers: admin_id: 1

Body: (any fields to update)
{
  "event_name": "Updated Name",
  "venue": "New Venue",
  "is_active": true,
  "banner_url": "new-url"
}

Response (200):
{
  "success": true,
  "message": "Event updated successfully"
}
```

### Get Events for Client
```http
GET /api/clients/:clientId/events?includeInactive=false
Headers: admin_id: 1

Query Parameters:
- includeInactive (boolean, default: false)

Response (200):
{
  "success": true,
  "data": [
    {
      "event_id": 1,
      "event_name": "Pune Matrimony Circle 2025",
      "is_active": true,
      "start_date": "2025-09-15",
      "registration_count": 145,
      ...
    }
  ],
  "total": 3
}
```

### Get Registration Link
```http
GET /api/events/:eventId/registration-link

Response (200):
{
  "success": true,
  "registration_link": "http://localhost:3000/register/1/1",
  "event_id": 1,
  "client_id": 1
}
```

---

## Clients

### Get Client Details
```http
GET /api/clients/:clientId

Response (200):
{
  "success": true,
  "data": {
    "client_id": 1,
    "client_name": "Pune Matrimony Circle",
    "address": "123 Main St, Pune",
    "phone_number": "9876543210",
    "contact_email": "info@punematrimony.com",
    "is_active": true,
    "committee": {
      "adhyaksha_name": "Raj Patel",
      "adhyaksha_phone": "9876543210",
      "upa_adhyaksha_name": "Priya Sharma",
      "khajindar_name": "Amit Kumar",
      "sachiv_name": "Neha Singh",
      "upasachiv_name": "Rajesh Dubey",
      ...
    }
  }
}
```

### Create Client (Superuser Only)
```http
POST /api/clients
Content-Type: application/json
Headers: admin_id: 1 (must be superuser)

Body:
{
  "client_name": "Mumbai Matrimony Association",
  "address": "456 Park Ave, Mumbai",
  "phone_number": "9123456789",
  "contact_email": "info@mumbaimatrimony.com"
}

Response (201):
{
  "success": true,
  "message": "Client created successfully",
  "client_id": 2
}

Error: 409 - Duplicate phone number
{
  "success": false,
  "message": "Client with this phone number already exists"
}
```

### Get All Clients (Superuser Only)
```http
GET /api/clients
Headers: admin_id: 1 (must be superuser)

Response (200):
{
  "success": true,
  "data": [
    {
      "client_id": 1,
      "client_name": "Pune Matrimony Circle",
      "phone_number": "9876543210",
      "is_active": true
    },
    ...
  ],
  "total": 5
}
```

### Update Committee
```http
PUT /api/clients/:clientId/committee
Content-Type: application/json
Headers: admin_id: 1

Body:
{
  "adhyaksha_name": "Raj Patel",
  "adhyaksha_phone": "9876543210",
  "adhyaksha_email": "raj@example.com",
  "upa_adhyaksha_name": "Priya Sharma",
  "upa_adhyaksha_phone": "9876543211",
  "upa_adhyaksha_email": "priya@example.com",
  "khajindar_name": "Amit Kumar",
  "khajindar_phone": "9876543212",
  "sachiv_name": "Neha Singh",
  "sachiv_phone": "9876543213",
  "upasachiv_name": "Rajesh Dubey",
  "upasachiv_phone": "9876543214"
}

Response (200):
{
  "success": true,
  "message": "Committee updated successfully"
}
```

### Assign Admin to Client (Superuser Only)
```http
POST /api/clients/:clientId/assign-admin
Content-Type: application/json
Headers: admin_id: 1 (must be superuser)

Body:
{
  "admin_id": 5,
  "can_view_forms": true,
  "can_generate_links": true,
  "can_view_registrations": true
}

Response (200):
{
  "success": true,
  "message": "Admin assigned to client successfully"
}
```

### Get Client Admins
```http
GET /api/clients/:clientId/admins
Headers: admin_id: 1

Response (200):
{
  "success": true,
  "data": [
    {
      "admin_id": 5,
      "name": "John Admin",
      "email": "john@example.com",
      "phone_number": "9876543210",
      "can_view_forms": true,
      "can_generate_links": true,
      "can_view_registrations": true
    }
  ]
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Missing or invalid parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Access denied or subscription expired |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Constraint violation (e.g., one active event per client) |
| 413 | Payload Too Large - File exceeds size limit |
| 500 | Internal Server Error - Server error |

---

## Common Errors

### "No active subscription found"
**Cause:** Candidate's subscription has expired or doesn't exist
**Solution:** Call `/api/subscriptions/status` to check, then re-register if needed

### "Client already has an active event"
**Cause:** Trying to activate/create a second active event
**Solution:** Deactivate the existing event or use a different client

### "Access denied. Not authorized for this client"
**Cause:** Client admin accessing a client they're not mapped to
**Solution:** Request superuser to assign you to the client

### "File size exceeds 5MB limit"
**Cause:** Photo upload exceeds maximum size
**Solution:** Compress image or use smaller file

### "Only JPEG and PNG images allowed"
**Cause:** Invalid image format
**Solution:** Convert to JPEG or PNG format

---

## Examples

### Complete Registration Flow

```bash
# 1. Check if candidate exists
curl -X GET "http://localhost:5000/api/candidates/lookup?mobile=9876543210"

# 2a. If exists, link to event
curl -X POST "http://localhost:5000/api/candidates/123/link-event" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "client_id": 1
  }'

# 2b. If not exists, register new
curl -X POST "http://localhost:5000/api/candidates/register" \
  -F "mobile_number=9876543210" \
  -F "first_name=John" \
  -F "gender=Groom" \
  -F "marriage_type=First" \
  -F "event_id=1" \
  -F "client_id=1" \
  -F "address_line=123 Main St" \
  -F "pincode=411001" \
  -F "state=Maharashtra" \
  -F "consent_agreed=true" \
  -F "photo=@/path/to/photo.jpg"

# 3. Check subscription status
curl -X GET "http://localhost:5000/api/subscriptions/status?batchId=123&clientId=1"

# 4. Get candidate feed
curl -X GET "http://localhost:5000/api/feed/candidates?clientId=1&batchId=123"

# 5. Like a candidate
curl -X POST "http://localhost:5000/api/feed/like" \
  -H "Content-Type: application/json" \
  -d '{
    "from_batch_id": 123,
    "to_batch_id": 456,
    "is_liked": true
  }'
```

---

## Rate Limiting

Currently not implemented. Consider adding in production:
- 100 requests per minute per IP
- 10 file uploads per minute per user
- 1000 candidate browsing requests per minute

---

## Pagination

Not implemented in v1. Consider adding for large datasets:
- `limit` parameter (default 50, max 100)
- `offset` parameter (default 0)

Example: `GET /api/feed/candidates?limit=20&offset=0`
