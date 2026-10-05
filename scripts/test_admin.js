#!/usr/bin/env node

/**
 * Admin Account Test & Fix Script
 * Run this to diagnose and fix admin@pcmc.com login issues
 */

const API_BASE = 'http://localhost:5000';
const ADMIN_EMAIL = process.env.SUPER_USER_EMAIL;
const ADMIN_PASSWORD = process.env.SUPER_USER_PASSWORD;

// Test 1: Check database status
async function testDatabaseStatus() {
    console.log('\n📊 Step 1: Checking Database Status...');
    try {
        const res = await fetch(`${API_BASE}/api/debug/status`);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        return data;
    } catch (err) {
        console.error('❌ Error:', err.message);
        return null;
    }
}

// Test 2: Try to login
async function testLogin() {
    console.log('\n🔑 Step 2: Testing Login...');
    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD
            })
        });
        const data = await res.json();
        
        if (res.ok) {
            console.log('✅ Login successful!');
            return data.accessToken;
        } else {
            console.error('❌ Login failed:', data.error);
            return null;
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        return null;
    }
}

// Test 3: Create/Reset admin account
async function resetAdminAccount(email, password) {
    console.log(`\n🔄 Step 3: Resetting Admin Account (${email})...`);
    try {
        const res = await fetch(`${API_BASE}/api/debug/reset-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            console.log('✅ Admin account created/reset successfully!');
            console.log('Response:', data);
            return true;
        } else {
            console.error('❌ Reset failed:', data.error);
            console.error('Details:', data.details);
            return false;
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        return false;
    }
}

// Test 4: Create super user (if not exists)
async function createSuperUser(email, password) {
    console.log(`\n➕ Step 4: Creating Super User (${email})...`);
    try {
        const res = await fetch(`${API_BASE}/api/setup-superuser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            console.log('✅ Super user created successfully!');
            console.log('Token:', data.accessToken);
            return data.accessToken;
        } else {
            console.error('❌ Creation failed:', data.error);
            return null;
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        return null;
    }
}

// Main test flow
async function runTests() {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.error('Set SUPER_USER_EMAIL and SUPER_USER_PASSWORD before running this diagnostic.');
        process.exit(1);
    }

    console.log('🚀 Admin Account Diagnostic Tool');
    console.log('================================\n');

    // Step 1: Check status
    const status = await testDatabaseStatus();
    
    if (!status) {
        console.error('\n❌ Cannot connect to server. Make sure it\'s running on port 5000');
        process.exit(1);
    }

    // Check if super user exists
    if (status.superUser === 'Not found - Please call /api/setup-superuser') {
        console.log('\n⚠️  Super user not found. Creating...');
        await createSuperUser(ADMIN_EMAIL, ADMIN_PASSWORD);
    } else if (typeof status.superUser === 'object') {
        console.log('\n✅ Super user found:');
        console.log(status.superUser);
        
        if (status.superUser.is_active === 'NO (DEACTIVATED)') {
            console.log('\n⚠️  Admin account is DEACTIVATED!');
            console.log('Attempting to reset...');
            await resetAdminAccount(ADMIN_EMAIL, ADMIN_PASSWORD);
        }
    }

    // Step 2: Try to login
    console.log('\n🔄 Retesting login...');
    const token = await testLogin();
    
    if (token) {
        console.log('\n✅ SUCCESS! Admin can now login.');
        console.log(`Email: ${ADMIN_EMAIL}`);
        console.log('Password: supplied through environment');
    } else {
        console.log('\n❌ Login still failing. Please check:');
        console.log('1. Server is running (npm run dev)');
        console.log('2. Database is running');
        console.log('3. Database tables are created (run database_schema.sql)');
        console.log('\n🔧 To manually fix:');
        console.log('1. Call POST /api/debug/reset-admin with email and password');
        console.log('2. Or delete the admin and recreate via /api/setup-superuser');
    }
}

// Run the tests
runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
