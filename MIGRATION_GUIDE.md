# Database & Backend Migration Guide

## Overview
This document outlines the changes made to the database schema, frontend components, and backend server to support the new admin and event management system.

## Files Changed/Created

### 1. **Database Schema** (`database_schema_v2.sql`)
- **New Tables**: `admin_users`, `auth_credentials`, `activity_logs`
- **Updated**: `candidates`, `events`, `roles`, `teams`, `volunteers`, `volunteer_team_assignments`
- **Features**:
  - Language-based multi-tenancy support
  - Separate admin user management
  - Event-linked candidate registration
  - Activity logging for audit trail
  - Team & Role management for volunteers

### 2. **Frontend Component** (`AdminPanel_v2.jsx`)
- **Improvements**:
  - Separated form state (`adminFormData` and `eventFormData`) to prevent data contamination
  - Fixed `useEffect` dependencies to prevent infinite loops
  - Added proper `useCallback` hooks for fetch functions
  - Inline edit mode for events
  - FormData handling for multipart file uploads (organizer photo)
  - Better error handling and message display

### 3. **Backend Server** (`Server_v2.js`)
- **Migration from mysql2 to mysql2/promise** for async/await support
- **Connection pooling** for better performance
- **New API Endpoints**:
  - `/api/register` - Registration with event validation
  - `/api/login` - Login with JWT tokens
  - `/api/admin/users` - Get all users
  - `/api/admin/admins` - Get all admins
  - `/api/admin/events` - Create/Read events
  - `/api/admin/events/:id` - Update events
  - `/api/admin/create-admin` - Create new admin
  - `/api/admin/deactivate-admin/:id` - Deactivate admin
  - `/api/admin/deactivate-user/:id` - Deactivate user
  - `/api/admin/activate-user/:id` - Activate user
  - `/api/admin/activity-logs` - Get activity logs

## Key Features Implemented

### 1. **Event-Based Registration**
- Registration blocked if no active event exists
- Automatically links candidates to current event
- Returns error: "Registration is currently closed. There is no active event at this time."

### 2. **Admin Management**
- Create admins from existing candidates
- Track admin roles (Admin, Super User)
- Deactivate/Activate admins
- Super user flag support

### 3. **Activity Logging**
- Tracks all admin actions
- Logs old and new values for changes
- Stores in `activity_logs` table
- 100 most recent logs retrievable via API

### 4. **File Upload**
- Organizer photos stored in `/uploads` folder
- Multer configured for 10MB file limit
- Separate file uploads for events

### 5. **JWT Authentication**
- Access tokens (15 min expiry)
- Refresh tokens (7 days expiry)
- HttpOnly cookies for refresh tokens
- Token verification middleware (`verifyToken`)

## Migration Steps

### Step 1: Update Database
```bash
mysql -u root -p akhil_pune_bhavsar < database_schema_v2.sql
```

### Step 2: Install Dependencies
```bash
npm install mysql2 dotenv
```

### Step 3: Create `.env` file
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=replace_with_your_database_password
DB_NAME=akhil_pune_bhavsar
JWT_SECRET=your_jwt_secret
REFRESH_SECRET=your_refresh_secret
PORT=5000
```

### Step 4: Replace Files
- Backend: Use `Server_v2.js` instead of `Server.js`
- Frontend: Use `AdminPanel_v2.jsx` instead of current `AdminPanel.jsx`

### Step 5: Test Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Register
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123","firstName":"John","middleName":"","lastName":"Doe",...}'

# Login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123"}'
```

## Gaps Filled

### 1. **State Management**
- **Issue**: Form data contamination between tabs
- **Solution**: Separated `adminFormData` and `eventFormData`

### 2. **File Upload**
- **Issue**: FormData not properly handled in original AdminPanel
- **Solution**: Proper FormData construction and Content-Type headers

### 3. **JWT Dependencies**
- **Issue**: useEffect calling functions without proper dependencies
- **Solution**: Added `useCallback` with proper dependency arrays

### 4. **Database Async/Await**
- **Issue**: Callback-based DB queries hard to maintain
- **Solution**: Switched to mysql2/promise with connection pooling

### 5. **Admin Management**
- **Issue**: No proper admin user table structure
- **Solution**: Created `admin_users` table with proper relationships

### 6. **Activity Logging**
- **Issue**: No audit trail for admin actions
- **Solution**: Added `activity_logs` table and logging function

### 7. **Error Handling**
- **Issue**: Generic error messages
- **Solution**: Specific error codes and messages for different scenarios

## Testing Checklist

- [ ] Database migration successful
- [ ] Server starts without errors
- [ ] Register endpoint validates active events
- [ ] Login returns JWT tokens
- [ ] Admin can create events
- [ ] Admin can manage users
- [ ] Activity logs are recorded
- [ ] File uploads work for organizer photos
- [ ] All API endpoints return correct data
- [ ] Authentication middleware protects endpoints

## Next Steps

1. **Email Verification**: Add email verification during registration
2. **Payment Integration**: If needed for event registration
3. **Email Notifications**: Notify admins of events
4. **Advanced Filtering**: Filter candidates by event, date range
5. **Batch Operations**: Bulk user management capabilities
6. **Volunteer Management**: Complete volunteer assignment flows
