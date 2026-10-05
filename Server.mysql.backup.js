import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

dotenv.config();

if (process.env.ALLOW_LEGACY_BACKUP_SERVER !== 'true') {
    throw new Error('Server.mysql.backup.js is archived and disabled. Run Server.js instead.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Multer setup
const upload = multer({ 
    dest: path.join(__dirname, '../uploads'),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Database Connection Pool
// Works with local MySQL (dev) or any managed MySQL provider (Aiven, Railway,
// Clever Cloud, PlanetScale, etc.) - just set the DB_* env vars accordingly.
// Managed providers reachable over the internet almost always require SSL.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'akhil_pune_bhavsar',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

const ROLE_SUPER_USER = 'super_user';
const ROLE_ADMIN = 'admin';
const ROLE_CANDIDATE = 'candidate';

const normalizeRoleName = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'user') return ROLE_CANDIDATE;
    return raw;
};

const getRoleIdByName = async (conn, roleName) => {
    const normalized = normalizeRoleName(roleName);
    const [rows] = await conn.query(
        'SELECT role_id FROM roles WHERE LOWER(role_name) = ? ORDER BY role_id ASC LIMIT 1',
        [normalized]
    );
    return rows.length ? rows[0].role_id : null;
};

const pickValue = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            if (value.length > 0) return value[0];
            continue;
        }
        return value;
    }
    return undefined;
};

const normalizeDobForDb = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const match = raw.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (!match) return null;

    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
};

const normalizeStringArray = (value) => {
    if (value === undefined || value === null || value === '') return [];
    const items = Array.isArray(value) ? value : [value];
    return items
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};

const normalizeCandidatePayload = (body = {}) => {
    const expectations = normalizeStringArray(body.expectations || body.selected_expectations);
    const birthDate = normalizeDobForDb(pickValue(body.dob, body.birth_date, body.birthDate));

    return {
        email: String(pickValue(body.email) || '').trim(),
        password: String(pickValue(body.password) || ''),
        firstName: String(pickValue(body.firstName, body.first_name) || '').trim(),
        middleName: String(pickValue(body.middleName, body.middle_name) || '').trim(),
        lastName: String(pickValue(body.lastName, body.last_name) || '').trim(),
        gender: String(pickValue(body.gender) || '').trim(),
        marriageType: String(pickValue(body.marriageCategory, body.maritalStatus, body.marriage_type) || '').trim(),
        address: String(pickValue(body.address, body.address_line) || '').trim(),
        pincode: String(pickValue(body.pincode) || '').trim(),
        city: String(pickValue(body.city, body.city_village, body.cityVillage) || '').trim(),
        tehsil: String(pickValue(body.tehsil) || '').trim(),
        district: String(pickValue(body.district) || '').trim(),
        state: String(pickValue(body.state) || '').trim(),
        mobile: String(pickValue(body.mobile, body.mobile_number, body.mobileNumber) || '').trim(),
        whatsapp: String(pickValue(body.whatsapp, body.whatsapp_number, body.whatsappNumber) || '').trim(),
        height: String(pickValue(body.height) || '').trim(),
        complexion: String(pickValue(body.complexion) || '').trim(),
        education: String(pickValue(body.education, body.education_qualification) || '').trim(),
        educationDetails: String(pickValue(body.educationDetails, body.education_details) || '').trim(),
        job: String(pickValue(body.job, body.jobTitle, body.job_business_title) || '').trim(),
        income: String(pickValue(body.income, body.annual_income) || '').trim(),
        jobLocation: String(pickValue(body.jobLocation, body.job_business_location) || '').trim(),
        mamekul: String(pickValue(body.mamekul) || '').trim(),
        birthDate,
        birthTime: String(pickValue(body.birthTime, body.birth_time) || '').trim(),
        birthPlace: String(pickValue(body.birthPlace, body.birth_place) || '').trim(),
        bloodGroup: String(pickValue(body.bloodGroup, body.blood_group) || '').trim(),
        gotra: String(pickValue(body.gotra, body.kul) || '').trim(),
        zodiac: String(pickValue(body.zodiac) || '').trim(),
        gan: String(pickValue(body.gan) || '').trim(),
        nadi: String(pickValue(body.nadi) || '').trim(),
        charan: String(pickValue(body.charan) || '').trim(),
        nakshatra: String(pickValue(body.nakshatra) || '').trim(),
        attendedActiveEvent: String(pickValue(body.attendedActiveEvent, body.attended_active_event) || '').trim().toLowerCase(),
        willAttendEvent: String(pickValue(body.willAttendEvent, body.will_attend_event) || '').trim().toLowerCase(),
        attendeeCount: String(pickValue(body.attendeeCount, body.attendee_count) || '').trim(),
        customExpectation: String(pickValue(body.customExpectation, body.other_expectations) || '').trim(),
        stateId: pickValue(body.stateId, body.location_state_id) || null,
        districtId: pickValue(body.districtId, body.location_district_id) || null,
        subdistrictId: pickValue(body.subdistrictId, body.location_subdistrict_id) || null,
        locationId: pickValue(body.locationId, body.location_master_id) || null,
        expectations
    };
};

const SAMPLE_PINCODE_MASTER_ROWS = [
    {
        state: 'MAHARASHTRA',
        district: 'PUNE',
        city: 'Pimpri-Chinchwad',
        postOffice: 'Chinchwadgaon S.O',
        pincode: '411033',
        tehsil: '',
        villageNameLocal: ''
    },
    {
        state: 'MAHARASHTRA',
        district: 'PUNE',
        city: 'Pune City East',
        postOffice: 'Dapodi Bazar S.O',
        pincode: '411012',
        tehsil: 'Haveli',
        villageNameLocal: '\u0926\u093e\u092a\u094b\u0921\u0940'
    },
    {
        state: 'MAHARASHTRA',
        district: 'PUNE',
        city: 'Pimpri-Chinchwad',
        postOffice: 'Punawale',
        pincode: '411033',
        tehsil: 'Mulshi',
        villageNameLocal: '\u092a\u0941\u0928\u093e\u0935\u0933\u0947'
    }
];

const DEFAULT_EDUCATION_MASTER_ROWS = [
    { qualification: 'B.A.', educationDetail: 'B.A. Arts', sortOrder: 10 },
    { qualification: 'B.Com', educationDetail: 'B.Com General', sortOrder: 20 },
    { qualification: 'B.Sc', educationDetail: 'B.Sc Computer Science', sortOrder: 30 },
    { qualification: 'B.Sc', educationDetail: 'B.Sc Physics', sortOrder: 40 },
    { qualification: 'B.Sc', educationDetail: 'B.Sc Chemistry', sortOrder: 50 },
    { qualification: 'B.Sc', educationDetail: 'B.Sc Mathematics', sortOrder: 60 },
    { qualification: 'B.Sc', educationDetail: 'B.Sc Biology', sortOrder: 70 },
    { qualification: 'B.E.', educationDetail: 'B.E. Computer Engineering', sortOrder: 80 },
    { qualification: 'B.Tech', educationDetail: 'B.Tech Information Technology', sortOrder: 90 },
    { qualification: 'M.Com', educationDetail: 'M.Com General', sortOrder: 100 },
    { qualification: 'M.Sc', educationDetail: 'M.Sc Computer Science', sortOrder: 110 },
    { qualification: 'M.Sc', educationDetail: 'M.Sc Physics', sortOrder: 120 },
    { qualification: 'MBA', educationDetail: 'MBA Finance', sortOrder: 130 },
    { qualification: 'MBA', educationDetail: 'MBA Marketing', sortOrder: 140 },
    { qualification: 'Diploma', educationDetail: 'Diploma Engineering', sortOrder: 150 }
];

const DEFAULT_EXPECTATION_MASTER_ROWS = [
    'Good family background',
    'Well educated',
    'Respectful nature',
    'Simple living',
    'Vegetarian',
    'Non-smoker',
    'Non-drinker',
    'Working professional',
    'Own house',
    'Well mannered',
    'Family oriented',
    'Financially stable'
];

const getNormalizedSubdistrictName = (value) => String(value || '').trim();

const upsertStateMaster = async (conn, stateName) => {
    const normalizedStateName = String(stateName || '').trim();
    const [result] = await conn.query(
        `INSERT INTO state_master (state_name, is_active)
         VALUES (?, TRUE)
         ON DUPLICATE KEY UPDATE state_id = LAST_INSERT_ID(state_id), is_active = VALUES(is_active)`,
        [normalizedStateName]
    );
    return result.insertId;
};

const upsertDistrictMaster = async (conn, stateId, districtName) => {
    const normalizedDistrictName = String(districtName || '').trim();
    const [result] = await conn.query(
        `INSERT INTO district_master (state_id, district_name, is_active)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE district_id = LAST_INSERT_ID(district_id), is_active = VALUES(is_active)`,
        [stateId, normalizedDistrictName]
    );
    return result.insertId;
};

