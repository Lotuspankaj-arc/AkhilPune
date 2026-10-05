# Admin Login Troubleshooting Guide

## Issue: admin@pcmc.com Cannot Login

### Quick Fixes

#### Option 1: Check Database Status (Recommended First)
```bash
curl http://localhost:5000/api/debug/status
```

This will show:
- ✅ Database connection status
- ✅ If admin@pcmc.com exists
- ✅ If account is active
- ✅ If admin record exists in admins table

**Example Response:**
```json
{
  "superUser": {
    "id": 1,
    "email": "admin@pcmc.com",
    "is_active": "YES",
    "is_admin": "YES",
    "admin_record_exists": "YES",
    "role": "super_user"
  }
}
```

#### Option 2: Reset Admin Account (If Status Shows Issues)
```bash
curl -X POST http://localhost:5000/api/debug/reset-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "Password123"}'
```

This will:
- ✅ Delete existing admin if found
- ✅ Create fresh admin account
- ✅ Set is_active = TRUE
- ✅ Create admin record in admins table

#### Option 3: Run Automated Diagnostic Script
```bash
cd c:\Users\Pankaj Bhavsar\source\repos\PCMC
node scripts/test_admin.js
```

This script will:
- ✅ Check database connection
- ✅ Check if admin exists
- ✅ Try to login
- ✅ Reset admin if needed
- ✅ Verify login works

---

## Common Issues & Solutions

### Issue 1: "User not found. Please register."
**Cause:** Admin account doesn't exist in database

**Solution:**
```bash
# Create super user
curl -X POST http://localhost:5000/api/setup-superuser \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "Password123"}'
```

**Or reset:**
```bash
curl -X POST http://localhost:5000/api/debug/reset-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "Password123"}'
```

---

### Issue 2: "Invalid password."
**Cause:** Password doesn't match the hashed password in database

**Possible reasons:**
1. Wrong password being used
2. Password wasn't properly hashed during creation
3. Database corruption

**Solution:**
```bash
# Reset admin with new password
curl -X POST http://localhost:5000/api/debug/reset-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "NewPassword123"}'

# Then try logging in with new password
```

---

### Issue 3: "Account is deactivated. Please contact administrator."
**Cause:** `is_active` flag is set to FALSE in candidates table

**This happens when:**
- Admin was deactivated via admin panel
- Database corruption
- Accidental deactivation

**Solution:**

Using SQL directly (if you have MySQL access):
```sql
UPDATE candidates 
SET is_active = TRUE 
WHERE email = 'admin@pcmc.com';
```

**Or use reset endpoint:**
```bash
curl -X POST http://localhost:5000/api/debug/reset-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "Password123"}'
```

---

### Issue 4: "Super user already exists"
**Cause:** `/api/setup-superuser` was already called and admin exists

**Solution:** This is normal! The endpoint is protecting against duplicate super users.

**To recreate:**
1. Use `/api/debug/reset-admin` endpoint
2. Or manually delete and recreate in database

---

### Issue 5: Login works but token invalid in admin panel
**Cause:** Token expired or not being passed correctly

**Solution:**
- Tokens expire in 15 minutes
- Make sure you're passing: `Authorization: Bearer <token>` in headers
- Use `/auth/refresh` to get new token:

```bash
curl -X POST http://localhost:5000/auth/refresh \
  -H "Cookie: refreshToken=<refresh_token_cookie>"
```

---

## Complete Step-by-Step Recovery

If admin account is completely broken, follow these steps:

### Step 1: Stop the server
```bash
# Press Ctrl+C in terminal
```

### Step 2: Check database
```bash
mysql -u root -p akhil_pune_bhavsar
SELECT email, is_active, is_admin FROM candidates WHERE email='admin@pcmc.com';
SELECT * FROM admins WHERE user_id=(SELECT id FROM candidates WHERE email='admin@pcmc.com');
EXIT;
```

### Step 3: Delete old records (if corrupted)
```sql
-- Be careful with this!
DELETE FROM admins WHERE user_id IN (SELECT id FROM candidates WHERE email='admin@pcmc.com');
DELETE FROM candidates WHERE email='admin@pcmc.com';
```

### Step 4: Start server again
```bash
npm run dev
```

### Step 5: Create fresh admin account
```bash
curl -X POST http://localhost:5000/api/setup-superuser \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "Password123"}'
```

### Step 6: Test login
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pcmc.com", "password": "Password123"}'
```

---

## Debug Endpoints

### Check System Status
```
GET /api/debug/status
```
Shows: Database connection, admin existence, account status

### Reset Admin Account
```
POST /api/debug/reset-admin
Body: { "email": "admin@pcmc.com", "password": "NewPassword" }
```
Creates fresh admin account, overwrites existing if present

---

## Prevention Tips

1. **Backup your database regularly**
   ```sql
   mysqldump -u root -p akhil_pune_bhavsar > backup.sql
   ```

2. **Don't accidentally deactivate super user**
   - Only deactivate via admin panel intentionally
   - Keep backup credentials

3. **Use strong passwords**
   - Super user password should be strong
   - Change password periodically

4. **Monitor activity logs**
   - Check `/api/admin/activity-logs` for suspicious actions
   - Who made changes and when

5. **Test after changes**
   - Always test login after admin panel operations
   - Keep debug endpoints to verify status

---

## Still Having Issues?

If none of these solutions work:

1. **Verify Server is Running**
   ```bash
   curl http://localhost:5000/api/debug/status
   # Should respond with status data
   ```

2. **Check Database Connection**
   - Is MySQL running?
   - Is database 'akhil_pune_bhavsar' created?
   - Can you connect manually?

3. **Verify Tables Exist**
   ```bash
   # Run this in MySQL:
   mysql -u root -p akhil_pune_bhavsar < database_schema.sql
   ```

4. **Check Server Logs**
   - Look at terminal where `npm run dev` is running
   - Look for error messages

5. **Test Individual Endpoints**
   ```bash
   # Test database
   curl http://localhost:5000/api/debug/status
   
   # Test registration (to confirm database works)
   curl -X POST http://localhost:5000/api/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"test123","firstName":"Test"}'
   ```

---

## For Developers

If modifying admin login logic, ensure:

1. ✅ Check `is_active` flag in login endpoint
2. ✅ Verify admin record exists in admins table
3. ✅ Hash passwords with bcrypt
4. ✅ Log all authentication attempts
5. ✅ Return clear error messages
6. ✅ Implement rate limiting for failed logins

---

**Last Updated:** 2026-07-12
**Debug Tools Available:** Yes ✅
