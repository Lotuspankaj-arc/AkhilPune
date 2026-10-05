# Quick Setup Guide - Admin Panel

## What's Been Created

### Database Schema
- ✅ `events` table - Event configuration per year
- ✅ `roles` table - Super User, Admin, User roles  
- ✅ `admins` table - Admin user records
- ✅ `activity_logs` table - Track all admin actions
- ✅ Updated `candidates` table with new columns

### Backend APIs
- ✅ `/api/setup-superuser` - Create first super user
- ✅ `/api/admin/users` - Get/manage users
- ✅ `/api/admin/events` - Create/update events
- ✅ `/api/admin/admins` - Manage admins
- ✅ `/api/admin/deactivate-user` - Deactivate users
- ✅ `/api/admin/edit-user` - Edit user profiles
- ✅ `/api/admin/activity-logs` - View admin activity

### Frontend Components
- ✅ `AdminPanel.jsx` - Full admin dashboard with 5 tabs:
  - Dashboard (statistics)
  - Users (management)
  - Events (configuration)
  - Admins (management)
  - Activity Logs (audit trail)
- ✅ `AdminPanel.css` - Responsive styling

---

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Setup
```bash
cd c:\Users\Pankaj Bhavsar\source\repos\PCMC
mysql -u root -p akhil_pune_bhavsar < database_schema.sql
```

### Step 2: Create Super User
Make a POST request to setup super user:

**Using curl:**
```bash
curl -X POST http://localhost:5000/api/setup-superuser \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@pcmc.com",
    "password": "YourSecurePassword123"
  }'
```

**Using Postman:**
- URL: `http://localhost:5000/api/setup-superuser`
- Method: POST
- Body (JSON):
```json
{
  "email": "superadmin@pcmc.com",
  "password": "YourSecurePassword123"
}
```

Copy the `accessToken` from the response.

### Step 3: Login with Super User
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@pcmc.com",
    "password": "YourSecurePassword123"
  }'
```

### Step 4: Create an Event
```bash
curl -X POST http://localhost:5000/api/admin/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken_from_step2>" \
  -d '{
    "event_year": 2025,
    "registration_cutoff_day": 15,
    "last_edit_day": 28
  }'
```

### Step 5: Use Admin Panel in React
```javascript
import AdminPanel from './components/AdminPanel';

// Inside your App component
<AdminPanel token={accessToken} />
```

---

## Key Features

### Super User Can:
- ✅ Create new admin accounts
- ✅ Update admin roles
- ✅ Deactivate admin accounts
- ✅ Create/update events
- ✅ Deactivate/activate any user
- ✅ Edit any user's profile
- ✅ View all activity logs

### Admin Can:
- ✅ Deactivate/activate users
- ✅ Edit user profiles
- ✅ View events
- ✅ View activity logs
- ❌ Cannot manage admins
- ❌ Cannot access super user functions

### Regular User Can:
- ✅ Edit their own profile (after login)
- ✅ View their own details
- ❌ Access admin panel

---

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| Database Schema | [database_schema.sql](database_schema.sql) | SQL to create tables |
| Admin Panel Component | [src/components/AdminPanel.jsx](src/components/AdminPanel.jsx) | React component |
| Admin Panel Styles | [src/components/AdminPanel.css](src/components/AdminPanel.css) | CSS styling |
| Backend Routes | [Server.js](Server.js) | API endpoints |
| Full Documentation | [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md) | Detailed guide |
| Quick Start | [ADMIN_QUICK_START.md](ADMIN_QUICK_START.md) | This file |

---

## Testing Endpoints

### 1. Get All Users
```bash
GET http://localhost:5000/api/admin/users
Headers: Authorization: Bearer <token>
```

### 2. Get All Events
```bash
GET http://localhost:5000/api/admin/events
Headers: Authorization: Bearer <token>
```

### 3. Get All Admins
```bash
GET http://localhost:5000/api/admin/admins
Headers: Authorization: Bearer <token>
```

### 4. Deactivate a User
```bash
PUT http://localhost:5000/api/admin/deactivate-user/2
Headers: Authorization: Bearer <token>
Body: { "reason": "Profile violation" }
```

### 5. Edit User Profile
```bash
PUT http://localhost:5000/api/admin/edit-user/2
Headers: Authorization: Bearer <token>
Body: {
  "first_name": "John",
  "admin_notes": "Verified profile"
}
```

---

## Important Notes

⚠️ **Only one Super User can be created**
- After the first super user exists, `/api/setup-superuser` will reject new requests
- If you need to reset, manually delete admin records from database

⚠️ **Token Expiration**
- Access tokens expire in 15 minutes
- Use `/auth/refresh` endpoint to get new access token using refresh cookie
- Refresh tokens expire in 7 days

⚠️ **Activity Logging**
- All admin actions are logged automatically
- Useful for audit trail and security

⚠️ **User Activation Status**
- New users are created with `is_active = TRUE`
- Deactivated users cannot login
- Admins can reactivate users anytime

---

## Troubleshooting

**Q: Got error "Super user already exists"**
A: Only one super user allowed. If needed, manually delete the admin record from database.

**Q: Token shows "Invalid or expired token"**
A: Tokens expire after 15 minutes. Use `/auth/refresh` to get new token.

**Q: Can't deactivate admin**
A: Only super users can deactivate admins. Use a super user account.

**Q: AdminPanel component not showing**
A: Ensure you passed the `token` prop: `<AdminPanel token={token} />`

**Q: Database error when creating event**
A: Make sure database tables exist. Run `database_schema.sql` first.

---

## Next Steps

1. Run database setup script
2. Create super user via `/api/setup-superuser`
3. Create admin accounts for your team
4. Setup events for each year
5. Integrate AdminPanel component in your React app
6. Start managing users!

---

**Need Help?** See [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md) for detailed documentation.