const upsertSubdistrictMaster = async (conn, districtId, subdistrictName) => {
    const normalizedSubdistrictName = getNormalizedSubdistrictName(subdistrictName);
    const [result] = await conn.query(
        `INSERT INTO subdistrict_master (district_id, subdistrict_name, is_active)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE subdistrict_id = LAST_INSERT_ID(subdistrict_id), is_active = VALUES(is_active)`,
        [districtId, normalizedSubdistrictName]
    );
    return result.insertId;
};

const upsertLocationMaster = async (conn, row) => {
    const stateId = await upsertStateMaster(conn, row.state);
    const districtId = await upsertDistrictMaster(conn, stateId, row.district);
    const subdistrictId = await upsertSubdistrictMaster(conn, districtId, row.tehsil);

    const [result] = await conn.query(
        `INSERT INTO location_master (
            state_id, district_id, subdistrict_id, pincode, city, post_office, village_name_local, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
            village_name_local = VALUES(village_name_local),
            is_active = VALUES(is_active),
            location_id = LAST_INSERT_ID(location_id)`,
        [
            stateId,
            districtId,
            subdistrictId,
            row.pincode,
            String(row.city || '').trim(),
            String(row.postOffice || '').trim(),
            row.villageNameLocal ? String(row.villageNameLocal).trim() : null
        ]
    );

    return { stateId, districtId, subdistrictId, locationId: result.insertId };
};

