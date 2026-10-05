/**
 * INTEGRATION GUIDE: Multi-Tenant Platform
 * 
 * Steps to integrate all components into your existing Server.js
 * 
 * === STEP 1: Install Dependencies ===
 * npm install multer uuid
 * 
 * === STEP 2: Directory Structure ===
 * Ensure these directories exist:
 * - /controllers (create if missing)
 * - /middleware (create if missing)
 * - /routes (create if missing)
 * - /migrations (create if missing)
 * - /uploads (create if missing) - for photo storage
 * 
 * === STEP 3: Copy Files ===
 * Copy the following files to their respective directories:
 * 
 * Controllers:
 * - /controllers/candidateController.js
 * - /controllers/candidateFeedController.js
 * - /controllers/clientController.js
 * - /controllers/eventsController.js
 * 
 * Middleware:
 * - /middleware/rbacMiddleware.js
 * 
 * Routes:
 * - /routes/apiRoutes.js
 * 
 * Migrations:
 * - /migrations/001_multi_tenant_schema.sql
 * 
 * React Components:
 * - /src/components/DynamicEventForm.jsx
 * - /src/components/DynamicEventForm.css
 * 
 * Documentation:
 * - /IMPLEMENTATION_GUIDE.md
 * 
 * === STEP 4: Database Setup ===
 * Run the SQL migration:
 * mysql -u root -p akhil_pune_bhavsar < migrations/001_multi_tenant_schema.sql
 * 
 * === STEP 5: Server.js Integration ===
 * Add the following code to your Server.js:
 */

// ==========================================
// STEP 5A: Add imports at the top
// ==========================================

// Existing imports...
const express = require('express');
const cors = require('cors');
// ... other existing imports

// NEW IMPORTS:
const multer = require('multer');
const path = require('path');
const apiRoutes = require('./routes/apiRoutes');

// ==========================================
// STEP 5B: Initialize Express app
// ==========================================

const app = express();

// ==========================================
// STEP 5C: Middleware configuration
// ==========================================

// Existing middleware...
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// NEW: Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// STEP 5D: API Routes Integration
// ==========================================

// NEW: Mount the new multi-tenant API routes
app.use('/api', apiRoutes);

// ==========================================
// STEP 5E: Error handling middleware (keep at end)
// ==========================================

// Existing error handlers...
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ==========================================
// STEP 5F: Start server
// ==========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// ==========================================
// STEP 6: React Router Setup
// ==========================================

// In your React App or main routing file (e.g., App.jsx or src/routes/Routes.jsx)
// Add the following:

/*
import DynamicEventForm from './components/DynamicEventForm';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing routes */}
        
        {/* NEW ROUTE: Dynamic event registration form */}
        <Route path="/register/:clientId/:eventId" element={<DynamicEventForm />} />
        
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
*/

// ==========================================
// STEP 7: Environment Variables (Optional)
// ==========================================

// Add to your .env file:
/*
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
*/

// ==========================================
// STEP 8: Testing the Integration
// ==========================================

/*
Test URLs:

1. Register new candidate:
   POST http://localhost:5000/api/candidates/register
   Content-Type: multipart/form-data
   Body:
   {
     "mobile_number": "9876543210",
     "first_name": "John",
     "last_name": "Doe",
     "gender": "Groom",
     "marriage_type": "First",
     "event_id": 1,
     "client_id": 1,
     "address_line": "123 Main St",
     "pincode": "411001",
     "state": "Maharashtra",
     "consent_agreed": true,
     "photo": <file>
   }

2. Lookup candidate:
   GET http://localhost:5000/api/candidates/lookup?mobile=9876543210

3. Get candidate feed:
   GET http://localhost:5000/api/feed/candidates?clientId=1&eventId=1&batchId=123

4. Create client (superuser):
   POST http://localhost:5000/api/clients
   Headers: admin_id: 1 (superuser)
   Body:
   {
     "client_name": "Pune Matrimony Circle",
     "address": "Pune, Maharashtra",
     "phone_number": "9876543210",
     "contact_email": "info@punematrimony.com"
   }

5. Get registration link:
   GET http://localhost:5000/api/events/1/registration-link

6. Frontend registration page:
   http://localhost:3000/register/1/1
*/

// ==========================================
// STEP 9: Verify Database Connection
// ==========================================

/*
Ensure your mysqlDb.js (database connection file) is working:

// In mysqlDb.js, verify:
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'akhil_pune_bhavsar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
*/

// ==========================================
// STEP 10: Troubleshooting
// ==========================================

/*
Common issues:

1. "Cannot find module 'multer'"
   Solution: npm install multer uuid

2. "Table doesn't exist"
   Solution: Run the migration SQL file

3. "Access denied" errors
   Solution: Check RBAC middleware - ensure admin_id is passed in headers/body/query

4. "File upload fails"
   Solution: Ensure /uploads directory exists and is writable

5. "CORS errors"
   Solution: Ensure CORS is configured correctly in Server.js

For detailed troubleshooting, see IMPLEMENTATION_GUIDE.md
*/

// ==========================================
// SUMMARY
// ==========================================

/*
What's been added:

✓ Multi-tenant schema with 6 new tables
✓ React dynamic form component with auto-fill
✓ 4 backend controllers (candidates, feed, clients, events)
✓ RBAC middleware for access control
✓ Stored procedures for data integrity
✓ API routes with proper middleware chaining
✓ Complete documentation

The platform now supports:
- Multiple client organizations
- Cross-event candidate visibility
- Subscription-based access control (6 months)
- Role-based admin management
- Dynamic event registration forms
- Audit logging

Total files created: 11
Total API endpoints: 27
Database modifications: 6 new tables, 3 new views, 2 procedures
*/
