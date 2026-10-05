# Admin Panel Documentation

## Overview

The Admin Panel provides comprehensive management tools for the PCMC (matrimonial) platform with the following capabilities:

- **Super User**: Full control over admins, users, and platform configuration
- **Admin**: Can manage users, deactivate/activate accounts, and view events
- **User**: Can only edit their own profile after login

---

## Setup Instructions

### Step 1: Create Database Tables

Run the SQL script to create all required tables:

```bash
mysql -u root -p akhil_pune_bhavsar < database_schema.sql
```

Or copy-paste the contents of `database_schema.sql` into MySQL Workbench.

**Tables Created:**
- `events` - Event configuration per year
- `roles` - Role definitions (super_user, admin, user)
- `admins` - Admin user records
- `activity_logs` - Track all admin actions
- `candidates` - Updated with new columns: `is_active`, `is_admin`, `admin_notes`, `last_admin_action_by`

### Step 2: Initialize Super User

Call the super user setup endpoint to create the first super user:

**Endpoint:** `POST /api/setup-superuser`

**Request:**
```json
{
  "email": "superuser@example.com",
  "password": "your_secure_password"
}
```

**Response:**
```json
{
  "message": "Super User created successfully!",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "superuser@example.com",
    "role": "super_user"
  }
}
```

**Note:** Once a super user exists, this endpoint will reject any further attempts to create another super user.

### Step 3: Import Admin Panel Component

In your main React app (e.g., `App.jsx`):

```javascript
import AdminPanel from './components/AdminPanel';

function App() {
  const [token, setToken] = useState(null);
  
  return (
    <>
      {/* ... other routes ... */}
      {token && <AdminPanel token={token} />}
    </>
  );
}
```

---

## API Endpoints

### Authentication

#### Super User Setup
- **POST** `/api/setup-superuser`
- Create the first super user
- Body: `{ email, password }`
- Returns: `accessToken`, `user`

### User Management (Admin Only)

#### Get All Users
- **GET** `/api/admin/users`
- Headers: `Authorization: Bearer <token>`
- Returns: Array of users

#### Deactivate User
- **PUT** `/api/admin/deactivate-user/:user_id`
- Body: `{ reason: "string" }`
- Only admins can deactivate users

#### Activate User
- **PUT** `/api/admin/activate-user/:user_id`
- Reactivate a deactivated user

#### Edit User Profile
- **PUT** `/api/admin/edit-user/:user_id`
- Allowed fields:
  - `first_name`, `middle_name`, `last_name`
  - `email`, `mobile`, `whatsapp`
  - `expectations`, `admin_notes`
- Example:
  ```json
  {
    "first_name": "John",
    "admin_notes": "Profile verified"
  }
  ```

### Event Management (Admin Only)

#### Get All Events
- **GET** `/api/admin/events`
- Returns: Array of events for each year

#### Create Event
- **POST** `/api/admin/events`
- Body:
  ```json
  {
    "event_year": 2025,
    "registration_cutoff_day": 15,
    "last_edit_day": 28
  }
  ```
- `registration_cutoff_day`: Day of month when new registrations close
- `last_edit_day`: Last day of month when users can edit profiles

#### Update Event
- **PUT** `/api/admin/events/:event_id`
- Update registration or edit cutoff dates

### Admin Management (Super User Only)

#### Get All Admins
- **GET** `/api/admin/admins`
- Returns: List of all admin users

#### Create Admin
- **POST** `/api/admin/create-admin`
- Body:
  ```json
  {
    "user_id": 5,
    "role_name": "admin"
  }
  ```
- `role_name`: "admin" or "super_user"
- Only super users can create admins

#### Update Admin
- **PUT** `/api/admin/update-admin/:admin_id`
- Body: `{ role_name, is_active }`
- Update admin role or activation status

#### Deactivate Admin
- **DELETE** `/api/admin/deactivate-admin/:admin_id`
- Only super users can deactivate admins

### Activity Logs

#### Get Activity Logs
- **GET** `/api/admin/activity-logs`
- Returns: Last 100 admin actions
- Tracks: who did what, when, and on which records

---

## Admin Panel Features

### Dashboard Tab
- Overview statistics:
  - Total Users
  - Total Admins
  - Active Events
  - Recent Activity Logs