const addColumnIfMissing = async (conn, tableName, columnName, definitionSql) => {
    const [rows] = await conn.query(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

    if (rows.length === 0) {
        await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
    }
};

const ensureVarcharMinLength = async (conn, tableName, columnName, minLength, nullable = true) => {
    const [rows] = await conn.query(
        `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

    if (rows.length === 0) return;

    const dataType = String(rows[0].DATA_TYPE || '').toLowerCase();
    const currentLength = Number(rows[0].CHARACTER_MAXIMUM_LENGTH || 0);

    if (dataType === 'varchar' && currentLength > 0 && currentLength < minLength) {
        await conn.query(
            `ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} VARCHAR(${minLength}) ${nullable ? 'NULL' : 'NOT NULL'}`
        );
    }
};

const ensureCoreAuthSetup = async () => {
    const conn = await pool.getConnection();
    try {
        await addColumnIfMissing(conn, 'auth_credentials', 'role_id', 'INT NULL');
        await addColumnIfMissing(conn, 'auth_credentials', 'user_id', 'INT NULL');

        await addColumnIfMissing(conn, 'events', 'organizer_photo', 'VARCHAR(255) NULL');
        await addColumnIfMissing(conn, 'events', 'registration_banner_path', 'VARCHAR(255) NULL');
        await addColumnIfMissing(conn, 'events', 'is_active', 'BOOLEAN DEFAULT TRUE');
        await addColumnIfMissing(conn, 'events', 'razorpay_key_id', 'VARCHAR(255) NULL');
        await addColumnIfMissing(conn, 'events', 'razorpay_key_secret', 'TEXT NULL');
        await addColumnIfMissing(conn, 'events', 'razorpay_registration_amount', 'DECIMAL(10,2) NULL');

        const candidateColumns = [
            ['district', 'VARCHAR(100) NULL'],
            ['height', 'VARCHAR(20) NULL'],
            ['education_details', 'TEXT NULL'],
            ['birth_place', 'VARCHAR(100) NULL'],
            ['gotra', 'VARCHAR(100) NULL'],
            ['photo_path', 'VARCHAR(255) NULL'],
            ['other_expectations', 'TEXT NULL'],
            ['location_state_id', 'INT NULL'],
            ['location_district_id', 'INT NULL'],
            ['location_subdistrict_id', 'INT NULL'],
            ['location_master_id', 'INT NULL'],
            ['razorpay_order_id', 'VARCHAR(255) NULL'],
            ['razorpay_payment_id', 'VARCHAR(255) NULL'],
            ['razorpay_signature', 'VARCHAR(255) NULL'],
            ['payment_status', 'VARCHAR(50) NULL'],
            ['payment_details', 'TEXT NULL'],
            ['payment_date', 'DATETIME NULL'],
            ['attended_active_event', 'VARCHAR(10) NULL'],
            ['will_attend_event', 'VARCHAR(10) NULL'],
            ['attendee_count', 'INT NULL']
        ];

        for (const [columnName, definition] of candidateColumns) {
            await addColumnIfMissing(conn, 'candidates', columnName, definition);
        }
        await ensureVarcharMinLength(conn, 'candidates', 'birth_time', 32, true);

        await addColumnIfMissing(conn, 'volunteers', 'photo_url', 'VARCHAR(255) NULL');
        await addColumnIfMissing(conn, 'volunteers', 'group_id', 'INT NULL');

        await conn.query(
            `CREATE TABLE IF NOT EXISTS volunteer_groups (
                group_id INT AUTO_INCREMENT PRIMARY KEY,
                group_name VARCHAR(150) NOT NULL,
                adhyaksha_name VARCHAR(150) NULL,
                khajindar_name VARCHAR(150) NULL,
                upadhyaksha_name VARCHAR(150) NULL,
                sachiv_name VARCHAR(150) NULL,
                upasachiv_name VARCHAR(150) NULL,
                is_active BOOLEAN DEFAULT TRUE,
                update_user INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY ux_volunteer_group_name (group_name)
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS activity_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NULL,
                action VARCHAR(100) NOT NULL,
                table_name VARCHAR(100) NOT NULL,
                record_id VARCHAR(100) NULL,
                old_values JSON NULL,
                new_values JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS state_master (
                state_id INT AUTO_INCREMENT PRIMARY KEY,
                state_name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_state_master (state_name)
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS district_master (
                district_id INT AUTO_INCREMENT PRIMARY KEY,
                state_id INT NOT NULL,
                district_name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_district_master (state_id, district_name),
                CONSTRAINT fk_district_master_state FOREIGN KEY (state_id) REFERENCES state_master(state_id)
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS subdistrict_master (
                subdistrict_id INT AUTO_INCREMENT PRIMARY KEY,
                district_id INT NOT NULL,
                subdistrict_name VARCHAR(150) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_subdistrict_master (district_id, subdistrict_name),
                CONSTRAINT fk_subdistrict_master_district FOREIGN KEY (district_id) REFERENCES district_master(district_id)
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS location_master (
                location_id INT AUTO_INCREMENT PRIMARY KEY,
                state_id INT NOT NULL,
                district_id INT NOT NULL,
                subdistrict_id INT NOT NULL,
                pincode VARCHAR(6) NOT NULL,
                city VARCHAR(150) NOT NULL,
                post_office VARCHAR(150) NOT NULL,
                village_name_local VARCHAR(150) NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_location_master (pincode, post_office, city, subdistrict_id),
                CONSTRAINT fk_location_master_state FOREIGN KEY (state_id) REFERENCES state_master(state_id),
                CONSTRAINT fk_location_master_district FOREIGN KEY (district_id) REFERENCES district_master(district_id),
                CONSTRAINT fk_location_master_subdistrict FOREIGN KEY (subdistrict_id) REFERENCES subdistrict_master(subdistrict_id)
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS education_master (
                education_id INT AUTO_INCREMENT PRIMARY KEY,
                qualification VARCHAR(100) NOT NULL,
                education_detail VARCHAR(150) NOT NULL,
                sort_order INT DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_education_master (qualification, education_detail)
            )`
        );

        await conn.query(
            `CREATE TABLE IF NOT EXISTS expectation_master (
                expectation_id INT AUTO_INCREMENT PRIMARY KEY,
                expectation_name VARCHAR(150) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_expectation_master (expectation_name)
            )`
        );

        for (const row of SAMPLE_PINCODE_MASTER_ROWS) {
            await upsertLocationMaster(conn, row);
        }

        for (const row of DEFAULT_EDUCATION_MASTER_ROWS) {
            await conn.query(
                `INSERT IGNORE INTO education_master (
                    qualification, education_detail, sort_order, is_active
                ) VALUES (?, ?, ?, TRUE)`,
                [row.qualification, row.educationDetail, row.sortOrder]
            );
        }

        const [existingExpectationRows] = await conn.query(
            'SELECT selected_expectations FROM candidates WHERE selected_expectations IS NOT NULL'
        );

        const uniqueExpectations = new Set();
        for (const row of existingExpectationRows) {
            const raw = row.selected_expectations;
            if (!raw) continue;
            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (Array.isArray(parsed)) {
                    parsed.forEach((item) => {
                        const value = String(item || '').trim();
                        if (value) uniqueExpectations.add(value);
                    });
                }
            } catch (error) {
                String(raw)
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .forEach((item) => uniqueExpectations.add(item));
            }
        }

        if (uniqueExpectations.size === 0) {
            DEFAULT_EXPECTATION_MASTER_ROWS.forEach((item) => uniqueExpectations.add(item));
        }

        for (const expectationName of uniqueExpectations) {
            await conn.query(
                'INSERT IGNORE INTO expectation_master (expectation_name, is_active) VALUES (?, TRUE)',
                [expectationName]
            );
        }

        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, ?, TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = ?)`,
            [ROLE_SUPER_USER, ROLE_SUPER_USER]
        );
        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, ?, TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = ?)`,
            [ROLE_ADMIN, ROLE_ADMIN]
        );
        await conn.query(
            `INSERT INTO roles (language_id, role_name, is_active)
             SELECT NULL, ?, TRUE
             WHERE NOT EXISTS (SELECT 1 FROM roles WHERE LOWER(role_name) = ?)`,
            [ROLE_CANDIDATE, ROLE_CANDIDATE]
        );

        const superUserEmail = process.env.SUPER_USER_EMAIL || 'admin@pcmc.com';
        const superUserPassword = process.env.SUPER_USER_PASSWORD || 'password123';
        const superUserPhone = process.env.SUPER_USER_PHONE || '';

        let [superAdminRows] = await conn.query(
            'SELECT admin_id FROM admin_users WHERE is_super_user = TRUE ORDER BY admin_id ASC LIMIT 1'
        );

        let superAdminId = superAdminRows.length ? superAdminRows[0].admin_id : null;
        if (!superAdminId) {
            const [adminInsert] = await conn.query(
                'INSERT INTO admin_users (name, phone_number, is_super_user, is_active) VALUES (?, ?, TRUE, TRUE)',
                ['Super User', superUserPhone]
            );
            superAdminId = adminInsert.insertId;
        }

        const superRoleId = await getRoleIdByName(conn, ROLE_SUPER_USER);
        const [existingSuperCred] = await conn.query(
            'SELECT id FROM auth_credentials WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [superUserEmail]
        );

        if (existingSuperCred.length === 0) {
            const hashed = await bcrypt.hash(superUserPassword, 10);
            await conn.query(
                'INSERT INTO auth_credentials (email, password, user_id, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
                [superUserEmail, hashed, superAdminId, superRoleId]
            );
        } else {
            await conn.query(
                'UPDATE auth_credentials SET user_id = ?, role_id = ?, is_active = TRUE WHERE id = ?',
                [superAdminId, superRoleId, existingSuperCred[0].id]
            );
        }
    } finally {
        conn.release();
    }
};

const getRazorpayConfig = () => ({
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    amount: Number(process.env.RAZORPAY_REGISTRATION_AMOUNT || 100),
    currency: process.env.RAZORPAY_CURRENCY || 'INR'
});

const getActiveEventPaymentConfig = async (conn) => {
    const [events] = await conn.query(
        `SELECT event_id, event_name, razorpay_key_id, razorpay_key_secret, razorpay_registration_amount
         FROM events
         WHERE is_active = TRUE
           AND registration_cutoff_date >= CURDATE()
         ORDER BY start_date DESC
         LIMIT 1`
    );

    return events[0] || null;
};

const resolveRazorpayCredentials = ({ activeEventConfig, fallbackConfig }) => {
    const eventKeyId = String(activeEventConfig?.razorpay_key_id || '').trim();
    const eventKeySecret = String(activeEventConfig?.razorpay_key_secret || '').trim();
    const fallbackKeyId = String(fallbackConfig?.keyId || '').trim();
    const fallbackKeySecret = String(fallbackConfig?.keySecret || '').trim();

    if (eventKeyId && eventKeySecret) {
        return { keyId: eventKeyId, keySecret: eventKeySecret, source: 'event' };
    }

    if (eventKeyId && !eventKeySecret) {
        return {
            keyId: '',
            keySecret: '',
            source: 'invalid',
            error: 'Active event has Razorpay Key ID but missing Razorpay Key Secret. Update event payment setup.'
        };
    }

    if (fallbackKeyId && fallbackKeySecret) {
        return { keyId: fallbackKeyId, keySecret: fallbackKeySecret, source: 'env' };
    }

    return {
        keyId: '',
        keySecret: '',
        source: 'missing',
        error: 'Razorpay credentials are not configured. Add active event key/secret or environment key/secret.'
    };
};

const verifyRazorpaySignature = ({ orderId, paymentId, signature, keySecret }) => {
    if (!keySecret) return false;

    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    return expectedSignature === signature;
};

const sendRegistrationSuccessEmail = async ({
    to,
    fullName,
    userId,
    password,
    batchId,
    eventName,
    orderId,
    paymentId,
    paymentDate
}) => {
    const smtpHost = process.env.SMTP_HOST || '';
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const fromEmail = process.env.EMAIL_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail || !to) {
        const missing = [];
        if (!smtpHost) missing.push('SMTP_HOST');
        if (!smtpUser) missing.push('SMTP_USER');
        if (!smtpPass) missing.push('SMTP_PASS');
        if (!fromEmail) missing.push('EMAIL_FROM');
        if (!to) missing.push('recipient_email');
        console.warn(`Registration email skipped: missing ${missing.join(', ')}`);
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass
        }
    });

    const qrPayload = JSON.stringify({
        batchId,
        userId,
        eventName,
        paymentId,
        paymentDate
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, { width: 240, margin: 1 });

    await transporter.sendMail({
        from: fromEmail,
        to,
        subject: `Registration Successful - Batch ${batchId}`,
        text: `Namaskar ${fullName || 'Candidate'},\n\nYour registration is successful.\nUser ID: ${userId || to}\nPassword: ${password || 'N/A'}\nBatch ID: ${batchId}\nEvent: ${eventName || 'Active Event'}\nOrder ID: ${orderId || 'N/A'}\nPayment ID: ${paymentId || 'N/A'}\nPayment Date: ${paymentDate || 'N/A'}\n\nQR code is attached in email for event day entry pass.\n\nThank you.`,
        html: `<p>Namaskar ${fullName || 'Candidate'},</p><p>Your registration is successful.</p><ul><li><strong>User ID:</strong> ${userId || to}</li><li><strong>Password:</strong> ${password || 'N/A'}</li><li><strong>Batch ID:</strong> ${batchId}</li><li><strong>Event:</strong> ${eventName || 'Active Event'}</li><li><strong>Order ID:</strong> ${orderId || 'N/A'}</li><li><strong>Payment ID:</strong> ${paymentId || 'N/A'}</li><li><strong>Payment Date:</strong> ${paymentDate || 'N/A'}</li></ul><p><strong>Entry Pass QR:</strong></p><p><img src="${qrCodeDataUrl}" alt="Event Entry QR" /></p><p>Thank you.</p>`
    });

    return true;
};

// JWT Middleware
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
        req.userId = decoded.id;
        req.role = normalizeRoleName(decoded.role);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const requireAnyRole = (...allowedRoles) => (req, res, next) => {
    const role = normalizeRoleName(req.role);
    if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
};

// Activity Logger
const logActivity = async (adminId, action, tableName, recordId, oldValues = null, newValues = null) => {
    try {
        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO activity_logs (admin_id, action, table_name, record_id, old_values, new_values) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, action, tableName, recordId, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null]
        );
        conn.release();
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/register', upload.single('photo'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // Check if active event exists
                const [activeEvents] = await conn.query(
                    `SELECT event_id, event_name, start_date, registration_cutoff_date
                         FROM events
                         WHERE is_active = TRUE
                             AND registration_cutoff_date >= CURDATE()
                         ORDER BY start_date DESC
                         LIMIT 1`
                );
        
        if (activeEvents.length === 0) {
            conn.release();
            return res.status(403).json({ 
                error: 'Registration is currently closed. There is no active event at this time.' 
            });
        }

        const eventId = activeEvents[0].event_id;
        const activeEventName = activeEvents[0].event_name;
        const activeEventDate = activeEvents[0].start_date;
        const activeEventConfig = await getActiveEventPaymentConfig(conn);
        const payload = normalizeCandidatePayload(req.body);
        const { email, password } = payload;

        if (req.body?.dob && !payload.birthDate) {
            conn.release();
            return res.status(400).json({ error: 'Invalid Date of Birth. Please use DD-MM-YYYY.' });
        }

        if (!payload.marriageType) {
            conn.release();
            return res.status(400).json({ error: 'Marriage status is required' });
        }

        const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
        const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
        const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            conn.release();
            return res.status(400).json({ error: 'Payment verification is required before saving registration.' });
        }

        const credentialConfig = resolveRazorpayCredentials({
            activeEventConfig,
            fallbackConfig: getRazorpayConfig()
        });

        if (!credentialConfig.keySecret) {
            conn.release();
            return res.status(500).json({ error: credentialConfig.error || 'Razorpay credentials are not configured.' });
        }

        const signatureSecret = credentialConfig.keySecret;

        if (!verifyRazorpaySignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature, keySecret: signatureSecret })) {
            conn.release();
            return res.status(400).json({ error: 'Invalid payment verification data.' });
        }

        // Idempotency and recovery: if same payment/email already created candidate, return success.
        const [existingByPayment] = await conn.query(
            `SELECT batch_id, email, payment_status, razorpay_order_id, razorpay_payment_id
             FROM candidates
             WHERE razorpay_payment_id = ? OR razorpay_order_id = ?
             ORDER BY batch_id DESC
             LIMIT 1`,
            [razorpayPaymentId, razorpayOrderId]
        );

        const [existingByEmail] = await conn.query(
            `SELECT batch_id, email, payment_status, razorpay_order_id, razorpay_payment_id
             FROM candidates
             WHERE LOWER(email) = LOWER(?)
             ORDER BY batch_id DESC
             LIMIT 1`,
            [email]
        );

        const existingCandidate = existingByPayment[0] || existingByEmail[0] || null;
        if (existingCandidate) {
            const samePayment =
                String(existingCandidate.razorpay_payment_id || '') === razorpayPaymentId ||
                String(existingCandidate.razorpay_order_id || '') === razorpayOrderId;
            const alreadyCaptured = String(existingCandidate.payment_status || '').toLowerCase() === 'captured';

            if (samePayment || alreadyCaptured) {
                const candidateRoleId = await getRoleIdByName(conn, ROLE_CANDIDATE);
                const [existingCred] = await conn.query(
                    'SELECT id FROM auth_credentials WHERE user_id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
                    [existingCandidate.batch_id, existingCandidate.email || email]
                );

                if (existingCred.length === 0 && candidateRoleId) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await conn.query(
                        'INSERT INTO auth_credentials (user_id, email, password, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
                        [existingCandidate.batch_id, existingCandidate.email || email, hashedPassword, candidateRoleId]
                    );
                }

                const [createdCandidate] = await conn.query('SELECT * FROM candidates WHERE batch_id = ?', [existingCandidate.batch_id]);
                conn.release();

                const tokenEmail = existingCandidate.email || email;
                const accessToken = jwt.sign({ id: existingCandidate.batch_id, email: tokenEmail }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '15m' });
                const refreshToken = jwt.sign({ id: existingCandidate.batch_id, email: tokenEmail }, process.env.REFRESH_SECRET || 'dev_refresh', { expiresIn: '7d' });

                res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
                return res.status(200).json({
                    message: 'Registration already saved for this payment.',
                    accessToken,
                    candidateId: existingCandidate.batch_id,
                    user: createdCandidate[0] || null
                });
            }

            conn.release();
            return res.status(409).json({ error: 'Email already registered' });
        }

        const [existingAuth] = await conn.query(
            'SELECT id FROM auth_credentials WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );

        if (existingAuth.length > 0) {
            conn.release();
            return res.status(409).json({ error: 'Email already registered in login credentials' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
        const paymentDate = new Date();
        const paymentDetails = JSON.stringify({
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature,
            amount: Number(activeEventConfig?.razorpay_registration_amount || process.env.RAZORPAY_REGISTRATION_AMOUNT || 0),
            currency: process.env.RAZORPAY_CURRENCY || 'INR',
            capturedAt: paymentDate.toISOString()
        });

        // Insert candidate using explicit columns + generated placeholders to avoid count mismatches.
        const sanitizedExpectations = Array.isArray(payload.expectations)
            ? payload.expectations
                .map((item) => String(item || '').trim())
                .filter((item) => item && item.toLowerCase() !== 'undefined')
            : [];

        const candidateColumns = [
            'event_id', 'first_name', 'middle_name', 'last_name', 'gender',
            'marriage_type', 'address_line', 'pincode', 'city_village', 'tehsil',
            'district', 'state', 'mobile_number', 'whatsapp_number', 'height',
            'education_qualification', 'education_details', 'job_business_title', 'annual_income', 'job_business_location',
            'mamekul', 'birth_date', 'birth_time', 'birth_place', 'complexion',
            'blood_group', 'gotra', 'zodiac', 'gan', 'nadi',
            'charan', 'nakshatra', 'selected_expectations', 'other_expectations', 'photo_path',
            'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature', 'payment_status', 'payment_details', 'payment_date',
            'attended_active_event', 'will_attend_event', 'attendee_count',
            'location_state_id', 'location_district_id', 'location_subdistrict_id', 'location_master_id',
            'is_active'
        ];

        const candidateValues = [
            eventId, payload.firstName, payload.middleName, payload.lastName, payload.gender,
            payload.marriageType, payload.address, payload.pincode,
            payload.city, payload.tehsil,
            payload.district, payload.state, payload.mobile, payload.whatsapp, payload.height,
            payload.education, payload.educationDetails, payload.job, payload.income, payload.jobLocation,
            payload.mamekul, payload.birthDate, payload.birthTime, payload.birthPlace, payload.complexion,
            payload.bloodGroup, payload.gotra, payload.zodiac, payload.gan, payload.nadi,
            payload.charan, payload.nakshatra,
            sanitizedExpectations.length ? JSON.stringify(sanitizedExpectations) : null,
            payload.customExpectation || null,
            photoPath,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            'captured',
            paymentDetails,
            paymentDate,
            payload.attendedActiveEvent || null,
            payload.willAttendEvent || null,
            payload.attendeeCount || null,
            payload.stateId || null,
            payload.districtId || null,
            payload.subdistrictId || null,
            payload.locationId || null,
            true
        ];

        const candidatePlaceholders = candidateColumns.map(() => '?').join(', ');

        if (candidateColumns.length !== candidateValues.length) {
            conn.release();
            return res.status(500).json({
                error: 'Registration payload mapping mismatch.',
                details: {
                    columns: candidateColumns.length,
                    values: candidateValues.length
                }
            });
        }

        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO candidates (${candidateColumns.join(', ')}) VALUES (${candidatePlaceholders})`,
            candidateValues
        );

        const candidateRoleId = await getRoleIdByName(conn, ROLE_CANDIDATE);
        if (!candidateRoleId) {
            await conn.rollback();
            conn.release();
            return res.status(500).json({ error: 'Candidate role is not configured.' });
        }

        // Create auth credentials
        await conn.query(
            'INSERT INTO auth_credentials (user_id, email, password, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
            [result.insertId, email, hashedPassword, candidateRoleId]
        );

        await conn.commit();

        const [createdCandidate] = await conn.query('SELECT * FROM candidates WHERE batch_id = ?', [result.insertId]);

        conn.release();

        try {
            const emailSent = await sendRegistrationSuccessEmail({
                to: email,
                fullName: [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(' '),
                userId: email,
                password,
                batchId: result.insertId,
                eventName: activeEventName,
                orderId: razorpayOrderId,
                paymentId: razorpayPaymentId,
                paymentDate: paymentDate.toLocaleString('en-GB')
            });

            if (emailSent) {
                console.log(`Registration email sent to ${email} for batch ${result.insertId}`);
            } else {
                console.warn(`Registration email not sent to ${email} for batch ${result.insertId}`);
            }
        } catch (mailError) {
            console.error('Registration email send failed:', mailError);
        }

        // Generate tokens
        const accessToken = jwt.sign({ id: result.insertId, email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: result.insertId, email }, process.env.REFRESH_SECRET || 'dev_refresh', { expiresIn: '7d' });

        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
        res.status(201).json({ message: 'Registered successfully!', accessToken, candidateId: result.insertId, user: createdCandidate[0] || null });
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (_rollbackError) { }
            try { conn.release(); } catch (_releaseError) { }
        }
        console.error('Registration error:', error);
        if (error?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already registered. Please login instead.' });
        }
        res.status(500).json({ error: 'Registration failed', details: error?.sqlMessage || error?.message || null });
    }
});

app.post('/api/payment/order', async (req, res) => {
    try {
        const config = getRazorpayConfig();
        const conn = await pool.getConnection();
        const activeEvent = await getActiveEventPaymentConfig(conn);
        conn.release();

        if (!activeEvent) {
            return res.status(403).json({
                error: 'Registration is currently closed. No active event is available for payment.'
            });
        }

        const credentialConfig = resolveRazorpayCredentials({
            activeEventConfig: activeEvent,
            fallbackConfig: config
        });
        const paymentKeyId = credentialConfig.keyId;
        const paymentKeySecret = credentialConfig.keySecret;
        const requestedAmountInInr = Number(activeEvent?.razorpay_registration_amount || config.amount);

        if (!paymentKeyId || !paymentKeySecret) {
            return res.status(500).json({ error: credentialConfig.error || 'Razorpay is not configured for the active event.' });
        }

        if (!Number.isFinite(requestedAmountInInr) || requestedAmountInInr <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount.' });
        }

        const requestedAmountInPaise = Math.round(requestedAmountInInr * 100);

        const paymentClient = new Razorpay({
            key_id: paymentKeyId,
            key_secret: paymentKeySecret
        });

        const order = await paymentClient.orders.create({
            amount: requestedAmountInPaise,
            currency: req.body?.currency || config.currency,
            receipt: `reg_${Date.now()}`,
            notes: {
                purpose: String(req.body?.purpose || 'Registration payment').slice(0, 255)
            }
        });

        return res.json({
            keyId: paymentKeyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt
        });
    } catch (error) {
        console.error('Create payment order error:', error);
        return res.status(500).json({ error: 'Failed to create payment order.' });
    }
});

app.get('/api/events/active-banner', async (_req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [events] = await conn.query(
                        `SELECT event_id, event_name, start_date, end_date, registration_cutoff_date, organizer_photo, registration_banner_path
             FROM events
             WHERE is_active = TRUE
             ORDER BY start_date DESC
             LIMIT 1`
        );

        if (events.length === 0) {
            return res.status(404).json({ error: 'No active event found' });
        }

        const event = events[0];
        const cutoffDate = event.registration_cutoff_date ? new Date(event.registration_cutoff_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isRegistrationOpen = cutoffDate ? cutoffDate >= today : false;

        return res.json({
            event: {
                eventId: event.event_id,
                eventName: event.event_name,
                startDate: event.start_date,
                endDate: event.end_date,
                cutoffDate: event.registration_cutoff_date,
                registrationOpen: isRegistrationOpen,
                organizerPhoto: event.organizer_photo,
                registrationBannerPath: event.registration_banner_path
            }
        });
    } catch (error) {
        console.error('Active banner fetch error:', error);
        return res.status(500).json({ error: 'Failed to load active event banner' });
    } finally {
        conn?.release();
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const conn = await pool.getConnection();

        const [creds] = await conn.query(
            `SELECT ac.id, ac.user_id, ac.role_id, ac.password, ac.is_active,
                    COALESCE(LOWER(r.role_name), ?) AS role_name
             FROM auth_credentials ac
             LEFT JOIN roles r ON r.role_id = ac.role_id
             WHERE LOWER(ac.email) = LOWER(?)
             LIMIT 1`,
            [ROLE_CANDIDATE, email]
        );

        if (creds.length === 0) {
            conn.release();
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const roleName = normalizeRoleName(creds[0].role_name);
        if (roleName !== ROLE_SUPER_USER && !creds[0].is_active) {
            conn.release();
            return res.status(401).json({ error: 'Account is inactive' });
        }

        const isValid = await bcrypt.compare(password, creds[0].password);
        if (!isValid) {
            conn.release();
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isAdmin = roleName === ROLE_SUPER_USER || roleName === ROLE_ADMIN;
        const isSuperUser = roleName === ROLE_SUPER_USER;

        // Get full user details based on role
        let userProfile = {
            id: creds[0].user_id,
            email,
            isAdmin,
            isSuperUser,
            roleName,
            role_id: creds[0].role_id
        };
        
        if (isAdmin && creds[0].user_id) {
             const [admins] = await conn.query('SELECT * FROM admin_users WHERE admin_id = ?', [creds[0].user_id]);
             if (admins.length > 0) userProfile = { ...userProfile, ...admins[0] };
        } else if (creds[0].user_id) {
             const [candidates] = await conn.query('SELECT * FROM candidates WHERE batch_id = ?', [creds[0].user_id]);
             if (candidates.length > 0) {
                 userProfile = { ...userProfile, ...candidates[0] };
             }
        }

           // Candidate profile table may not carry email; preserve auth email for UI/session consistency.
           userProfile.email = userProfile.email || email;

        conn.release();

        const accessToken = jwt.sign({ id: creds[0].user_id, email, role: roleName }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: creds[0].user_id, email, role: roleName }, process.env.REFRESH_SECRET || 'dev_refresh', { expiresIn: '7d' });

        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
        res.json({ message: 'Login successful!', user: userProfile, accessToken });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.put('/api/update/:id', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const role = normalizeRoleName(req.role);
        if (role !== ROLE_CANDIDATE || String(req.userId) !== String(id)) {
            return res.status(403).json({ error: 'Not allowed' });
        }

        const protectedFields = ['firstName', 'middleName', 'lastName', 'first_name', 'middle_name', 'last_name', 'dob', 'birth_date', 'birthDate'];
        const attemptedProtectedEdit = protectedFields.some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
        if (attemptedProtectedEdit) {
            return res.status(400).json({ error: 'Name and date of birth cannot be changed.' });
        }

        const conn = await pool.getConnection();
        const payload = normalizeCandidatePayload(req.body || {});
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

        await conn.query(
            `UPDATE candidates
             SET gender = ?, marriage_type = ?,
                 address_line = ?, pincode = ?, city_village = ?, tehsil = ?, district = ?, state = ?,
                 mobile_number = ?, whatsapp_number = ?, height = ?, education_qualification = ?,
                 education_details = ?, job_business_title = ?, annual_income = ?, job_business_location = ?,
                 mamekul = ?, birth_time = ?, birth_place = ?, complexion = ?, blood_group = ?,
                 gotra = ?, zodiac = ?, gan = ?, nadi = ?, charan = ?, nakshatra = ?, selected_expectations = ?,
                 other_expectations = ?, attended_active_event = ?, will_attend_event = ?, attendee_count = ?,
                 location_state_id = ?, location_district_id = ?,
                 location_subdistrict_id = ?, location_master_id = ?,
                 photo_path = COALESCE(?, photo_path), updated_at = CURRENT_TIMESTAMP
             WHERE batch_id = ?`,
            [
                payload.gender,
                payload.marriageType,
                payload.address,
                payload.pincode,
                payload.city,
                payload.tehsil,
                payload.district,
                payload.state,
                payload.mobile,
                payload.whatsapp,
                payload.height,
                payload.education,
                payload.educationDetails,
                payload.job,
                payload.income,
                payload.jobLocation,
                payload.mamekul,
                payload.birthTime,
                payload.birthPlace,
                payload.complexion,
                payload.bloodGroup,
                payload.gotra,
                payload.zodiac,
                payload.gan,
                payload.nadi,
                payload.charan,
                payload.nakshatra,
                payload.expectations.length ? JSON.stringify(payload.expectations) : null,
                payload.customExpectation || null,
                payload.attendedActiveEvent || null,
                payload.willAttendEvent || null,
                payload.attendeeCount || null,
                payload.stateId || null,
                payload.districtId || null,
                payload.subdistrictId || null,
                payload.locationId || null,
                photoPath,
                id
            ]
        );

        const [updated] = await conn.query('SELECT * FROM candidates WHERE batch_id = ?', [id]);
        conn.release();
        res.json({ message: 'Profile updated successfully!', user: updated[0] || null });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Refresh access token using httpOnly refresh cookie
app.post('/auth/refresh', async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    try {
        const payload = jwt.verify(token, process.env.REFRESH_SECRET || 'dev_refresh');
        let roleName = normalizeRoleName(payload.role || '');

        if (!roleName) {
            const conn = await pool.getConnection();
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(LOWER(r.role_name), ?) AS role_name
                     FROM auth_credentials ac
                     LEFT JOIN roles r ON r.role_id = ac.role_id
                     WHERE ac.user_id = ? OR LOWER(ac.email) = LOWER(?)
                     ORDER BY ac.id ASC
                     LIMIT 1`,
                    [ROLE_CANDIDATE, payload.id || null, payload.email || '']
                );
                roleName = normalizeRoleName(rows[0]?.role_name || ROLE_CANDIDATE);
            } finally {
                conn.release();
            }
        }

        const accessToken = jwt.sign({ id: payload.id, email: payload.email, role: roleName }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '15m' });
        const newRefresh = jwt.sign({ id: payload.id, email: payload.email, role: roleName }, process.env.REFRESH_SECRET || 'dev_refresh', { expiresIn: '7d' });
        res.cookie('refreshToken', newRefresh, { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
        res.json({ accessToken });
    } catch (e) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Logout: clear refresh cookie
app.post('/auth/logout', (req, res) => {
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ message: 'Logged out' });
});

app.get('/api/pincode/:pincode', async (req, res) => {
    const { pincode } = req.params;
    if (!/^[0-9]{6}$/.test(pincode)) {
        return res.status(400).json({ error: 'Invalid pincode' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.query(
                        `SELECT lm.location_id, lm.pincode, lm.city, lm.post_office,
                                        COALESCE(lm.village_name_local, '') AS village_name_local,
                                        sm.state_id, sm.state_name,
                                        dm.district_id, dm.district_name,
                                        sdm.subdistrict_id, COALESCE(sdm.subdistrict_name, '') AS subdistrict_name
                         FROM location_master lm
                         INNER JOIN state_master sm ON sm.state_id = lm.state_id
                         INNER JOIN district_master dm ON dm.district_id = lm.district_id
                         INNER JOIN subdistrict_master sdm ON sdm.subdistrict_id = lm.subdistrict_id
                         WHERE lm.pincode = ?
                             AND lm.is_active = TRUE
                         ORDER BY lm.city ASC, lm.post_office ASC`,
            [pincode]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Pincode not found' });
        }

        const locations = rows.map((row) => ({
            locationId: row.location_id,
            pincode: row.pincode,
            stateId: row.state_id,
            state: row.state_name,
            districtId: row.district_id,
            district: row.district_name,
            subdistrictId: row.subdistrict_id,
            city: row.city,
            tehsil: row.subdistrict_name,
            postOffice: row.post_office,
            villageNameLocal: row.village_name_local,
            displayCity: row.village_name_local || row.post_office || row.city,
            displayLabel: [row.post_office, row.village_name_local || row.city, row.subdistrict_name].filter(Boolean).join(' - ')
        }));

        const toUniqueOptions = (key) => ([...new Set(locations.map((item) => item[key]).filter(Boolean))]
            .map((value) => ({ value, label: value })));

        res.json({
            locations,
            city: locations[0]?.displayCity || '',
            tehsil: locations[0]?.tehsil || '',
            district: locations[0]?.district || '',
            state: locations[0]?.state || '',
            postOfficeOptions: toUniqueOptions('postOffice'),
            cityOptions: toUniqueOptions('displayCity'),
            tehsilOptions: toUniqueOptions('tehsil'),
            districtOptions: toUniqueOptions('district'),
            stateOptions: toUniqueOptions('state')
        });
    } catch (error) {
        console.error('Pincode lookup error:', error);
        res.status(500).json({ error: 'Failed to find pincode location' });
    } finally {
        conn?.release();
    }
});

app.get('/api/master/education', async (_req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT qualification, education_detail, sort_order
             FROM education_master
             WHERE is_active = TRUE
             ORDER BY qualification ASC, sort_order ASC, education_detail ASC`
        );

        const qualificationsMap = new Map();
        for (const row of rows) {
            if (!qualificationsMap.has(row.qualification)) {
                qualificationsMap.set(row.qualification, []);
            }
            qualificationsMap.get(row.qualification).push({
                value: row.education_detail,
                label: row.education_detail
            });
        }

        const qualifications = Array.from(qualificationsMap.entries()).map(([qualification, details]) => ({
            value: qualification,
            label: qualification,
            details
        }));

        res.json({ qualifications });
    } catch (error) {
        console.error('Education master lookup error:', error);
        res.status(500).json({ error: 'Failed to load education master data' });
    } finally {
        conn?.release();
    }
});

app.get('/api/master/expectations', async (_req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            'SELECT expectation_id, expectation_name FROM expectation_master WHERE is_active = TRUE ORDER BY expectation_name ASC'
        );
        conn.release();

        res.json({
            expectations: rows.map((row) => ({
                id: row.expectation_id,
                value: row.expectation_name,
                label: row.expectation_name
            }))
        });
    } catch (error) {
        console.error('Expectation master lookup error:', error);
        res.status(500).json({ error: 'Failed to load expectation master data' });
    }
});

app.get('/api/online-suchi/search', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN, ROLE_CANDIDATE), async (req, res) => {
    let conn;
    try {
        const q = String(req.query.q || '').trim();
        const gender = String(req.query.gender || '').trim();
        const marriageType = String(req.query.marriageType || '').trim();
        const district = String(req.query.district || '').trim();
        const hasIncomeMin = Object.prototype.hasOwnProperty.call(req.query || {}, 'incomeMin');
        const hasIncomeMax = Object.prototype.hasOwnProperty.call(req.query || {}, 'incomeMax');
        const hasAgeMin = Object.prototype.hasOwnProperty.call(req.query || {}, 'ageMin');
        const hasAgeMax = Object.prototype.hasOwnProperty.call(req.query || {}, 'ageMax');
        const incomeMin = Number.parseInt(req.query.incomeMin, 10);
        const incomeMax = Number.parseInt(req.query.incomeMax, 10);
        const ageMin = Number.parseInt(req.query.ageMin, 10);
        const ageMax = Number.parseInt(req.query.ageMax, 10);
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
        const offset = (page - 1) * limit;

        const whereClauses = ['COALESCE(is_active, TRUE) = TRUE'];
        const params = [];

        if (gender === 'Bride' || gender === 'Groom') {
            whereClauses.push('gender = ?');
            params.push(gender);
        }

        if (marriageType === 'First Marriage' || marriageType === 'Re Marriage') {
            whereClauses.push('marriage_type = ?');
            params.push(marriageType);
        }

        if (district) {
            whereClauses.push('district LIKE ?');
            params.push(`%${district}%`);
        }

        if (hasIncomeMin && !Number.isNaN(incomeMin) && incomeMin > 0) {
            whereClauses.push('CAST(COALESCE(annual_income, 0) AS UNSIGNED) >= ?');
            params.push(incomeMin);
        }

        if (hasIncomeMax && !Number.isNaN(incomeMax) && incomeMax > 0) {
            whereClauses.push('CAST(COALESCE(annual_income, 0) AS UNSIGNED) <= ?');
            params.push(incomeMax);
        }

        if (hasAgeMin && !Number.isNaN(ageMin) && ageMin >= 18) {
            whereClauses.push('birth_date IS NOT NULL AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) >= ?');
            params.push(ageMin);
        }

        if (hasAgeMax && !Number.isNaN(ageMax) && ageMax >= 18) {
            whereClauses.push('birth_date IS NOT NULL AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) <= ?');
            params.push(ageMax);
        }

        if (q) {
            whereClauses.push(`(
                CONCAT_WS(' ', first_name, middle_name, last_name) LIKE ?
                OR CAST(batch_id AS CHAR) LIKE ?
                OR mobile_number LIKE ?
                OR whatsapp_number LIKE ?
                OR education_qualification LIKE ?
                OR job_business_title LIKE ?
                OR job_business_location LIKE ?
                OR city_village LIKE ?
                OR district LIKE ?
                OR state LIKE ?
                OR address_line LIKE ?
            )`);
            const like = `%${q}%`;
            params.push(like, like, like, like, like, like, like, like, like, like, like);
        }

        conn = await pool.getConnection();

        const whereSql = whereClauses.join(' AND ');

        const [countRows] = await conn.query(
            `SELECT COUNT(*) AS total
             FROM candidates
             WHERE ${whereSql}`,
            params
        );

        const [rows] = await conn.query(
            `SELECT
                batch_id AS id,
                first_name,
                middle_name,
                last_name,
                mobile_number,
                whatsapp_number,
                gender,
                marriage_type,
                city_village,
                address_line,
                pincode,
                district,
                state,
                TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) AS age,
                education_qualification,
                job_business_title,
                job_business_location,
                annual_income,
                selected_expectations,
                other_expectations,
                payment_status,
                photo_path
             FROM candidates
             WHERE ${whereSql}
             ORDER BY updated_at DESC, batch_id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            profiles: rows,
            page,
            limit,
            total: Number(countRows[0]?.total || 0)
        });
    } catch (error) {
        console.error('Online Suchi search error:', error);
        res.status(500).json({ error: 'Failed to search profiles' });
    } finally {
        conn?.release();
    }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// Get All Users
app.get('/api/admin/users', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [users] = await conn.query(
            `SELECT batch_id as id, first_name, middle_name, last_name, mobile_number as mobile,
                    whatsapp_number as whatsapp, email, gender, marriage_type, city_village as city,
                    district, state, education_qualification as education, job_business_title as job,
                    payment_status, registration_date, is_active
             FROM candidates
             ORDER BY batch_id DESC`
        );
        conn.release();
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get All Admins
app.get('/api/admin/admins', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [admins] = await conn.query(
            `SELECT au.admin_id as id, au.name as first_name, '' as last_name,
                    au.phone_number, au.whatsapp_number, au.photo_url, au.address, au.birthdate,
                    au.is_super_user, au.is_active, ac.email,
                    CASE WHEN au.is_super_user THEN ? ELSE ? END as role_name,
                    au.created_at
             FROM admin_users au
             LEFT JOIN auth_credentials ac ON ac.user_id = au.admin_id
             ORDER BY au.created_at DESC`,
            [ROLE_SUPER_USER, ROLE_ADMIN]
        );
        conn.release();
        res.json({ admins });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

// Create Event
app.post('/api/admin/events', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.fields([{ name: 'organizer_photo', maxCount: 1 }, { name: 'registration_banner', maxCount: 1 }]), async (req, res) => {
    try {
        const { event_name, venue, start_date, end_date, registration_cutoff_date, organizer_name, organizer_phone, organizer_whatsapp, razorpay_key_id, razorpay_key_secret, razorpay_registration_amount } = req.body;
        const photoPath = req.files?.organizer_photo?.[0] ? `/uploads/${req.files.organizer_photo[0].filename}` : null;
        const bannerPath = req.files?.registration_banner?.[0] ? `/uploads/${req.files.registration_banner[0].filename}` : null;

        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO events 
             (event_name, venue, start_date, end_date, registration_cutoff_date, organizer_name, organizer_phone, organizer_whatsapp, organizer_photo, registration_banner_path, razorpay_key_id, razorpay_key_secret, razorpay_registration_amount, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)` ,
            [event_name, venue, start_date, end_date, registration_cutoff_date, organizer_name, organizer_phone, organizer_whatsapp, photoPath, bannerPath, razorpay_key_id || null, razorpay_key_secret || null, razorpay_registration_amount || null, req.userId]
        );

        await logActivity(req.userId, 'CREATE', 'events', null, null, { event_name, venue });
        conn.release();

        res.status(201).json({ message: 'Event created successfully!' });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Get All Events
app.get('/api/admin/events', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [events] = await conn.query(
            `SELECT event_id, event_name, venue, start_date, end_date, registration_cutoff_date, organizer_name,
                    organizer_phone, organizer_whatsapp, organizer_photo, registration_banner_path, razorpay_key_id,
                    NULL AS razorpay_key_secret, razorpay_registration_amount, is_active, created_at, updated_at, created_by
             FROM events ORDER BY created_at DESC`
        );
        conn.release();
        res.json({ events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Update Event
app.put('/api/admin/events/:eventId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.fields([{ name: 'organizer_photo', maxCount: 1 }, { name: 'registration_banner', maxCount: 1 }]), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { event_name, venue, start_date, end_date, registration_cutoff_date, organizer_name, organizer_phone, organizer_whatsapp, razorpay_key_id, razorpay_key_secret, razorpay_registration_amount } = req.body;
        const photoPath = req.files?.organizer_photo?.[0] ? `/uploads/${req.files.organizer_photo[0].filename}` : null;
        const bannerPath = req.files?.registration_banner?.[0] ? `/uploads/${req.files.registration_banner[0].filename}` : null;

        const conn = await pool.getConnection();

        // Get old data for logging
        const [oldData] = await conn.query('SELECT * FROM events WHERE event_id = ?', [eventId]);
        const existingEvent = oldData[0] || {};

        const nextKeyId = String(razorpay_key_id || '').trim() || existingEvent.razorpay_key_id || null;
        const nextKeySecret = String(razorpay_key_secret || '').trim() || existingEvent.razorpay_key_secret || null;
        const nextAmount = String(razorpay_registration_amount || '').trim() || existingEvent.razorpay_registration_amount || null;

        const updateQuery = `UPDATE events
            SET event_name=?, venue=?, start_date=?, end_date=?, registration_cutoff_date=?, organizer_name=?, organizer_phone=?, organizer_whatsapp=?,
                organizer_photo=COALESCE(?, organizer_photo), registration_banner_path=COALESCE(?, registration_banner_path),
                razorpay_key_id=?, razorpay_key_secret=?, razorpay_registration_amount=?
            WHERE event_id=?`;

        const params = [
            event_name,
            venue,
            start_date,
            end_date,
            registration_cutoff_date,
            organizer_name,
            organizer_phone,
            organizer_whatsapp,
            photoPath,
            bannerPath,
            nextKeyId,
            nextKeySecret,
            nextAmount,
            eventId
        ];

        await conn.query(updateQuery, params);

        await logActivity(req.userId, 'UPDATE', 'events', eventId, oldData[0], { event_name, venue });
        conn.release();

        res.json({ message: 'Event updated successfully!' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

app.get('/api/admin/volunteer-groups', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (_req, res) => {
    try {
        const conn = await pool.getConnection();
        const [groups] = await conn.query(
            `SELECT group_id, group_name, adhyaksha_name, khajindar_name, upadhyaksha_name,
                    sachiv_name, upasachiv_name, is_active, created_at, updated_at
             FROM volunteer_groups
             ORDER BY group_name ASC`
        );
        conn.release();
        res.json({ groups });
    } catch (error) {
        console.error('Error fetching volunteer groups:', error);
        res.status(500).json({ error: 'Failed to fetch volunteer groups' });
    }
});

app.post('/api/admin/volunteer-groups', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { group_name, adhyaksha_name, khajindar_name, upadhyaksha_name, sachiv_name, upasachiv_name, is_active } = req.body;
        if (!String(group_name || '').trim()) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const conn = await pool.getConnection();
        const [result] = await conn.query(
            `INSERT INTO volunteer_groups
             (group_name, adhyaksha_name, khajindar_name, upadhyaksha_name, sachiv_name, upasachiv_name, is_active, update_user)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(group_name).trim(),
                String(adhyaksha_name || '').trim() || null,
                String(khajindar_name || '').trim() || null,
                String(upadhyaksha_name || '').trim() || null,
                String(sachiv_name || '').trim() || null,
                String(upasachiv_name || '').trim() || null,
                is_active !== false,
                req.userId || null
            ]
        );
        await logActivity(req.userId, 'CREATE_VOLUNTEER_GROUP', 'volunteer_groups', result.insertId, null, { group_name });
        conn.release();
        res.status(201).json({ message: 'Volunteer group created successfully!' });
    } catch (error) {
        console.error('Error creating volunteer group:', error);
        if (error?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Group name already exists' });
        }
        res.status(500).json({ error: 'Failed to create volunteer group' });
    }
});

app.put('/api/admin/volunteer-groups/:groupId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { groupId } = req.params;
        const { group_name, adhyaksha_name, khajindar_name, upadhyaksha_name, sachiv_name, upasachiv_name, is_active } = req.body;
        if (!String(group_name || '').trim()) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const conn = await pool.getConnection();
        await conn.query(
            `UPDATE volunteer_groups
             SET group_name = ?, adhyaksha_name = ?, khajindar_name = ?, upadhyaksha_name = ?,
                 sachiv_name = ?, upasachiv_name = ?, is_active = ?, update_user = ?, updated_at = CURRENT_TIMESTAMP
             WHERE group_id = ?`,
            [
                String(group_name).trim(),
                String(adhyaksha_name || '').trim() || null,
                String(khajindar_name || '').trim() || null,
                String(upadhyaksha_name || '').trim() || null,
                String(sachiv_name || '').trim() || null,
                String(upasachiv_name || '').trim() || null,
                is_active !== false,
                req.userId || null,
                groupId
            ]
        );
        await logActivity(req.userId, 'UPDATE_VOLUNTEER_GROUP', 'volunteer_groups', groupId, null, { group_name });
        conn.release();
        res.json({ message: 'Volunteer group updated successfully!' });
    } catch (error) {
        console.error('Error updating volunteer group:', error);
        if (error?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Group name already exists' });
        }
        res.status(500).json({ error: 'Failed to update volunteer group' });
    }
});

// Deactivate User
app.put('/api/admin/deactivate-user/:userId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const conn = await pool.getConnection();
        await conn.query('UPDATE candidates SET is_active = FALSE WHERE batch_id = ?', [userId]);

        await logActivity(req.userId, 'DEACTIVATE_USER', 'candidates', userId, null, { reason });
        conn.release();

        res.json({ message: 'User deactivated successfully!' });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

// Activate User
app.put('/api/admin/activate-user/:userId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;

        const conn = await pool.getConnection();
        await conn.query('UPDATE candidates SET is_active = TRUE WHERE batch_id = ?', [userId]);

        await logActivity(req.userId, 'ACTIVATE_USER', 'candidates', userId, null, {});
        conn.release();

        res.json({ message: 'User activated successfully!' });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({ error: 'Failed to activate user' });
    }
});

// Create Admin
app.post('/api/admin/create-admin', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    try {
        const { volunteer_id, name, email, password, phone_number, role_name } = req.body;

        const conn = await pool.getConnection();

        if (!email || !password) {
            conn.release();
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [existingCred] = await conn.query(
            'SELECT id FROM auth_credentials WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );
        if (existingCred.length) {
            conn.release();
            return res.status(409).json({ error: 'Email already exists' });
        }

        const normalizedRole = normalizeRoleName(role_name || ROLE_ADMIN);
        if (![ROLE_ADMIN, ROLE_SUPER_USER].includes(normalizedRole)) {
            conn.release();
            return res.status(400).json({ error: 'Invalid role' });
        }

        const roleId = await getRoleIdByName(conn, normalizedRole);
        const passwordHash = await bcrypt.hash(password, 10);
        let adminProfile = {
            name: String(name || '').trim(),
            phone_number: String(phone_number || '').trim(),
            whatsapp_number: '',
            photo_url: null,
            birthdate: null,
            address: ''
        };

        if (volunteer_id) {
            const [volunteers] = await conn.query(
                'SELECT volunteer_id, volunteer_name, address, photo_url, whatsapp_number, birthdate FROM volunteers WHERE volunteer_id = ? LIMIT 1',
                [volunteer_id]
            );
            if (volunteers.length === 0) {
                conn.release();
                return res.status(404).json({ error: 'Selected volunteer not found' });
            }
            const volunteer = volunteers[0];
            adminProfile = {
                name: volunteer.volunteer_name,
                phone_number: String(phone_number || volunteer.whatsapp_number || '').trim(),
                whatsapp_number: String(volunteer.whatsapp_number || '').trim(),
                photo_url: volunteer.photo_url || null,
                birthdate: volunteer.birthdate || null,
                address: volunteer.address || ''
            };
        }

        if (!adminProfile.name) {
            conn.release();
            return res.status(400).json({ error: 'Select a volunteer or provide a valid admin name' });
        }

        // Create admin user
        const [result] = await conn.query(
            `INSERT INTO admin_users (name, phone_number, whatsapp_number, photo_url, birthdate, address, is_super_user, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [
                adminProfile.name,
                adminProfile.phone_number,
                adminProfile.whatsapp_number,
                adminProfile.photo_url,
                adminProfile.birthdate,
                adminProfile.address,
                normalizedRole === ROLE_SUPER_USER
            ]
        );

        await conn.query(
            'INSERT INTO auth_credentials (email, password, user_id, role_id, is_active) VALUES (?, ?, ?, ?, TRUE)',
            [email, passwordHash, result.insertId, roleId]
        );

        await logActivity(req.userId, 'CREATE_ADMIN', 'admin_users', result.insertId, null, { email, role_name: normalizedRole, volunteer_id: volunteer_id || null });
        conn.release();

        res.status(201).json({ message: 'Admin created successfully!' });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ error: 'Failed to create admin' });
    }
});

// Deactivate Admin
app.delete('/api/admin/deactivate-admin/:adminId', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    try {
        const { adminId } = req.params;

        const conn = await pool.getConnection();
        await conn.query('UPDATE admin_users SET is_active = FALSE WHERE admin_id = ?', [adminId]);
        await conn.query('UPDATE auth_credentials SET is_active = FALSE WHERE user_id = ?', [adminId]);

        await logActivity(req.userId, 'DEACTIVATE_ADMIN', 'admin_users', adminId, null, {});
        conn.release();

        res.json({ message: 'Admin deactivated successfully!' });
    } catch (error) {
        console.error('Error deactivating admin:', error);
        res.status(500).json({ error: 'Failed to deactivate admin' });
    }
});

app.put('/api/admin/events/:eventId/status', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { is_active } = req.body;
        const conn = await pool.getConnection();
        await conn.query('UPDATE events SET is_active = ? WHERE event_id = ?', [!!is_active, eventId]);
        await logActivity(req.userId, 'EVENT_STATUS', 'events', eventId, null, { is_active: !!is_active });
        conn.release();
        res.json({ message: 'Event status updated successfully!' });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({ error: 'Failed to update event status' });
    }
});

// Get Activity Logs
app.get('/api/admin/activity-logs', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [logs] = await conn.query(
            `SELECT al.log_id as id, au.name as first_name, au.name as last_name, al.action, 
                    al.table_name, al.record_id, al.created_at
             FROM activity_logs al
             LEFT JOIN admin_users au ON al.admin_id = au.admin_id
             ORDER BY al.created_at DESC LIMIT 100`
        );
        conn.release();
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/admin/volunteers', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [volunteers] = await conn.query(
            `SELECT v.volunteer_id, v.volunteer_name, v.address, v.whatsapp_number, v.birthdate,
                    v.is_active, v.update_date, v.photo_url, v.group_id,
                    vg.group_name
             FROM volunteers v
             LEFT JOIN volunteer_groups vg ON vg.group_id = v.group_id
             ORDER BY volunteer_id DESC`
        );
        conn.release();
        res.json({ volunteers });
    } catch (error) {
        console.error('Error fetching volunteers:', error);
        res.status(500).json({ error: 'Failed to fetch volunteers' });
    }
});

app.post('/api/admin/volunteers', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.single('photo'), async (req, res) => {
    try {
        const { volunteer_name, address, whatsapp_number, birthdate, group_id } = req.body;
        if (!volunteer_name) {
            return res.status(400).json({ error: 'Volunteer name is required' });
        }

        const conn = await pool.getConnection();
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
        const [result] = await conn.query(
            `INSERT INTO volunteers
             (volunteer_name, address, photo_url, whatsapp_number, birthdate, group_id, is_active, update_user)
             VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
            [volunteer_name, address || '', photoPath, whatsapp_number || '', birthdate || null, group_id || null, req.userId || null]
        );
        await logActivity(req.userId, 'CREATE_VOLUNTEER', 'volunteers', result.insertId, null, { volunteer_name });
        conn.release();
        res.status(201).json({ message: 'Volunteer created successfully!' });
    } catch (error) {
        console.error('Error creating volunteer:', error);
        res.status(500).json({ error: 'Failed to create volunteer' });
    }
});

app.put('/api/admin/volunteers/:volunteerId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.single('photo'), async (req, res) => {
    try {
        const { volunteerId } = req.params;
        const { volunteer_name, address, whatsapp_number, birthdate, is_active, group_id } = req.body;
        const conn = await pool.getConnection();
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
        await conn.query(
            `UPDATE volunteers
             SET volunteer_name = ?, address = ?, photo_url = COALESCE(?, photo_url), whatsapp_number = ?, birthdate = ?,
                 group_id = ?, is_active = ?, update_user = ?, update_date = CURRENT_TIMESTAMP
             WHERE volunteer_id = ?`,
            [volunteer_name || '', address || '', photoPath, whatsapp_number || '', birthdate || null, group_id || null, !!is_active, req.userId || null, volunteerId]
        );
        await logActivity(req.userId, 'UPDATE_VOLUNTEER', 'volunteers', volunteerId, null, { volunteer_name, is_active: !!is_active });
        conn.release();
        res.json({ message: 'Volunteer updated successfully!' });
    } catch (error) {
        console.error('Error updating volunteer:', error);
        res.status(500).json({ error: 'Failed to update volunteer' });
    }
});

app.get('/api/admin/teams', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [teams] = await conn.query('SELECT team_id, team_name, is_active, created_at FROM teams ORDER BY team_id DESC');
        const [assignments] = await conn.query(
            `SELECT vta.assignment_id, vta.team_id, vta.volunteer_id, vta.role_id,
                    vta.is_team_lead, vta.is_team_manager, v.volunteer_name
             FROM volunteer_team_assignments vta
             LEFT JOIN volunteers v ON v.volunteer_id = vta.volunteer_id`
        );
        conn.release();
        res.json({ teams, assignments });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

app.post('/api/admin/teams', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { team_name } = req.body;
        if (!team_name) {
            return res.status(400).json({ error: 'Team name is required' });
        }
        const conn = await pool.getConnection();
        const [result] = await conn.query('INSERT INTO teams (team_name, is_active) VALUES (?, TRUE)', [team_name]);
        await logActivity(req.userId, 'CREATE_TEAM', 'teams', result.insertId, null, { team_name });
        conn.release();
        res.status(201).json({ message: 'Team created successfully!' });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

app.post('/api/admin/team-assignments', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { volunteer_id, team_id, role_id, is_team_lead, is_team_manager } = req.body;
        if (!volunteer_id || !team_id) {
            return res.status(400).json({ error: 'volunteer_id and team_id are required' });
        }
        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO volunteer_team_assignments
             (volunteer_id, team_id, role_id, is_team_lead, is_team_manager, assigned_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                role_id = VALUES(role_id),
                is_team_lead = VALUES(is_team_lead),
                is_team_manager = VALUES(is_team_manager),
                assigned_by = VALUES(assigned_by),
                assigned_at = CURRENT_TIMESTAMP`,
            [volunteer_id, team_id, role_id || null, !!is_team_lead, !!is_team_manager, req.userId || null]
        );
        await logActivity(req.userId, 'ASSIGN_TEAM', 'volunteer_team_assignments', null, null, { volunteer_id, team_id, role_id });
        conn.release();
        res.json({ message: 'Team assignment saved successfully!' });
    } catch (error) {
        console.error('Error assigning volunteer to team:', error);
        res.status(500).json({ error: 'Failed to assign volunteer to team' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Start Server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
        await ensureCoreAuthSetup();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Startup failed:', error);
        process.exit(1);
    }
};

startServer();