### Users Tab
- **View all users** with their status (Active/Inactive)
- **Deactivate users** with optional reason
- **Activate deactivated users**
- **Edit user profiles** (admin can edit any user's data)

### Events Tab
- **Create new events** for each year with:
  - Event year
  - Registration cutoff day
  - Last edit day
- **View all events** by year
- **Update event settings**

### Admins Tab
- **View all admin accounts** with roles and status
- **Create new admins** (super user only)
- **Deactivate admin accounts** (super user only)
- **Filter by role** (Admin, Super User)

### Activity Logs Tab
- **Track all admin actions**:
  - User creation/deactivation
  - Profile edits
  - Event management
  - Admin creation/removal
- Shows: Admin name, action, table affected, timestamp

---

## User Management Workflow

### Registering a New User
1. User registers via the registration form (existing feature)
2. Account is created with `is_active = TRUE`, `is_admin = FALSE`

### Admin Deactivating a User
1. Admin goes to Users tab
2. Finds user and clicks "Deactivate"
3. Optionally provides a reason
4. User account is marked as `is_active = FALSE`
5. User cannot login until reactivated

### Editing User Profile
1. Admin goes to Users tab
2. Clicks "Edit" on a user
3. Changes allowed fields
4. Changes are saved with `last_admin_action_by` timestamp

### User Self-Edit (After Login)
- Users can only edit their own profiles via the update endpoint
- Protected by token verification: `if (payload.id !== userId)`

---

## Event Configuration

### Example Event Setup

**Event for 2025:**
- Registration cutoff day: **15th** of the month
- Last edit day: **28th** of the month

**Meaning:**
- Users can register until the 15th of any month
- After the 15th, no new registrations are accepted
- Users can still edit their existing profiles until the 28th

### Multiple Year Setup

Create separate events for each year:

```bash
# 2025
POST /api/admin/events
{ "event_year": 2025, "registration_cutoff_day": 15, "last_edit_day": 28 }

# 2026
POST /api/admin/events
{ "event_year": 2026, "registration_cutoff_day": 15, "last_edit_day": 28 }
```

---

## Role-Based Permissions

### Super User Permissions
✅ Create/update/deactivate admins
✅ Create/update events
✅ Deactivate/activate users
✅ Edit user profiles
✅ View activity logs
✅ View all admins and users

### Admin Permissions
✅ Deactivate/activate users
✅ Edit user profiles
✅ View events
✅ View activity logs
❌ Cannot create/deactivate admins
❌ Cannot access super user functions

### User Permissions
✅ Edit own profile (after login)
❌ View other users
❌ Access admin panel
❌ Create/deactivate other users

---

## Security Features

1. **Token-Based Authentication**
   - All admin endpoints require Bearer token
   - Tokens expire after 15 minutes (access) or 7 days (refresh)

2. **Role-Based Access Control**
   - Verified on every request
   - Super user operations are restricted

3. **Activity Logging**
   - Every admin action is logged
   - Tracks who did what and when

4. **Data Validation**
   - Only allowed fields can be updated
   - Input validation on all endpoints

5. **Password Hashing**
   - Bcrypt with salt rounds
   - Never stored in plain text

---

## Testing the Admin Panel

### 1. Setup Super User
```bash
curl -X POST http://localhost:5000/api/setup-superuser \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "TestPassword123"
  }'
```

### 2. Login to Get Token
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "TestPassword123"
  }'
```

### 3. Create an Event
```bash
curl -X POST http://localhost:5000/api/admin/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "event_year": 2025,
    "registration_cutoff_day": 15,
    "last_edit_day": 28
  }'
```

### 4. Get All Users
```bash
curl -X GET http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer <your_token>"
```

### 5. Create Admin
```bash
curl -X POST http://localhost:5000/api/admin/create-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "user_id": 2,
    "role_name": "admin"
  }'
```

---

## Troubleshooting

### Issue: "Super user already exists"
- Only one super user can be created
- If you need to reset, delete the admin records from the database

### Issue: "Not authorized as admin"
- User is not in the admins table
- Create admin via super user setup

### Issue: "Only super users can create admins"
- Use a super user account token, not a regular admin

### Issue: Tokens expired
- Access token expires in 15 minutes
- Use refresh token to get new access token via `/auth/refresh`

### Issue: Can't deactivate admin
- Only super users can deactivate admins
- Verify you're using super user token

---

## Database Queries

### View All Admins
```sql
SELECT a.id, c.email, c.first_name, r.role_name, a.is_active
FROM admins a
JOIN candidates c ON a.user_id = c.id
JOIN roles r ON a.role_id = r.id;
```

### View Admin Activity
```sql
SELECT a.admin_id, c.first_name, a.action, a.table_name, a.created_at
FROM activity_logs a
JOIN admins ad ON a.admin_id = ad.id
JOIN candidates c ON ad.user_id = c.id
ORDER BY a.created_at DESC
LIMIT 50;
```

### Deactivate All Users (Caution!)
```sql
UPDATE candidates SET is_active = FALSE WHERE is_admin = FALSE;
```

---

## Next Steps

1. ✅ Setup database tables
2. ✅ Create super user
3. ✅ Create additional admin accounts
4. ✅ Configure events for your years
5. ✅ Use admin panel to manage users
6. Monitor activity logs for audit trail

---

**Admin Panel is now ready to use!** 🎉
