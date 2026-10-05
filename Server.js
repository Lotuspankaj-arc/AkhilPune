import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import SftpClient from 'ssh2-sftp-client';
import { initMySqlDb, table } from './mysqlDb.js';
import apiRoutes from './routes/apiRoutes.js';
import db from './mysqlDb.js';

// Disabled: Railway injects env vars directly. For local development, use .env file.
// dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const weakSecretValues = new Set(['dev_secret', 'dev_refresh', 'password123', 'secret', 'changeme']);
const looksLikePlaceholder = (value) => /^(dev_|replace_with|your_|change[_-]?me|example|test[_-]?)/i.test(String(value || '').trim());

const getJwtSecret = () => process.env.JWT_SECRET || (isProduction ? '' : 'dev_secret');
const getRefreshSecret = () => process.env.REFRESH_SECRET || (isProduction ? '' : 'dev_refresh');

const validateProductionSecurityConfig = () => {
    if (!isProduction) return;

    const requiredSecrets = ['JWT_SECRET', 'REFRESH_SECRET', 'SFTP_ENCRYPTION_KEY'];
    const missingSecrets = requiredSecrets.filter((name) => {
        const value = String(process.env[name] || '').trim();
        return value.length < 32 || weakSecretValues.has(value.toLowerCase()) || looksLikePlaceholder(value);
    });
    const corsOrigins = String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const superUserPassword = String(process.env.SUPER_USER_PASSWORD || '');
    const superUserEmail = String(process.env.SUPER_USER_EMAIL || '').trim().toLowerCase();
    const invalidConfig = [];

    if (missingSecrets.length > 0) invalidConfig.push(`strong values for ${missingSecrets.join(', ')}`);
    const hasLocalDevelopmentOrigin = corsOrigins.some((origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin));
    if (corsOrigins.length === 0 || corsOrigins.includes('*') || hasLocalDevelopmentOrigin) invalidConfig.push('CORS_ORIGINS with deployed HTTPS origins');
    if (!superUserEmail || superUserEmail === 'admin@pcmc.com' || /@example\.(com|org)$/i.test(superUserEmail)) invalidConfig.push('a non-default SUPER_USER_EMAIL');
    if (superUserPassword.length < 12 || weakSecretValues.has(superUserPassword.toLowerCase()) || looksLikePlaceholder(superUserPassword)) {
        invalidConfig.push('a non-default SUPER_USER_PASSWORD of at least 12 characters');
    }
    const dbPassword = String(process.env.DB_PASSWORD || '').trim();
    if (!dbPassword || looksLikePlaceholder(dbPassword)) invalidConfig.push('a non-placeholder DB_PASSWORD');

    if (invalidConfig.length > 0) {
        throw new Error(`Production security configuration is incomplete: ${invalidConfig.join('; ')}.`);
    }
};

validateProductionSecurityConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const configuredCorsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const defaultDevelopmentCorsOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];
const allowedCorsOrigins = new Set(configuredCorsOrigins.length ? configuredCorsOrigins : defaultDevelopmentCorsOrigins);
const allowAllCorsOrigins = !isProduction && allowedCorsOrigins.has('*');
const corsOrigin = (origin, callback) => {
    if (!origin || allowAllCorsOrigins || allowedCorsOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
};

const createRateLimiter = ({ windowMs, max }) => rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
});

const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const refreshRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });
const registrationRateLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });
const paymentRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
        if (req.originalUrl === '/api/payment/webhook') {
            req.rawBody = Buffer.from(buffer);
        }
    }
}));
app.use(express.urlencoded({ limit: '1mb', extended: false }));
app.use(cookieParser());
app.use('/api', apiRoutes);

const publicSlug = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const publicEventDateSlug = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const defaultHomepageContent = {
    eyebrow: 'अधिकृत समाज संकेतस्थळ',
    hero_badge: 'समाज माहिती, कार्यक्रम व ऑनलाईन नोंदणी',
    notice_text: '॥ श्री हिंगुलांबिका देवी प्रसन्न ॥',
    registration_note: 'अधिकृत सार्वजनिक माहिती व नोंदणी पोर्टल',
    hero_heading: 'समाज बांधवांसाठी अधिकृत कार्यक्रम माहिती',
    hero_quote: 'संस्कारांची सुंदर गाठ, नव्या आयुष्याची नवी पहाट... एकत्र येऊन सुखद नात्यांची ही वाट यशस्वी करूया.',
    invitation_title: 'स्नेह निमंत्रण',
    invitation_salutation: 'श्री / श्रीमती,',
    invitation_quote: 'समाज बांधवांच्या सहकार्याने प्रत्येक उपक्रम अधिक सुंदर आणि अर्थपूर्ण होतो.',
    invitation_text: 'आपणास निमंत्रित करताना आनंद होत आहे. कार्यक्रमाची अधिकृत माहिती, नोंदणी प्रक्रिया आणि आवश्यक मार्गदर्शन या संकेतस्थळावर उपलब्ध आहे.',
    invitation_welcome: 'सर्व समाज बांधवांचे स्नेहपूर्वक स्वागत!',
    about_title: 'समाजाविषयी',
    about_text: 'हे संकेतस्थळ समाजाच्या अधिकृत कार्यक्रमांची माहिती, नोंदणी तपशील, पेमेंट मार्गदर्शन आणि सहाय्यक संपर्क एकाच ठिकाणी उपलब्ध करून देते.',
    service_title: 'नोंदणी व समाज सेवा',
    service_text: 'सक्रिय कार्यक्रमाची माहिती व शुल्क तपासून अधिकृत नोंदणी फॉर्म भरा. पेमेंट निवडलेल्या कार्यक्रमाच्या नोंदणी प्रक्रियेशी जोडलेले आहे.',
    feature_title: 'कार्यक्रमाची वैशिष्ट्ये',
    feature_heading: 'समाज बांधवांच्या सोयीसाठी नियोजनबद्ध व्यवस्था',
    feature_items: [
        { title: 'अधिकृत कार्यक्रम माहिती', text: 'दिनांक, स्थळ, शुल्क आणि नोंदणीची अद्ययावत माहिती एका ठिकाणी.' },
        { title: 'सोपे ऑनलाईन नोंदणी', text: 'नोंदणी फॉर्म आणि पेमेंट प्रक्रियेसाठी स्पष्ट मार्गदर्शन.' },
        { title: 'सहाय्यक संपर्क व्यवस्था', text: 'तांत्रिक किंवा नोंदणीसंबंधी प्रश्नांसाठी समिती सदस्यांशी संपर्क.' },
        { title: 'समाज संवाद', text: 'समाज बांधव, पालक आणि आयोजक यांच्यातील संवादासाठी माहिती कक्ष.' },
        { title: 'पेमेंट पारदर्शकता', text: 'निवडलेल्या कार्यक्रमाचे शुल्क आणि पेमेंट स्थिती स्पष्टपणे दर्शविली जाते.' },
        { title: 'आयोजन समन्वय', text: 'कार्यक्रमाच्या विविध समित्या आणि सहाय्यक गटांचे नियोजन.' }
    ],
    rules_title: 'नियमावली व अटी',
    rules_heading: 'नोंदणी नियमावली व शुल्क तपशील',
    rules_text: 'कृपया कार्यक्रमाची पात्रता, नोंदणी सूचना आणि शुल्क तपशील काळजीपूर्वक वाचून फॉर्म भरावा. नोंदणीमध्ये दिलेली माहिती अचूक असावी.',
    payment_note: 'पेमेंट पूर्ण झाल्यावरच नोंदणी ग्राह्य धरली जाईल.',
    refund_policy: 'परतावा किंवा रद्दीकरणाची पात्रता संबंधित कार्यक्रमाच्या अटींनुसार हाताळली जाईल. लागू अटी नोंदणीपूर्वी तपासाव्यात.',
    shipping_policy: 'ही डिजिटल नोंदणी सेवा आहे. कोणतेही भौतिक उत्पादन पाठविले जात नाही. पावती किंवा प्रवेश माहिती इलेक्ट्रॉनिक पद्धतीने अथवा कार्यक्रमस्थळी दिली जाऊ शकते.',
    terms_text: 'हे संकेतस्थळ वापरताना अचूक माहिती देणे, कार्यक्रमाचे नियम पाळणे आणि सेवा केवळ समाजाच्या अधिकृत उद्देशासाठी वापरणे मान्य केले जाते.',
    privacy_text: 'या संकेतस्थळावर सादर केलेली माहिती नोंदणी, पडताळणी, संपर्क आणि कार्यक्रम समन्वयासाठी वापरली जाते. ती सार्वजनिक निर्देशिका म्हणून विकली जात नाही.',
    rates_title: 'स्मरणिका जाहिरात दर पत्रक',
    rates_heading: 'कार्यक्रम यशस्वी करण्यासाठी आपल्या सहकार्याची आवश्यकता आहे.',
    rates_text: 'स्मरणिका जाहिरात दर आणि उपलब्ध जागांची माहिती आयोजकांकडून लवकरच प्रसिद्ध केली जाईल.',
    contact_title: 'आयोजकांशी संपर्क साधा',
    contact_note: 'नोंदणी, पेमेंट किंवा कार्यक्रमासंबंधी मदतीसाठी खालील अधिकृत संपर्क तपशील वापरा.',
    helpline_title: 'नोंदणी सहाय्यता हेल्पलाईन',
    support_title: 'तांत्रिक सहाय्यता',
    support_text: 'फॉर्म भरणे, पेमेंट किंवा संकेतस्थळ वापरण्यासंबंधी अडचणींसाठी तांत्रिक सहाय्यता समितीशी संपर्क साधा.'
};

const parseHomepageContent = (value) => {
    if (!value) return {};
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
        return {};
    }
};

const normalizePublicHostname = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');

const buildPublicClientHomepage = async (client) => {
    if (!client || client.is_active === false || client.homepage_enabled === false) return null;

    const [committeeRows, teamRows] = await Promise.all([
        db.query(
            `SELECT adhyaksha_volunteer_id, adhyaksha_name, adhyaksha_phone,
                    upa_adhyaksha_volunteer_id, upa_adhyaksha_name, upa_adhyaksha_phone,
                    khajindar_volunteer_id, khajindar_name, khajindar_phone,
                    sachiv_volunteer_id, sachiv_name, sachiv_phone,
                    upasachiv_volunteer_id, upasachiv_name, upasachiv_phone
             FROM client_core_committee WHERE client_id = ? LIMIT 1`,
            [client.client_id]
        ),
        db.query(
            `SELECT t.team_id, t.team_name, a.assignment_id, a.is_team_lead, a.is_team_manager,
                    v.volunteer_id, v.volunteer_name, v.whatsapp_number, v.email, v.main_profession,
                    r.role_name
             FROM teams t
             LEFT JOIN volunteer_team_assignments a
               ON a.team_id = t.team_id AND a.client_id = t.client_id
             LEFT JOIN volunteers v
               ON v.volunteer_id = a.volunteer_id
              AND v.client_id = t.client_id
              AND v.is_active = TRUE
             LEFT JOIN roles r ON r.role_id = a.role_id AND r.is_active = TRUE
             WHERE t.client_id = ? AND t.is_active = TRUE
             ORDER BY t.team_id ASC, v.volunteer_name ASC`,
            [client.client_id]
        )
    ]);

    const committee = committeeRows[0] || null;
    if (committee) {
        const volunteerRows = table('volunteers').all();
        [
            ['adhyaksha', 'adhyaksha_name'],
            ['upa_adhyaksha', 'upa_adhyaksha_name'],
            ['khajindar', 'khajindar_name'],
            ['sachiv', 'sachiv_name'],
            ['upasachiv', 'upasachiv_name']
        ].forEach(([role, nameKey]) => {
            const linkedVolunteerId = committee[`${role}_volunteer_id`];
            const volunteer = volunteerRows.find((candidate) => {
                if (candidate.is_active === false || String(candidate.client_id) !== String(client.client_id)) return false;
                if (linkedVolunteerId) return String(candidate.volunteer_id) === String(linkedVolunteerId);
                return String(candidate.volunteer_name || '').trim().toLowerCase() === String(committee[nameKey] || '').trim().toLowerCase();
            });
            committee[`${role}_volunteer_id`] = volunteer?.volunteer_id || null;
            committee[`${role}_photo_url`] = volunteer?.photo_data?.length
                ? volunteerPhotoAccessPath(volunteer.volunteer_id)
                : null;
        });
    }

    const teamsById = new Map();
    teamRows.forEach((row) => {
        if (!teamsById.has(row.team_id)) {
            teamsById.set(row.team_id, { team_id: row.team_id, team_name: row.team_name, members: [] });
        }
        if (row.volunteer_id) {
            teamsById.get(row.team_id).members.push({
                volunteer_id: row.volunteer_id,
                volunteer_name: row.volunteer_name,
                whatsapp_number: row.whatsapp_number,
                email: row.email,
                main_profession: row.main_profession,
                role_name: row.role_name,
                is_team_lead: row.is_team_lead,
                is_team_manager: row.is_team_manager
            });
        }
    });

    const events = table('events').all()
        .filter((event) => String(event.client_id) === String(client.client_id) && event.is_active !== false)
        .sort((first, second) => new Date(first.start_date || 0) - new Date(second.start_date || 0))
        .map((event) => ({
            event_id: event.event_id,
            client_id: event.client_id,
            event_name: event.event_name,
            venue: event.venue,
            event_type: event.event_type,
            start_date: event.start_date,
            end_date: event.end_date,
            registration_cutoff_date: event.registration_cutoff_date,
            organizer_name: event.organizer_name,
            organizer_phone: event.organizer_phone,
            organizer_whatsapp: event.organizer_whatsapp,
            organizer_photo: event.organizer_photo,
            banner_url: event.banner_url,
            registration_banner_path: event.registration_banner_path,
            event_time: event.event_time || null,
            office_address: event.office_address || client.address,
            razorpay_registration_amount: event.razorpay_registration_amount,
            registration_path: `/register/${publicSlug(client.public_slug || client.client_name)}/${publicSlug(`${event.event_name}-${publicEventDateSlug(event.start_date)}`)}`
        }));

    return {
        success: true,
        client: {
            ...client,
            homepage_title: client.homepage_title || client.client_name,
            homepage_intro: client.homepage_intro || 'Welcome to your community event and registration homepage.',
            homepage_content: { ...defaultHomepageContent, ...parseHomepageContent(client.homepage_content) },
            logo_url: client.has_logo ? `/api/clients/${client.client_id}/logo` : null
        },
        committee,
        teams: Array.from(teamsById.values()),
        events
    };
};

app.get('/api/public/clients/:clientSlug', async (req, res) => {
    try {
        const clients = await db.query(
                `SELECT client_id, client_name, address, phone_number, contact_email, public_slug,
                    homepage_enabled, homepage_title, homepage_intro, homepage_content,
                    registration_form_config, is_active, (logo_data IS NOT NULL) AS has_logo
             FROM clients WHERE is_active = TRUE`
        );
        const client = clients.find((item) => publicSlug(item.public_slug || item.client_name) === publicSlug(req.params.clientSlug));
        if (!client) return res.status(404).json({ success: false, message: 'Client homepage not found.' });
        const homepage = await buildPublicClientHomepage(client);
        if (!homepage) return res.status(404).json({ success: false, message: 'This client homepage is not published.' });
        res.json(homepage);
    } catch (error) {
        console.error('Error loading public client homepage:', error);
        res.status(500).json({ success: false, message: 'Unable to load client homepage.' });
    }
});

app.get('/api/public/current-client', async (req, res) => {
    try {
        const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
        const hostname = normalizePublicHostname(req.query.domain || forwardedHost || req.headers.host);
        const domains = await db.query('SELECT client_id, hostname FROM client_domains WHERE is_active = TRUE');
        const domain = domains.find((item) => normalizePublicHostname(item.hostname) === hostname);
        const clients = domain
            ? await db.query(
                `SELECT client_id, client_name, address, phone_number, contact_email, public_slug,
                    homepage_enabled, homepage_title, homepage_intro, homepage_content,
                    registration_form_config, is_active, (logo_data IS NOT NULL) AS has_logo
                 FROM clients WHERE client_id = ? AND is_active = TRUE`,
                [domain.client_id]
            )
            : [];
        const client = clients[0] || null;
        const homepage = await buildPublicClientHomepage(client);
        if (!homepage) return res.status(404).json({ success: false, message: 'No published client homepage is mapped to this domain.' });
        return res.json(homepage);
    } catch (error) {
        console.error('Error loading domain homepage:', error);
        return res.status(500).json({ success: false, message: 'Unable to load the domain homepage.' });
    }
});

// Multer keeps validated uploads in memory until they are saved in MySQL.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 }
});

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp']);

const hasImageSignature = (buffer, mimeType) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mimeType === 'image/png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
            buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
    }

    if (mimeType === 'image/webp') {
        return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    return false;
};

const validateProfilePhotoUpload = (file, { required = false } = {}) => {
    if (!file) {
        if (required) {
            throw createRegistrationError('Please upload a passport size photo.', 400, 'photo_validation_failed');
        }
        return { passed: true, skipped: true };
    }

    const mimeType = String(file?.mimetype || '').toLowerCase();
    if (!file?.buffer || !mimeType.startsWith('image/')) {
        throw createRegistrationError('Please upload a valid image file.', 400, 'photo_validation_failed');
    }

    if (!PROFILE_PHOTO_MIME_TYPES.has(mimeType)) {
        throw createRegistrationError('Please upload a JPG, PNG, or WebP profile photo.', 400, 'photo_validation_failed');
    }

    const actualSize = Number(file.size || file.buffer.length || 0);
    if (!actualSize || actualSize > PROFILE_PHOTO_MAX_BYTES) {
        throw createRegistrationError('Photo is too large. Please upload an image below 5 MB.', 400, 'photo_validation_failed');
    }

    if (!hasImageSignature(file.buffer, mimeType)) {
        throw createRegistrationError('Photo file does not match the selected image type. Please upload a valid JPG, PNG, or WebP image.', 400, 'photo_validation_failed');
    }

    return { passed: true };
};

const getPhotoStorage = (file) => file
    ? { photo_data: file.buffer, photo_mime_type: String(file.mimetype || '').toLowerCase() }
    : { photo_data: null, photo_mime_type: null };

const candidatePhotoPath = (candidateId) => candidateId ? `/api/candidates/${candidateId}/photo` : null;
const candidatePhotoAccessPath = (candidateId) => {
    if (!candidateId) return null;
    const accessToken = jwt.sign(
        { scope: 'candidate-photo', candidateId: String(candidateId) },
        getJwtSecret(),
        { expiresIn: '10m' }
    );
    return `${candidatePhotoPath(candidateId)}?accessToken=${encodeURIComponent(accessToken)}`;
};
const eventMediaPath = (eventId, kind) => eventId ? `/api/events/${eventId}/media/${kind}` : null;
const volunteerPhotoPath = (volunteerId) => volunteerId ? `/api/volunteers/${volunteerId}/photo` : null;
const volunteerPhotoAccessPath = (volunteerId) => {
    if (!volunteerId) return null;
    const accessToken = jwt.sign(
        { scope: 'volunteer-photo', volunteerId: String(volunteerId) },
        getJwtSecret(),
        { expiresIn: '10m' }
    );
    return `${volunteerPhotoPath(volunteerId)}?accessToken=${encodeURIComponent(accessToken)}`;
};

const ROLE_SUPER_USER = 'super_user';
const ROLE_ADMIN = 'admin';
const ROLE_CANDIDATE = 'candidate';

const getSftpEncryptionKey = () => crypto.createHash('sha256')
    .update(process.env.SFTP_ENCRYPTION_KEY || getJwtSecret())
    .digest();

const encryptSftpSecret = (value) => {
    if (!value) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', getSftpEncryptionKey(), iv);
    return `${iv.toString('hex')}:${Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]).toString('base64')}`;
};

const decryptProtectedSecret = (value) => {
    if (!value) return null;
    const [ivHex, encryptedValue] = String(value).split(':');
    if (!ivHex || ivHex.length !== 32 || !encryptedValue) return String(value);

    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', getSftpEncryptionKey(), Buffer.from(ivHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64')), decipher.final()]).toString('utf8');
    } catch {
        return String(value);
    }
};

const normalizeRoleName = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'user') return ROLE_CANDIDATE;
    return raw;
};

const getRegisteredEventSummaries = (candidate, allowedEventIds = null) => {
    if (!candidate?.batch_id) return [];
    const allowedIds = Array.isArray(allowedEventIds)
        ? new Set(allowedEventIds.map((eventId) => String(eventId)))
        : null;

    return table('candidate_event_registrations').all()
        .filter((registration) => String(registration.batch_id) === String(candidate.batch_id))
        .filter((registration) => isActiveFlag(registration.is_active))
        .filter((registration) => !allowedIds || allowedIds.has(String(registration.event_id)))
        .map((registration) => {
            const event = table('events').findById(registration.event_id);
            if (!event) return null;
            return {
                event_id: event.event_id,
                event_name: event.event_name,
                client_id: event.client_id,
                event_registration_code: registration.event_registration_code || null,
                registration_date: registration.registration_date || registration.created_at || null,
                start_date: event.start_date || null,
                end_date: event.end_date || null
            };
        })
        .filter(Boolean)
        .sort((first, second) => new Date(second.registration_date || second.start_date || 0) - new Date(first.registration_date || first.start_date || 0));
};

const sanitizeCandidateProfile = (candidate, allowedEventIds = null) => {
    if (!candidate || typeof candidate !== 'object') return null;
    const {
        password: _password,
        password_hash: _passwordHash,
        photo_data: _photoData,
        photo_mime_type: _photoMimeType,
        razorpay_order_id: _razorpayOrderId,
        razorpay_payment_id: _razorpayPaymentId,
        razorpay_signature: _razorpaySignature,
        payment_details: _paymentDetails,
        payment_status: _paymentStatus,
        payment_date: _paymentDate,
        payment_amount: _paymentAmount,
        ...safeProfile
    } = candidate;
    safeProfile.registered_events = getRegisteredEventSummaries(candidate, allowedEventIds);
    if (candidate.batch_id && (candidate.photo_data || safeProfile.photo_path)) {
        safeProfile.photo_path = candidatePhotoAccessPath(candidate.batch_id);
    }
    return safeProfile;
};

const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
});

const getRegistrationIntentCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/api',
    maxAge: 30 * 60 * 1000
});

const createRegistrationIntentCookie = (intentId) => {
    const id = String(intentId);
    const signature = crypto.createHmac('sha256', getJwtSecret()).update(id).digest('hex');
    return `${id}.${signature}`;
};

const hasValidRegistrationIntentCookie = (value, intentId) => {
    const [id, signature] = String(value || '').split('.');
    if (!id || !signature || id !== String(intentId)) return false;

    const expected = crypto.createHmac('sha256', getJwtSecret()).update(id).digest('hex');
    const providedBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const getRoleIdByName = (roleName) => {
    const normalized = normalizeRoleName(roleName);
    const roles = table('roles')
        .find((role) => normalizeRoleName(role.role_name) === normalized)
        .sort((a, b) => Number(a.role_id) - Number(b.role_id));
    return roles.length ? roles[0].role_id : null;
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
        educationCategory: String(pickValue(body.educationCategory, body.education_category) || '').trim(),
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

// Event registration code generation mirrors the event team's Excel formula:
// <event id><gender letter><education-category letter><running sequence>.
// e.g. "13MM1" = event 13 + Groom + Masters degree + first matching entry.
// Re-marriage candidates always get the 'R' category letter regardless of
// their education category (matches the Excel formula's fallback branch).
const EDUCATION_CATEGORY_CODES = {
    'All Masters Degrees': 'M',
    'All Batchelor Degrees': 'B',
    'PHD': 'P',
    'CA,CS,ICWA': 'C',
    'Doctors or Medical Field': 'D',
    'Engineers/Architect(ANY)': 'E',
    'Graduates(BCOM,BA,BSC,BBA,BCS,ANY)': 'G',
    'Law Field(ANY)': 'L',
    '10th,12th Under Graduates(ANY),ITI,Diploma(ANY)': 'U'
};

const EDUCATION_CATEGORY_OPTIONS = Object.keys(EDUCATION_CATEGORY_CODES);

const resolveEducationCategory = ({ educationCategory, educationQualification, education } = {}) => {
    const explicitCategory = String(educationCategory || '').trim();
    if (EDUCATION_CATEGORY_OPTIONS.includes(explicitCategory)) return explicitCategory;

    const rawEducation = String(educationQualification || education || '').trim().toLowerCase();
    if (!rawEducation) return '';
    if (/ph\.?d|doctorate/.test(rawEducation)) return 'PHD';
    if (/\bca\b|\bc\.?s\.?\b|\bicwa\b|cost accountant/.test(rawEducation)) return 'CA,CS,ICWA';
    if (/doctor|medical|mbbs|bds|bams|bhms|nursing|pharmacy/.test(rawEducation)) return 'Doctors or Medical Field';
    if (/engineer|architect|b\.?tech|b\.?e\.?|m\.?tech|m\.?e\.?/.test(rawEducation)) return 'Engineers/Architect(ANY)';
    if (/law|llb|ll\.m/.test(rawEducation)) return 'Law Field(ANY)';
    if (/10th|12th|iti|diploma/.test(rawEducation)) return '10th,12th Under Graduates(ANY),ITI,Diploma(ANY)';
    if (/master|m\.a|m\.com|m\.sc|mba|mca|m\.s\.?/.test(rawEducation)) return 'All Masters Degrees';
    if (/bachelor|graduate|b\.a|b\.com|b\.sc|bba|bca|bcs/.test(rawEducation)) return 'Graduates(BCOM,BA,BSC,BBA,BCS,ANY)';
    return '';
};

const getRegistrationCodePrefix = ({ gender, marriageType, educationCategory, educationQualification, education }) => {
    const normalizedGender = String(gender || '').trim().toLowerCase();
    const normalizedMarriageType = String(marriageType || '').trim().toLowerCase();
    const isGroom = normalizedGender === 'groom'
        || normalizedGender.includes('groom')
        || (normalizedGender.includes('male') && !normalizedGender.includes('female'));
    const genderLetter = isGroom ? 'M' : 'F';
    const isFirstMarriage = normalizedMarriageType === 'first marriage' || normalizedMarriageType.includes('first marriage');
    const resolvedEducationCategory = resolveEducationCategory({ educationCategory, educationQualification, education });
    const categoryLetter = isFirstMarriage ? (EDUCATION_CATEGORY_CODES[resolvedEducationCategory] || 'R') : 'R';
    return `${genderLetter}${categoryLetter}`;
};

const getNextEventRegistrationSequence = (eventId, prefix) => {
    let maxSeq = 0;
    for (const row of table('candidate_event_registrations').all()) {
        if (String(row.event_id) !== String(eventId)) continue;
        const code = String(row.event_registration_code || '');
        if (code.startsWith(prefix) && /^\d+$/.test(code.slice(prefix.length))) {
            const sequence = Number(code.slice(prefix.length));
            if (sequence > maxSeq) maxSeq = sequence;
        }
    }
    return maxSeq + 1;
};

const generateRegistrationCode = ({ eventId, gender, marriageType, educationCategory, educationQualification, education }) => {
    const categoryPrefix = getRegistrationCodePrefix({ gender, marriageType, educationCategory, educationQualification, education });
    if (!eventId) return null;
    const prefix = `${String(eventId)}${categoryPrefix}`;
    const sequence = getNextEventRegistrationSequence(eventId, prefix);
    return `${prefix}${sequence}`;
};

let registrationMutationTail = Promise.resolve();

const withRegistrationMutationLock = async (operation) => {
    const previousOperation = registrationMutationTail;
    let releaseCurrentOperation;
    registrationMutationTail = new Promise((resolve) => {
        releaseCurrentOperation = resolve;
    });

    await previousOperation;
    try {
        return await operation();
    } finally {
        releaseCurrentOperation();
    }
};

const normalizeIdentityText = (value) => String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeIdentityPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const getRegistrationIdentityKey = ({ firstName, middleName, lastName, mobile }) => {
    const name = [firstName, middleName, lastName]
        .map(normalizeIdentityText)
        .filter(Boolean)
        .join(' ');
    const phone = normalizeIdentityPhone(mobile);
    return name && phone ? `${name}|${phone}` : '';
};

const getCandidateIdentityKey = (candidate) => getRegistrationIdentityKey({
    firstName: candidate?.first_name,
    middleName: candidate?.middle_name,
    lastName: candidate?.last_name,
    mobile: candidate?.mobile_number
});

const getIntentPayload = (intent) => normalizeCandidatePayload({
    ...(intent?.payload_json || {}),
    email: intent?.email || intent?.payload_json?.email,
    firstName: intent?.first_name || intent?.payload_json?.firstName,
    middleName: intent?.middle_name || intent?.payload_json?.middleName,
    lastName: intent?.last_name || intent?.payload_json?.lastName,
    mobile: intent?.mobile_number || intent?.payload_json?.mobile
});

const createRegistrationError = (message, status = 400, code = null) => {
    const error = new Error(message);
    error.status = status;
    error.publicMessage = message;
    if (code) error.code = code;
    return error;
};

const findCandidateConflict = (payload) => {
    const candidates = table('candidates').all();
    const fullName = [payload.firstName, payload.middleName, payload.lastName]
        .map(normalizeIdentityText)
        .filter(Boolean)
        .join(' ');
    const email = normalizeIdentityText(payload.email);
    const birthDate = normalizeDobForDb(payload.birthDate);
    const matchingCandidate = fullName && email
        ? candidates.find((candidate) => {
            const candidateName = [candidate.first_name, candidate.middle_name, candidate.last_name]
                .map(normalizeIdentityText)
                .filter(Boolean)
                .join(' ');
            return candidateName === fullName
                && normalizeIdentityText(candidate.email) === email
                && Boolean(birthDate)
                && normalizeDobForDb(candidate.birth_date || candidate.dob) === birthDate;
        })
        : null;

    return matchingCandidate ? { type: 'name_email', candidate: matchingCandidate } : null;
};

const findPaymentCandidate = ({ orderId, paymentId }) => table('candidates').findOne(
    (candidate) =>
        (paymentId && String(candidate.razorpay_payment_id || '') === String(paymentId)) ||
        (orderId && String(candidate.razorpay_order_id || '') === String(orderId))
);

const findRegistrationIntentByOrder = (orderId) => table('registration_intents').findOne(
    (intent) => String(intent.razorpay_order_id || '') === String(orderId || '')
);

const getPendingIntentConflict = (payload) => {
    const identityKey = getRegistrationIdentityKey(payload);
    const email = normalizeIdentityText(payload.email);
    const pendingStatuses = new Set(['payment_pending', 'payment_order_created', 'payment_received', 'finalization_pending', 'candidate_saved_account_pending']);

    return table('registration_intents').findOne((intent) => {
        if (!pendingStatuses.has(String(intent.payment_status || ''))) return false;
        const intentPayload = getIntentPayload(intent);
        const matchesIdentity = identityKey && getRegistrationIdentityKey(intentPayload) === identityKey;
        const matchesEmail = email && normalizeIdentityText(intent.email || intentPayload.email) === email;
        return matchesIdentity || matchesEmail;
    });
};

const validateRegistrationIdentity = (payload) => {
    if (!payload.email || !payload.password || !payload.firstName || !payload.middleName || !payload.lastName || !payload.birthDate || !normalizeIdentityPhone(payload.mobile)) {
        throw createRegistrationError('Please complete email, password, full name, date of birth, and mobile number before payment.', 400);
    }
};

const reserveRegistrationIntent = async ({ event, payload }) => {
    validateRegistrationIdentity(payload);
    const activePlan = getActiveClientPlan(event.client_id);
    if (!activePlan) {
        throw createRegistrationError('This client subscription plan is inactive or expired.', 403);
    }
    const maxCandidates = Number(activePlan.plan?.max_candidates || 0);
    if (maxCandidates > 0) {
        const candidateConflict = findCandidateConflict(payload);
        const registeredCandidateIds = new Set(table('candidate_event_registrations').all()
            .filter((registration) => String(registration.client_id) === String(event.client_id) && isActiveFlag(registration.is_active))
            .map((registration) => String(registration.batch_id)));
        if (!candidateConflict?.candidate && registeredCandidateIds.size >= maxCandidates) {
            throw createRegistrationError(`This client plan allows a maximum of ${maxCandidates} candidates.`, 403);
        }
    }
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const { password: _password, ...storedPayload } = payload;

    return withRegistrationMutationLock(async () => {
        const candidateConflict = findCandidateConflict(payload);
        if (candidateConflict?.type === 'name_email') {
            const existingCandidate = candidateConflict.candidate;
            const existingPhotoPath = existingCandidate.photo_path || candidatePhotoPath(existingCandidate.batch_id);
            const now = new Date();
            const intent = await table('registration_intents').insert({
                event_id: event.event_id,
                email: payload.email,
                first_name: payload.firstName,
                middle_name: payload.middleName,
                last_name: payload.lastName,
                mobile_number: payload.mobile,
                payload_json: { ...storedPayload, existing_candidate_id: existingCandidate.batch_id },
                password_hash: passwordHash,
                photo_path: existingPhotoPath,
                photo_data: existingCandidate.photo_data || null,
                photo_mime_type: existingCandidate.photo_mime_type || null,
                photo_validation_status: existingCandidate.photo_data ? 'valid' : 'pending',
                photo_validated_at: existingPhotoPath ? now : null,
                payment_status: 'payment_pending',
                created_at: now,
                updated_at: now
            });
            return { intent, resumed: false, existingCandidate: true };
        }

        const existingCredential = table('auth_credentials').findOne(
            (credential) => normalizeIdentityText(credential.email) === normalizeIdentityText(payload.email)
        );
        if (existingCredential) {
            throw createRegistrationError('Record already exists for this email address.', 409);
        }

        const pendingIntent = getPendingIntentConflict(payload);
        if (pendingIntent) {
            const pendingPayload = getIntentPayload(pendingIntent);
            const sameIdentity = getRegistrationIdentityKey(payload) === getRegistrationIdentityKey(pendingPayload);
            const sameEmail = normalizeIdentityText(payload.email) === normalizeIdentityText(pendingIntent.email || pendingPayload.email);
            const passwordMatches = pendingIntent.password_hash
                ? await bcrypt.compare(payload.password, pendingIntent.password_hash)
                : false;
            const pendingStatus = String(pendingIntent.payment_status || '');

            if (sameIdentity && sameEmail && passwordMatches && ['payment_pending', 'payment_order_created'].includes(pendingStatus)) {
                return { intent: pendingIntent, resumed: true };
            }

            if (['payment_received', 'finalization_pending', 'candidate_saved_account_pending'].includes(pendingStatus)) {
                throw createRegistrationError('Payment is already under confirmation. Please contact customer care.', 409);
            }

            throw createRegistrationError('A registration session already exists for this name and email. Please continue with payment.', 409);
        }

        const now = new Date();
        const intent = await table('registration_intents').insert({
            event_id: event.event_id,
            email: payload.email,
            first_name: payload.firstName,
            middle_name: payload.middleName,
            last_name: payload.lastName,
            mobile_number: payload.mobile,
            payload_json: storedPayload,
            password_hash: passwordHash,
            payment_status: 'payment_pending',
            created_at: now,
            updated_at: now
        });

        return { intent, resumed: false };
    });
};

const updateRegistrationIntent = async (intentId, patch) => withRegistrationMutationLock(async () => {
    const currentIntent = table('registration_intents').findById(intentId);
    if (!currentIntent) throw createRegistrationError('Registration session was not found. Do not pay again; contact the organizer.', 404);
    return table('registration_intents').updateById(intentId, { ...patch, updated_at: new Date() });
});

const buildCandidateRecordFromIntent = ({ intent, event, payload, orderId, paymentId, signature }) => {
    const paymentDate = new Date();
    const razorpayConfig = getRazorpayConfig();
    const registrationAmount = getEventRegistrationAmount(event, razorpayConfig);
    const paymentDetails = {
        orderId,
        paymentId,
        signature: signature || intent.razorpay_signature || null,
        amount: registrationAmount,
        currency: razorpayConfig.currency,
        capturedAt: paymentDate.toISOString()
    };

    return {
        event_id: null,
        email: payload.email,
        first_name: payload.firstName,
        middle_name: payload.middleName,
        last_name: payload.lastName,
        gender: payload.gender,
        marriage_type: payload.marriageType,
        address_line: payload.address,
        pincode: payload.pincode,
        city_village: payload.city,
        tehsil: payload.tehsil,
        district: payload.district,
        state: payload.state,
        location_state_id: payload.stateId || null,
        location_district_id: payload.districtId || null,
        location_subdistrict_id: payload.subdistrictId || null,
        location_master_id: payload.locationId || null,
        mobile_number: payload.mobile,
        whatsapp_number: payload.whatsapp,
        height: payload.height,
        education_qualification: payload.education,
        education_details: payload.educationDetails,
        education_category: payload.educationCategory,
        job_business_title: payload.job,
        annual_income: payload.income,
        job_business_location: payload.jobLocation,
        mamekul: payload.mamekul,
        birth_date: payload.birthDate,
        birth_time: payload.birthTime,
        birth_place: payload.birthPlace,
        complexion: payload.complexion,
        blood_group: payload.bloodGroup,
        gotra: payload.gotra,
        zodiac: payload.zodiac,
        gan: payload.gan,
        nadi: payload.nadi,
        charan: payload.charan,
        nakshatra: payload.nakshatra,
        selected_expectations: payload.expectations.length ? payload.expectations : null,
        other_expectations: payload.customExpectation || null,
        photo_path: candidatePhotoPath(intent.candidate_batch_id) || null,
        photo_data: intent.photo_data || null,
        photo_mime_type: intent.photo_mime_type || null,
        razorpay_order_id: orderId || null,
        razorpay_payment_id: paymentId || null,
        razorpay_signature: signature || intent.razorpay_signature || null,
        payment_status: registrationAmount === 0 ? 'free' : 'captured',
        payment_details: paymentDetails,
        payment_date: paymentDate,
        attended_active_event: payload.attendedActiveEvent || null,
        will_attend_event: payload.willAttendEvent || null,
        attendee_count: payload.attendeeCount || null,
        is_active: true,
        registration_date: paymentDate,
        updated_at: paymentDate
    };
};

const ensureCandidateEventMembership = async (candidate, event, registrationDate = new Date()) => {
    if (!candidate?.batch_id || !event?.event_id || !event?.client_id) return;
    const existingRegistration = table('candidate_event_registrations').findOne(
        (row) => String(row.batch_id) === String(candidate.batch_id) && String(row.event_id) === String(event.event_id)
    );
    const eventRegistrationCode = existingRegistration?.event_registration_code || generateRegistrationCode({
        eventId: event.event_id,
        gender: candidate.gender,
        marriageType: candidate.marriage_type,
        educationCategory: candidate.education_category,
        educationQualification: candidate.education_qualification || candidate.education
    });
    if (existingRegistration) {
        await table('candidate_event_registrations').updateById(existingRegistration.registration_id, {
            client_id: event.client_id,
            event_registration_code: eventRegistrationCode,
            is_active: true,
            updated_at: new Date()
        });
    } else {
        await table('candidate_event_registrations').insert({
            batch_id: candidate.batch_id,
            event_id: event.event_id,
            client_id: event.client_id,
            event_registration_code: eventRegistrationCode,
            registration_date: registrationDate,
            is_active: true,
            created_at: registrationDate,
            updated_at: registrationDate
        });
    }

    const expiryDate = new Date(registrationDate);
    expiryDate.setMonth(expiryDate.getMonth() + 6);
    const existingSubscription = table('subscriptions').findOne(
        (row) => String(row.batch_id) === String(candidate.batch_id) && String(row.event_id) === String(event.event_id)
    );
    const subscriptionPatch = {
        client_id: event.client_id,
        registration_date: registrationDate,
        access_expiry_date: expiryDate,
        is_active: true,
        access_granted_at: registrationDate,
        updated_at: new Date()
    };
    if (existingSubscription) {
        await table('subscriptions').updateById(existingSubscription.subscription_id, subscriptionPatch);
    } else {
        await table('subscriptions').insert({
            subscription_id: undefined,
            batch_id: candidate.batch_id,
            event_id: event.event_id,
            ...subscriptionPatch,
            created_at: registrationDate
        });
    }
};

const getCandidateEventRegistrationCode = (candidateId, eventId) => {
    const registration = table('candidate_event_registrations').findOne(
        (row) => String(row.batch_id) === String(candidateId) && String(row.event_id) === String(eventId)
    );
    return registration?.event_registration_code || null;
};

const backfillEventRegistrationCodes = async () => {
    const registrations = table('candidate_event_registrations').all()
        .filter((registration) => !registration.event_registration_code)
        .sort((first, second) => Number(first.event_id) - Number(second.event_id) || Number(first.registration_id) - Number(second.registration_id));

    for (const registration of registrations) {
        const candidate = table('candidates').findById(registration.batch_id);
        const event = table('events').findById(registration.event_id);
        if (!candidate || !event) continue;

        const eventRegistrationCode = generateRegistrationCode({
            eventId: event.event_id,
            gender: candidate.gender,
            marriageType: candidate.marriage_type,
            educationCategory: candidate.education_category,
            educationQualification: candidate.education_qualification || candidate.education
        });
        await table('candidate_event_registrations').updateById(registration.registration_id, {
            event_registration_code: eventRegistrationCode,
            updated_at: new Date()
        });
    }
};

const ensureCandidateCredentials = async ({ candidate, intent, plainPassword }) => {
    const existingCredential = table('auth_credentials').findOne(
        (credential) => String(credential.user_id) === String(candidate.batch_id) ||
            normalizeIdentityText(credential.email) === normalizeIdentityText(candidate.email)
    );
    if (existingCredential) return existingCredential;

    const candidateRoleId = getRoleIdByName(ROLE_CANDIDATE);
    if (!candidateRoleId) throw new Error('Candidate role is not configured.');

    const passwordHash = String(intent.password_hash || '') ||
        (plainPassword ? await bcrypt.hash(plainPassword, 10) : '');
    if (!passwordHash) throw new Error('The candidate password could not be recovered.');

    try {
        return await table('auth_credentials').insert({
            user_id: candidate.batch_id,
            email: candidate.email,
            password: passwordHash,
            role_id: candidateRoleId,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        });
    } catch (error) {
        await table('auth_credentials').refresh().catch(() => {});
        const recoveredCredential = table('auth_credentials').findOne(
            (credential) => String(credential.user_id) === String(candidate.batch_id) ||
                normalizeIdentityText(credential.email) === normalizeIdentityText(candidate.email)
        );
        if (recoveredCredential) return recoveredCredential;
        throw error;
    }
};

const markIntentPending = async (intent, status, message) => {
    try {
        return await table('registration_intents').updateById(intent.intent_id, {
            payment_status: status,
            failure_reason: message,
            updated_at: new Date()
        });
    } catch (updateError) {
        console.error('Registration intent status update failed:', updateError);
        return intent;
    }
};

const finalizeRegistrationIntent = async ({ intentId, orderId, paymentId, signature = '', plainPassword = '' }) => {
    try {
        return await withRegistrationMutationLock(async () => {
            let intent = table('registration_intents').findById(intentId);
            if (!intent) {
                return {
                    status: 'pending',
                    message: 'Payment is confirmed, but the registration session could not be found. Do not pay again; contact the organizer with your payment ID.'
                };
            }

            if (String(intent.razorpay_order_id || '') !== String(orderId || '')) {
                return {
                    status: 'pending',
                    message: 'Payment is confirmed, but it does not match the saved registration session. Do not pay again; contact the organizer with your payment ID.'
                };
            }

            const event = table('events').findById(intent.event_id);
            if (!event) {
                return {
                    status: 'pending',
                    message: 'Payment is confirmed, but the related event could not be found. Do not pay again; contact the organizer with your payment ID.'
                };
            }

            intent = await table('registration_intents').updateById(intent.intent_id, {
                razorpay_payment_id: paymentId || intent.razorpay_payment_id || null,
                razorpay_signature: signature || intent.razorpay_signature || null,
                payment_status: 'payment_received',
                failure_reason: null,
                updated_at: new Date()
            });

            let candidate = findPaymentCandidate({ orderId, paymentId });
            if (candidate) {
                await ensureCandidateEventMembership(candidate, event, intent.created_at || new Date());
                try {
                    await ensureCandidateCredentials({ candidate, intent, plainPassword });
                } catch (credentialError) {
                    await markIntentPending(intent, 'candidate_saved_account_pending', credentialError.message);
                    return {
                        status: 'pending',
                        candidate,
                        intent,
                        message: 'Payment and candidate record are saved. Account setup is pending and will be retried automatically. Do not pay again.'
                    };
                }

                const alreadyFinalized = String(intent.payment_status || '') === 'completed';
                intent = await table('registration_intents').updateById(intent.intent_id, {
                    payment_status: 'completed',
                    candidate_batch_id: candidate.batch_id,
                    failure_reason: null,
                    updated_at: new Date()
                });
                return { status: 'completed', candidate, intent, alreadyFinalized };
            }

            const payload = getIntentPayload(intent);
            const candidateConflict = findCandidateConflict(payload);
            if (candidateConflict) {
                if (candidateConflict.type !== 'name_email') {
                    const message = 'A matching registration already exists. Do not pay again; contact the organizer with your payment ID.';
                    intent = await table('registration_intents').updateById(intent.intent_id, {
                        payment_status: 'payment_conflict',
                        failure_reason: message,
                        updated_at: new Date()
                    });
                    return { status: 'conflict', intent, message };
                }

                candidate = candidateConflict.candidate;
                const updatedCandidate = buildCandidateRecordFromIntent({ intent, event, payload, orderId, paymentId, signature });
                delete updatedCandidate.event_id;
                updatedCandidate.photo_path = candidatePhotoPath(candidate.batch_id);
                await table('candidates').updateById(candidate.batch_id, updatedCandidate);
                candidate = table('candidates').findById(candidate.batch_id) || { ...candidate, ...updatedCandidate };
                await ensureCandidateEventMembership(candidate, event, intent.created_at || new Date());
                await ensureCandidateCredentials({ candidate, intent, plainPassword });
                intent = await table('registration_intents').updateById(intent.intent_id, {
                    payment_status: 'completed',
                    candidate_batch_id: candidate.batch_id,
                    failure_reason: null,
                    updated_at: new Date()
                });
                return { status: 'completed', candidate, intent, alreadyFinalized: false };
            }

            if (!payload.educationCategory || !EDUCATION_CATEGORY_OPTIONS.includes(payload.educationCategory)) {
                const message = 'Payment is confirmed, but the saved education category is invalid. Do not pay again; contact the organizer with your payment ID.';
                intent = await markIntentPending(intent, 'finalization_pending', message);
                return { status: 'pending', intent, message };
            }

            try {
                candidate = await table('candidates').insert(
                    buildCandidateRecordFromIntent({ intent, event, payload, orderId, paymentId, signature })
                );
                candidate = await table('candidates').updateById(candidate.batch_id, {
                    photo_path: candidatePhotoPath(candidate.batch_id)
                });
            } catch (insertError) {
                await table('candidates').refresh().catch(() => {});
                candidate = findPaymentCandidate({ orderId, paymentId });
                if (!candidate) {
                    const message = 'Payment is confirmed and your registration details are safely queued. Candidate record finalization will retry automatically. Do not pay again.';
                    intent = await markIntentPending(intent, 'finalization_pending', insertError.message || message);
                    return { status: 'pending', intent, message };
                }
            }

            await ensureCandidateEventMembership(candidate, event, intent.created_at || new Date());

            try {
                await ensureCandidateCredentials({ candidate, intent, plainPassword });
            } catch (credentialError) {
                const message = 'Payment and candidate record are saved. Account setup is pending and will retry automatically. Do not pay again.';
                intent = await markIntentPending(intent, 'candidate_saved_account_pending', credentialError.message || message);
                return { status: 'pending', candidate, intent, message };
            }

            intent = await table('registration_intents').updateById(intent.intent_id, {
                payment_status: 'completed',
                candidate_batch_id: candidate.batch_id,
                failure_reason: null,
                updated_at: new Date()
            });

            return { status: 'completed', candidate, intent, alreadyFinalized: false };
        });
    } catch (error) {
        console.error('Registration intent finalization failed:', error);
        return {
            status: 'pending',
            message: 'Payment is confirmed and your registration details were saved for recovery. Finalization will retry automatically. Do not pay again.'
        };
    }
};

const paymentOrderCreationByIntent = new Map();

const createPaymentOrderForIntent = async ({ intentId, purpose }) => {
    const existingRequest = paymentOrderCreationByIntent.get(String(intentId));
    if (existingRequest) return existingRequest;

    const request = (async () => {
        const intent = table('registration_intents').findById(intentId);
        if (!intent) throw createRegistrationError('Registration session was not found. Please submit the form again before payment.', 404);

        const paymentStatus = String(intent.payment_status || '');
        if (['payment_received', 'finalization_pending', 'candidate_saved_account_pending', 'completed', 'payment_conflict'].includes(paymentStatus)) {
            throw createRegistrationError('A payment has already been received for this registration. Do not pay again; contact the organizer.', 409);
        }

        if (String(intent.photo_validation_status || '') !== 'valid') {
            throw createRegistrationError('Please upload a clear solo photo before payment.', 400, 'photo_validation_failed');
        }

        const event = table('events').findById(intent.event_id);
        if (!event) throw createRegistrationError('The selected event is no longer available for payment.', 404);

        const razorpayConfig = getRazorpayConfig();
        const amountInInr = getEventRegistrationAmount(event, razorpayConfig);
        if (!Number.isFinite(amountInInr) || amountInInr < 0) {
            throw createRegistrationError('Invalid event payment amount.', 400);
        }

        if (amountInInr === 0) {
            await updateRegistrationIntent(intent.intent_id, {
                payment_amount: 0,
                payment_currency: razorpayConfig.currency,
                payment_status: 'payment_order_created',
                failure_reason: null
            });
            return {
                free: true,
                amount: 0,
                currency: razorpayConfig.currency,
                intentId: intent.intent_id
            };
        }

        const credentials = resolveRazorpayCredentials({
            activeEventConfig: event,
            fallbackConfig: razorpayConfig
        });
        if (!credentials.keyId || !credentials.keySecret) {
            throw createRegistrationError(credentials.error || 'Razorpay is not configured for this event.', 500);
        }

        const paymentClient = new Razorpay({
            key_id: credentials.keyId,
            key_secret: credentials.keySecret
        });

        if (intent.razorpay_order_id) {
            return {
                keyId: credentials.keyId,
                orderId: intent.razorpay_order_id,
                amount: Number(intent.payment_amount || 0),
                currency: intent.payment_currency || razorpayConfig.currency,
                intentId: intent.intent_id
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!event.is_active || !event.registration_cutoff_date || new Date(event.registration_cutoff_date) < today) {
            throw createRegistrationError('Registration is currently closed. No new payment can be started.', 403);
        }

        const order = await paymentClient.orders.create({
            amount: Math.round(amountInInr * 100),
            currency: razorpayConfig.currency,
            receipt: `reg_${intent.intent_id}_${Date.now()}`.slice(0, 40),
            notes: {
                registration_intent_id: String(intent.intent_id),
                purpose: String(purpose || 'Registration payment').slice(0, 255)
            }
        });

        await updateRegistrationIntent(intent.intent_id, {
            razorpay_order_id: order.id,
            payment_amount: order.amount,
            payment_currency: order.currency,
            payment_status: 'payment_order_created',
            failure_reason: null
        });

        return {
            keyId: credentials.keyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            intentId: intent.intent_id
        };
    })();

    paymentOrderCreationByIntent.set(String(intentId), request);
    try {
        return await request;
    } finally {
        paymentOrderCreationByIntent.delete(String(intentId));
    }
};

const findCapturedPaymentForIntent = async (intent) => {
    if (!intent?.razorpay_order_id) return null;

    const event = table('events').findById(intent.event_id);
    const credentials = resolveRazorpayCredentials({
        activeEventConfig: event,
        fallbackConfig: getRazorpayConfig()
    });
    if (!credentials.keyId || !credentials.keySecret) return null;

    const paymentClient = new Razorpay({
        key_id: credentials.keyId,
        key_secret: credentials.keySecret
    });
    const order = await paymentClient.orders.fetch(intent.razorpay_order_id);
    if (String(order?.status || '').toLowerCase() !== 'paid') return null;

    const paymentsResponse = await paymentClient.orders.fetchPayments(intent.razorpay_order_id);
    const payments = Array.isArray(paymentsResponse?.items) ? paymentsResponse.items : [];
    const capturedPayment = payments.find((payment) => String(payment?.status || '').toLowerCase() === 'captured') || payments[0];
    return capturedPayment?.id ? { orderId: intent.razorpay_order_id, paymentId: capturedPayment.id } : null;
};

let registrationRecoveryRunning = false;

const recoverPendingRegistrationIntents = async () => {
    if (registrationRecoveryRunning) return;
    registrationRecoveryRunning = true;

    try {
        const recoverableStatuses = new Set(['payment_order_created', 'payment_received', 'finalization_pending', 'candidate_saved_account_pending']);
        const pendingIntents = table('registration_intents').find((intent) =>
            recoverableStatuses.has(String(intent.payment_status || '')) &&
            intent.razorpay_order_id
        );

        for (const intent of pendingIntents) {
            let orderId = intent.razorpay_order_id;
            let paymentId = intent.razorpay_payment_id;
            if (!paymentId) {
                const capturedPayment = await findCapturedPaymentForIntent(intent).catch((error) => {
                    console.error(`Razorpay payment lookup failed for intent ${intent.intent_id}:`, error);
                    return null;
                });
                if (!capturedPayment) continue;
                orderId = capturedPayment.orderId;
                paymentId = capturedPayment.paymentId;
            }

            const result = await finalizeRegistrationIntent({
                intentId: intent.intent_id,
                orderId,
                paymentId,
                signature: intent.razorpay_signature || ''
            });
            if (result.status !== 'completed') {
                console.warn(`Registration recovery is still pending for intent ${intent.intent_id}: ${result.message || 'unknown error'}`);
            }
        }
    } catch (error) {
        console.error('Pending registration recovery failed:', error);
    } finally {
        registrationRecoveryRunning = false;
    }
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

const upsertLocationMaster = async (row) => {
    const stateRow = await table('state_master').upsertByKeys(['state_name'], {
        state_name: String(row.state || '').trim(),
        is_active: true
    });
    const districtRow = await table('district_master').upsertByKeys(['state_id', 'district_name'], {
        state_id: stateRow.state_id,
        district_name: String(row.district || '').trim(),
        is_active: true
    });
    const subdistrictRow = await table('subdistrict_master').upsertByKeys(['district_id', 'subdistrict_name'], {
        district_id: districtRow.district_id,
        subdistrict_name: getNormalizedSubdistrictName(row.tehsil),
        is_active: true
    });
    const locationRow = await table('location_master').upsertByKeys(['pincode', 'post_office', 'city', 'subdistrict_id'], {
        state_id: stateRow.state_id,
        district_id: districtRow.district_id,
        subdistrict_id: subdistrictRow.subdistrict_id,
        pincode: row.pincode,
        city: String(row.city || '').trim(),
        post_office: String(row.postOffice || '').trim(),
        village_name_local: row.villageNameLocal ? String(row.villageNameLocal).trim() : null,
        is_active: true
    });

    return {
        stateId: stateRow.state_id,
        districtId: districtRow.district_id,
        subdistrictId: subdistrictRow.subdistrict_id,
        locationId: locationRow.location_id
    };
};

// Seeds default/master data and the super-user account at boot.
const ensureCoreSetup = async () => {
    await backfillEventRegistrationCodes();

    for (const row of SAMPLE_PINCODE_MASTER_ROWS) {
        await upsertLocationMaster(row);
    }

    for (const row of DEFAULT_EDUCATION_MASTER_ROWS) {
        const exists = table('education_master').findOne(
            (e) => e.qualification === row.qualification && e.education_detail === row.educationDetail
        );
        if (!exists) {
            await table('education_master').insert({
                qualification: row.qualification,
                education_detail: row.educationDetail,
                sort_order: row.sortOrder,
                is_active: true
            });
        }
    }

    const uniqueExpectations = new Set();
    for (const candidate of table('candidates').all()) {
        const parsed = candidate.selected_expectations;
        if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
                const value = String(item || '').trim();
                if (value) uniqueExpectations.add(value);
            });
        }
    }
    if (uniqueExpectations.size === 0) {
        DEFAULT_EXPECTATION_MASTER_ROWS.forEach((item) => uniqueExpectations.add(item));
    }
    for (const expectationName of uniqueExpectations) {
        const exists = table('expectation_master').findOne((e) => e.expectation_name === expectationName);
        if (!exists) {
            await table('expectation_master').insert({ expectation_name: expectationName, is_active: true });
        }
    }

    for (const roleName of [ROLE_SUPER_USER, ROLE_ADMIN, ROLE_CANDIDATE]) {
        const exists = table('roles').findOne((r) => normalizeRoleName(r.role_name) === roleName);
        if (!exists) {
            await table('roles').insert({ language_id: null, role_name: roleName, is_active: true });
        }
    }

    const superUserEmail = process.env.SUPER_USER_EMAIL || 'admin@pcmc.com';
    const superUserPassword = process.env.SUPER_USER_PASSWORD || 'password123';
    const superUserPhone = process.env.SUPER_USER_PHONE || '';

    let superAdmin = table('admin_users').findOne((a) => a.is_super_user);
    if (!superAdmin) {
        superAdmin = await table('admin_users').insert({
            name: 'Super User',
            phone_number: superUserPhone,
            is_super_user: true,
            is_active: true
        });
    }

    const superRoleId = getRoleIdByName(ROLE_SUPER_USER);
    const existingSuperCred = table('auth_credentials').findOne(
        (c) => String(c.email || '').toLowerCase() === superUserEmail.toLowerCase()
    );

    if (!existingSuperCred) {
        const hashed = await bcrypt.hash(superUserPassword, 10);
        await table('auth_credentials').insert({
            email: superUserEmail,
            password: hashed,
            user_id: superAdmin.admin_id,
            role_id: superRoleId,
            is_active: true
        });
    } else {
        await table('auth_credentials').updateById(existingSuperCred.id, {
            user_id: superAdmin.admin_id,
            role_id: superRoleId,
            is_active: true
        });
    }
};

const getRazorpayConfig = () => ({
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    amount: Number(process.env.RAZORPAY_REGISTRATION_AMOUNT || 100),
    currency: process.env.RAZORPAY_CURRENCY || 'INR'
});

const getEventRegistrationAmount = (event, fallbackConfig = getRazorpayConfig()) => {
    const rawAmount = event?.razorpay_registration_amount;
    if (rawAmount !== null && rawAmount !== undefined && String(rawAmount).trim() !== '') {
        return Number(rawAmount);
    }
    return Number(fallbackConfig.amount);
};

const getClientPaymentGateways = (clientId) => {
    if (!clientId) return [];
    return table('client_payment_gateway')
        .find((item) => String(item.client_id) === String(clientId))
        .map((config) => ({ ...config, key_secret: decryptProtectedSecret(config.key_secret) }))
        .sort((first, second) => Number(first.config_id) - Number(second.config_id));
};

const getClientPaymentGateway = (clientId) => {
    const gateways = getClientPaymentGateways(clientId);
    return gateways.length === 1 ? gateways[0] : null;
};

const getEventPaymentGateway = (event) => {
    if (!event?.payment_gateway_id) return null;

    const gateway = table('client_payment_gateway').findById(event.payment_gateway_id);
    if (!gateway || String(gateway.client_id) !== String(event.client_id)) return null;
    return { ...gateway, key_secret: decryptProtectedSecret(gateway.key_secret) };
};

const toPaymentGatewayResponse = (config, clientId) => ({
    config_id: config?.config_id || null,
    client_id: clientId || config?.client_id || null,
    gateway_name: config?.gateway_name || '',
    provider: config?.provider || 'razorpay',
    key_id: config?.key_id || '',
    is_enabled: !!config?.is_enabled,
    secret_configured: !!config?.key_secret
});

const getActiveEventPaymentConfig = (requestedEventId = null) => {
    if (requestedEventId) {
        const requestedEvent = table('events').findById(requestedEventId);
        if (requestedEvent?.is_active) return requestedEvent;
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeEvents = table('events')
        .find((event) => event.is_active && event.registration_cutoff_date && new Date(event.registration_cutoff_date) >= today)
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    return activeEvents[0] || null;
};

const resolveRazorpayCredentials = ({ activeEventConfig, fallbackConfig }) => {
    const mappedGateway = getEventPaymentGateway(activeEventConfig);
    if (activeEventConfig?.payment_gateway_id && !mappedGateway) {
        return {
            keyId: '',
            keySecret: '',
            source: 'invalid_mapping',
            error: 'The selected payment gateway does not belong to this event client.'
        };
    }

    const clientGateways = getClientPaymentGateways(activeEventConfig?.client_id);
    const clientGateway = mappedGateway || (clientGateways.length === 1 ? clientGateways[0] : null);
    if (clientGateway) {
        if (!clientGateway.is_enabled) {
            return {
                keyId: '',
                keySecret: '',
                source: 'client_disabled',
                    error: 'Razorpay is disabled for this payment gateway. Enable it before accepting paid registrations.'
            };
        }

        const clientKeyId = String(clientGateway.key_id || '').trim();
        const clientKeySecret = String(clientGateway.key_secret || '').trim();
        if (clientKeyId && clientKeySecret) {
            return { keyId: clientKeyId, keySecret: clientKeySecret, source: 'client' };
        }

        return {
            keyId: '',
            keySecret: '',
            source: 'invalid',
            error: 'Razorpay settings are incomplete. Add both the Key ID and Key Secret to the selected payment gateway.'
        };
    }

    if (clientGateways.length > 1) {
        return {
            keyId: '',
            keySecret: '',
            source: 'missing_mapping',
            error: 'Select a payment gateway for this event before accepting paid registrations.'
        };
    }

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
            error: 'Legacy event Razorpay settings are incomplete. Configure the client payment gateway.'
        };
    }

    if (fallbackKeyId && fallbackKeySecret) {
        return { keyId: fallbackKeyId, keySecret: fallbackKeySecret, source: 'env' };
    }

    return {
        keyId: '',
        keySecret: '',
        source: 'missing',
        error: 'Razorpay credentials are not configured. Configure the client payment gateway.'
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

const verifyRazorpayWebhookSignature = ({ rawBody, signature, webhookSecret }) => {
    if (!rawBody || !signature || !webhookSecret) return false;

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(String(signature), 'utf8');
    return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getEmailDeliveryFailureMessage = (error) => {
    const code = String(error?.code || '').toUpperCase();
    const responseCode = Number(error?.responseCode || 0);
    const message = String(error?.message || '');

    if (code === 'EAUTH' || responseCode === 535 || /username and password not accepted/i.test(message)) {
        return 'Confirmation email could not be sent because the Gmail App Password was rejected. Your registration is saved; please contact the organizer.';
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || /timed out/i.test(message)) {
        return 'Confirmation email could not be sent because the email server did not respond. Your registration is saved; please contact the organizer.';
    }
    if (code === 'ECONNECTION' || code === 'ENOTFOUND' || /connect|network/i.test(message)) {
        return 'Confirmation email could not be sent because the email server is unavailable. Your registration is saved; please contact the organizer.';
    }

    return 'Confirmation email could not be sent. Your registration is saved; please contact the organizer.';
};

const getActiveClientPlan = (clientId) => {
    if (!clientId) return null;
    const now = Date.now();
    return table('client_subscriptions').all()
        .filter((subscription) => String(subscription.client_id) === String(clientId))
        .filter((subscription) => String(subscription.status || '').toLowerCase() === 'active')
        .filter((subscription) => !subscription.starts_at || new Date(subscription.starts_at).getTime() <= now)
        .filter((subscription) => !subscription.ends_at || new Date(subscription.ends_at).getTime() >= now)
        .map((subscription) => ({
            ...subscription,
            plan: table('subscription_plans').findById(subscription.plan_id)
        }))
        .filter((subscription) => subscription.plan && isActiveFlag(subscription.plan.is_active))
        .sort((first, second) => new Date(second.starts_at || 0) - new Date(first.starts_at || 0))
        [0] || null;
};

const isActiveFlag = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return !['false', '0', 'no', 'inactive'].includes(normalized);
};

const normalizePincodeValue = (value) => String(value ?? '').trim().replace(/\D/g, '');

const getRegistrationFailureMessage = (error) => {
    const message = String(error?.message || '');

    if (/permission|database|mysql/i.test(message)) {
        return 'Candidate record could not be saved because the registration database is unavailable. Do not pay again; contact the organizer with your payment ID.';
    }
    if (/auth_credentials/i.test(message)) {
        return 'Candidate record could not be saved because account setup failed. Do not pay again; contact the organizer with your payment ID.';
    }

    return 'Candidate record could not be saved. Do not pay again; contact the organizer with your payment ID.';
};

const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildRegistrationEmailHtml = ({ fullName, userId, password, batchId, eventName, orderId, paymentId, paymentDate }) => {
    const safeName = fullName || 'Candidate';
    const safeBatchId = batchId || 'N/A';
    const safeEventName = eventName || 'Active Event';
    const rows = [
        ['User ID', userId],
        ['Password', password || 'N/A'],
        ['Stage ID', safeBatchId],
        ['Event', safeEventName],
        ['Order ID', orderId || 'N/A'],
        ['Payment ID', paymentId || 'N/A'],
        ['Payment Date', paymentDate || 'N/A']
    ];

    return `<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background:#f4ead7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Registration confirmed for ${escapeHtml(safeName)}. Stage ID ${escapeHtml(safeBatchId)} and entry QR code are inside.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4ead7;padding:26px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#fffaf0;border:1px solid #e6bf73;border-radius:22px;overflow:hidden;box-shadow:0 10px 32px rgba(78,28,13,0.16);">
                    <tr>
                        <td style="background:#7f1d1d;color:#fff7ed;padding:0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#7f1d1d;">
                                <tr>
                                    <td style="padding:26px 30px 24px;">
                                        <div style="font-size:12px;font-weight:800;letter-spacing:2.4px;text-transform:uppercase;color:#fcd34d;">PCMC Registration Confirmed</div>
                                        <div style="font-size:30px;font-weight:900;margin-top:10px;line-height:1.18;color:#fff7ed;">Jay Hinglaj ${escapeHtml(safeName)}</div>
                                        <div style="margin-top:12px;font-size:15px;line-height:1.6;color:#fde68a;">Your event entry pass is ready. Keep this email handy and show the QR code at the entry desk.</div>
                                    </td>
                                    <td align="right" valign="top" style="padding:26px 30px 24px 8px;width:160px;">
                                        <div style="display:inline-block;border:1px solid rgba(252,211,77,0.55);border-radius:16px;background:#fff7ed;color:#7f1d1d;padding:12px 14px;text-align:center;">
                                            <div style="font-size:10px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;color:#92400e;">Stage ID</div>
                                            <div style="margin-top:4px;font-size:22px;font-weight:900;line-height:1.1;color:#7f1d1d;">${escapeHtml(safeBatchId)}</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:26px 30px 12px;">
                            <p style="margin:0 0 10px;font-size:16px;line-height:1.65;color:#374151;">Namaskar ${escapeHtml(safeName)},</p>
                            <p style="margin:0;font-size:16px;line-height:1.65;color:#374151;">Your registration and payment have been completed successfully. The details below are your login record and event entry pass information.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px 22px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #edd18f;border-radius:18px;overflow:hidden;">
                                ${rows.map(([label, value]) => `<tr><td style="width:35%;padding:13px 16px;border-bottom:1px solid #f6e5bd;font-size:12px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.8px;background:#fff8e8;">${escapeHtml(label)}</td><td style="padding:13px 16px;border-bottom:1px solid #f6e5bd;font-size:15px;font-weight:800;color:#111827;word-break:break-word;">${escapeHtml(value || 'N/A')}</td></tr>`).join('')}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 30px 28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1f2937;border-radius:20px;overflow:hidden;">
                                <tr>
                                    <td valign="middle" style="padding:22px 22px;color:#fff7ed;">
                                        <div style="font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#fcd34d;">Entry Pass QR</div>
                                        <div style="margin-top:8px;font-size:22px;font-weight:900;line-height:1.25;">Scan this at event entry</div>
                                        <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#fde68a;">This QR is also attached as <strong>entry-pass-qr.png</strong> in case images are blocked by your email app.</div>
                                    </td>
                                    <td align="center" valign="middle" style="padding:18px;width:220px;">
                                        <div style="display:inline-block;background:#ffffff;border-radius:18px;padding:12px;border:1px solid #fcd34d;">
                                            <img src="cid:entry-pass-qr" width="190" height="190" alt="Event Entry QR Code" style="display:block;width:190px;height:190px;border:0;outline:none;text-decoration:none;" />
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:#fff3d6;padding:18px 30px;text-align:center;font-size:13px;line-height:1.6;color:#7c2d12;">
                            Please do not share your password publicly. For entry help, show this email with Stage ID <strong>${escapeHtml(safeBatchId)}</strong>.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
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
        return {
            sent: false,
            message: 'Confirmation email service is not configured. Your registration is saved; please contact the organizer.'
        };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

        const qrPayload = JSON.stringify({
            batchId,
            userId,
            eventName,
            paymentId,
            paymentDate
        });
        const qrCodeBuffer = await QRCode.toBuffer(qrPayload, { width: 280, margin: 2, errorCorrectionLevel: 'M' });

        await transporter.sendMail({
            from: fromEmail,
            to,
            subject: `Registration Successful - Stage ${batchId}`,
            text: `Namaskar ${fullName || 'Candidate'},\n\nYour registration and payment are successful.\n\nEntry Details:\nUser ID: ${userId || to}\nPassword: ${password || 'N/A'}\nStage ID: ${batchId}\nEvent: ${eventName || 'Active Event'}\nOrder ID: ${orderId || 'N/A'}\nPayment ID: ${paymentId || 'N/A'}\nPayment Date: ${paymentDate || 'N/A'}\n\nYour event entry QR code is attached as entry-pass-qr.png. Please keep this email handy for event entry.\n\nThank you.`,
            html: buildRegistrationEmailHtml({ fullName, userId: userId || to, password, batchId, eventName, orderId, paymentId, paymentDate }),
            attachments: [{
                filename: 'entry-pass-qr.png',
                content: qrCodeBuffer,
                contentType: 'image/png',
                cid: 'entry-pass-qr'
            }]
        });

        return { sent: true, message: 'Confirmation email sent.' };
    } catch (error) {
        console.error('Registration email send failed:', error);
        return { sent: false, message: getEmailDeliveryFailureMessage(error) };
    }
};

// JWT Middleware
const verifyToken = async (req, res, next) => {
    const authorization = String(req.headers.authorization || '');
    if (!/^Bearer\s+[^\s]+$/i.test(authorization)) return res.status(401).json({ error: 'No token provided' });

    try {
        const token = authorization.replace(/^Bearer\s+/i, '');
        const decoded = jwt.verify(token, getJwtSecret());
        const credential = table('auth_credentials').findOne((item) => String(item.user_id) === String(decoded.id));
        const roleRow = credential?.role_id ? table('roles').findById(credential.role_id) : null;
        const roleName = normalizeRoleName(roleRow?.role_name || decoded.role);

        if (!credential?.is_active || !roleName || !roleRow?.is_active) {
            return res.status(401).json({ error: 'Account is inactive or unavailable' });
        }

        if (roleName === ROLE_CANDIDATE) {
            const candidate = table('candidates').findById(decoded.id);
            if (!candidate || candidate.is_active === false) return res.status(401).json({ error: 'Candidate account is inactive' });
        }

        if (roleName === ROLE_ADMIN || roleName === ROLE_SUPER_USER) {
            const admin = table('admin_users').findById(decoded.id);
            if (!admin || admin.is_active === false) return res.status(401).json({ error: 'Admin account is inactive' });
            if (roleName === ROLE_ADMIN) {
                const clientId = admin.client_id || table('client_admin_mapping').findOne((mapping) =>
                    String(mapping.admin_id) === String(decoded.id) && isActiveFlag(mapping.is_active)
                )?.client_id;
                if (clientId && !getActiveClientPlan(clientId)) {
                    return res.status(403).json({ error: 'Client subscription plan is inactive or expired.' });
                }
            }
        }

        req.user = decoded;
        req.userId = decoded.id;
        req.role = roleName;
        res.set('Cache-Control', 'no-store');
        return next();
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

const getAdminClientId = (req) => {
    if (normalizeRoleName(req.role) === ROLE_SUPER_USER) return null;
    const admin = table('admin_users').findById(req.userId);
    if (admin?.client_id) return admin.client_id;
    return table('client_admin_mapping').findOne((mapping) =>
        String(mapping.admin_id) === String(req.userId) && mapping.is_active !== false
    )?.client_id || null;
};

const isSuperUserRequest = (req) => normalizeRoleName(req.role) === ROLE_SUPER_USER;
const scopedClientId = (req, requestedClientId) => isSuperUserRequest(req) ? (requestedClientId || null) : getAdminClientId(req);
const matchesAdminClientScope = (req, clientId) => isSuperUserRequest(req)
    || (!!getAdminClientId(req) && String(clientId) === String(getAdminClientId(req)));

const getCandidateEventIds = (candidate) => {
    const mappedEventIds = table('candidate_event_registrations').all()
        .filter((registration) => String(registration.batch_id) === String(candidate?.batch_id) && registration.is_active !== false)
        .map((registration) => registration.event_id)
        .filter(Boolean);
    if (mappedEventIds.length) return mappedEventIds;
    return candidate?.event_id ? [candidate.event_id] : [];
};

const getCandidateActiveEventIds = (candidate) => {
    const now = Date.now();
    return table('candidate_event_registrations').all()
        .filter((registration) => String(registration.batch_id) === String(candidate?.batch_id) && isActiveFlag(registration.is_active))
        .filter((registration) => {
            const event = table('events').findById(registration.event_id);
            const subscription = table('subscriptions').findOne((item) =>
                String(item.batch_id) === String(candidate?.batch_id)
                && String(item.event_id) === String(registration.event_id)
                && String(item.client_id) === String(registration.client_id)
            );
            const expiryTime = subscription?.access_expiry_date ? new Date(subscription.access_expiry_date).getTime() : NaN;
            return Boolean(event?.client_id)
                && String(event.client_id) === String(registration.client_id)
                && Boolean(subscription)
                && isActiveFlag(subscription.is_active)
                && Number.isFinite(expiryTime)
                && expiryTime >= now;
        })
        .map((registration) => registration.event_id)
        .filter(Boolean);
};

const candidateBelongsToClient = (candidate, clientId) => getCandidateEventIds(candidate).some((eventId) => {
    const event = table('events').findById(eventId);
    return String(event?.client_id || '') === String(clientId);
});

const candidatesShareEvent = (firstCandidate, secondCandidate) => {
    const firstEventIds = getCandidateActiveEventIds(firstCandidate);
    return firstEventIds.some((eventId) => getCandidateActiveEventIds(secondCandidate).some((candidateEventId) => String(candidateEventId) === String(eventId)));
};

const getCandidateInteractionState = (fromCandidateId, toCandidateId) => {
    const outgoing = table('candidate_interactions').findOne((interaction) =>
        String(interaction.from_candidate_id) === String(fromCandidateId)
        && String(interaction.to_candidate_id) === String(toCandidateId)
    );
    const incoming = table('candidate_interactions').findOne((interaction) =>
        String(interaction.from_candidate_id) === String(toCandidateId)
        && String(interaction.to_candidate_id) === String(fromCandidateId)
    );
    const isShortlisted = outgoing?.is_shortlisted === true || outgoing?.is_shortlisted === 1;
    const hasShortlistedYou = incoming?.is_shortlisted === true || incoming?.is_shortlisted === 1;
    const isLiked = outgoing?.is_liked === true || outgoing?.is_liked === 1;
    const hasLikedYou = incoming?.is_liked === true || incoming?.is_liked === 1;
    return {
        isShortlisted,
        hasShortlistedYou,
        isMutual: isShortlisted && hasShortlistedYou,
        isLiked,
        hasLikedYou
    };
};

app.put('/api/candidate/interactions/:candidateId', verifyToken, requireAnyRole(ROLE_CANDIDATE), async (req, res) => {
    try {
        const fromCandidateId = req.userId;
        const toCandidateId = req.params.candidateId;
        const field = req.body?.shortlisted !== undefined ? 'shortlisted' : req.body?.liked !== undefined ? 'liked' : null;
        if (!field) return res.status(400).json({ error: 'Interaction field is required.' });

        const fromCandidate = table('candidates').findById(fromCandidateId);
        const toCandidate = table('candidates').findById(toCandidateId);
        if (!fromCandidate || !toCandidate) return res.status(404).json({ error: 'Candidate profile not found.' });
        if (String(fromCandidateId) === String(toCandidateId)) return res.status(400).json({ error: 'You cannot interact with your own profile.' });
        if (toCandidate.is_active === false || !candidatesShareEvent(fromCandidate, toCandidate)) {
            return res.status(403).json({ error: 'This profile is not available for interaction.' });
        }

        const value = req.body[field] === true || req.body[field] === 'true';
        await table('candidate_interactions').upsertByKeys(['from_candidate_id', 'to_candidate_id'], {
            from_candidate_id: fromCandidateId,
            to_candidate_id: toCandidateId,
            [`is_${field}`]: value,
            updated_at: new Date()
        });

        const state = getCandidateInteractionState(fromCandidateId, toCandidateId);
        return res.json({
            success: true,
            field,
            value,
            mutual: state.isMutual,
            isMutual: state.isMutual,
            isShortlisted: state.isShortlisted,
            hasShortlistedYou: state.hasShortlistedYou,
            isLiked: state.isLiked,
            hasLikedYou: state.hasLikedYou
        });
    } catch (error) {
        console.error('Candidate interaction error:', error);
        return res.status(500).json({ error: 'Interaction could not be saved.' });
    }
});

app.get('/api/candidate/notifications', verifyToken, requireAnyRole(ROLE_CANDIDATE), async (req, res) => {
    try {
        const recipient = table('candidates').findById(req.userId);
        if (!recipient) return res.status(404).json({ error: 'Candidate profile not found.' });

        const notifications = table('candidate_interactions').all()
            .filter((interaction) =>
                String(interaction.to_candidate_id) === String(req.userId)
                && (interaction.is_shortlisted === true || interaction.is_shortlisted === 1)
            )
            .map((interaction) => {
                const sender = table('candidates').findById(interaction.from_candidate_id);
                if (!sender || sender.is_active === false || !candidatesShareEvent(recipient, sender)) return null;
                const state = getCandidateInteractionState(req.userId, sender.batch_id);
                const senderName = [sender.first_name, sender.middle_name, sender.last_name].filter(Boolean).join(' ') || 'Candidate';
                return {
                    id: interaction.interaction_id,
                    type: state.isMutual ? 'mutual_match' : 'shortlist',
                    candidateId: sender.batch_id,
                    name: state.isMutual ? senderName : 'Someone',
                    updated_at: interaction.updated_at,
                    created_at: interaction.created_at
                };
            })
            .filter(Boolean)
            .sort((first, second) => new Date(second.updated_at || second.created_at || 0) - new Date(first.updated_at || first.created_at || 0));

        return res.json({ notifications });
    } catch (error) {
        console.error('Candidate notifications error:', error);
        return res.status(500).json({ error: 'Notifications could not be loaded.' });
    }
});

// Activity Logger
const redactActivityValue = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(redactActivityValue);

    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => {
        const normalizedKey = key.toLowerCase();
        const isSensitive = normalizedKey.includes('password') ||
            normalizedKey.includes('secret') ||
            normalizedKey.includes('token') ||
            normalizedKey.includes('signature') ||
            normalizedKey.includes('photo_data') ||
            normalizedKey.includes('payment_details') ||
            normalizedKey.includes('razorpay_payment_id') ||
            normalizedKey.includes('razorpay_order_id');
        return [key, isSensitive ? '[REDACTED]' : redactActivityValue(nestedValue)];
    }));
};

const logActivity = async (adminId, action, tableName, recordId, oldValues = null, newValues = null) => {
    try {
        await table('activity_logs').insert({
            admin_id: adminId,
            action,
            table_name: tableName,
            record_id: recordId,
            old_values: redactActivityValue(oldValues),
            new_values: redactActivityValue(newValues)
        });
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};
const getActivityLogClientId = (log) => {
    const values = typeof log.new_values === 'string'
        ? (() => { try { return JSON.parse(log.new_values); } catch { return {}; } })()
        : (log.new_values || {});
    if (values.client_id) return values.client_id;

    if (log.table_name === 'clients') return log.record_id || null;
    if (log.table_name === 'admin_users') {
        const mapping = table('client_admin_mapping').findOne((item) => String(item.admin_id) === String(log.record_id) && item.is_active !== false);
        if (mapping) return mapping.client_id;
        if (values.volunteer_id) return table('volunteers').findById(values.volunteer_id)?.client_id || null;
    }

    let record = null;
    if (log.record_id) {
        try { record = table(log.table_name).findById(log.record_id); } catch { record = null; }
    }
    if (record?.client_id) return record.client_id;
    if (log.table_name === 'candidates') {
        const eventIds = getCandidateEventIds(record);
        return table('events').find((event) => eventIds.some((eventId) => String(event.event_id) === String(eventId)))?.client_id || null;
    }
    if (log.action === 'create_client' && values.client_name) {
        return table('clients').find((client) => String(client.client_name).trim().toLowerCase() === String(values.client_name).trim().toLowerCase())?.client_id || null;
    }
    return null;
};

const calcAge = (birthDate) => {
    if (!birthDate) return null;
    const dob = new Date(birthDate);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
    return age;
};

const serializeOnlineSuchiProfile = (candidate, interactionState, viewerIsCandidate, allowedEventIds = null) => {
    const isMutual = !viewerIsCandidate || interactionState.isMutual;
    const profile = {
        id: candidate.batch_id,
        age: calcAge(candidate.birth_date),
        education_category: candidate.education_category,
        education_qualification: candidate.education_qualification,
        education_details: candidate.education_details,
        job_business_title: candidate.job_business_title,
        annual_income: candidate.annual_income,
        job_business_location: candidate.job_business_location,
        city_village: candidate.city_village,
        district: candidate.district,
        state: candidate.state,
        location: [candidate.city_village, candidate.district, candidate.state].filter(Boolean).join(', '),
        mamekul: candidate.mamekul,
        selected_expectations: candidate.selected_expectations,
        other_expectations: candidate.other_expectations,
        registered_events: getRegisteredEventSummaries(candidate, allowedEventIds),
        photo_path: candidate.batch_id && (candidate.photo_data || candidate.photo_path)
            ? candidatePhotoAccessPath(candidate.batch_id)
            : null,
        can_view_sensitive: isMutual,
        is_liked: interactionState.isLiked,
        has_liked_you: interactionState.hasLikedYou,
        is_shortlisted: interactionState.isShortlisted,
        has_shortlisted_you: interactionState.hasShortlistedYou,
        is_mutual: interactionState.isMutual
    };

    if (isMutual) {
        Object.assign(profile, {
            first_name: candidate.first_name,
            middle_name: candidate.middle_name,
            last_name: candidate.last_name,
            gender: candidate.gender,
            marriage_type: candidate.marriage_type,
            height: candidate.height,
            complexion: candidate.complexion,
            birth_date: candidate.birth_date,
            birth_time: candidate.birth_time,
            birth_place: candidate.birth_place,
            blood_group: candidate.blood_group,
            gotra: candidate.gotra,
            zodiac: candidate.zodiac,
            gan: candidate.gan,
            nadi: candidate.nadi,
            charan: candidate.charan,
            nakshatra: candidate.nakshatra,
            mobile_number: candidate.mobile_number,
            whatsapp_number: candidate.whatsapp_number,
            address_line: candidate.address_line,
            pincode: candidate.pincode,
            tehsil: candidate.tehsil
        });
    }

    return profile;
};

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/registration-profile-check', express.json(), async (req, res) => {
    try {
        const payload = normalizeCandidatePayload(req.body || {});
        const conflict = findCandidateConflict(payload);
        if (!conflict) return res.json({ exists: false });

        const eventId = Number(req.body?.eventId || 0);
        const alreadyRegisteredForEvent = eventId > 0 && Boolean(
            table('candidate_event_registrations').findOne((registration) =>
                String(registration.batch_id) === String(conflict.candidate.batch_id) &&
                String(registration.event_id) === String(eventId) &&
                registration.is_active !== false
            )
        );

        return res.json({
            exists: true,
            matchType: conflict.type,
            alreadyRegisteredForEvent,
            candidate: null
        });
    } catch (error) {
        console.error('Registration profile check error:', error);
        return res.status(500).json({ error: 'Could not check existing registration details.' });
    }
});

app.get('/api/candidates/:candidateId/photo', async (req, res) => {
    let accessPayload;
    try {
        const accessToken = String(req.query?.accessToken || '');
        accessPayload = accessToken ? jwt.verify(accessToken, getJwtSecret()) : null;
        if (accessPayload?.scope !== 'candidate-photo' || String(accessPayload.candidateId) !== String(req.params.candidateId)) {
            return res.status(401).end();
        }

        const candidate = table('candidates').findById(req.params.candidateId);
        if (!candidate?.photo_data) return res.status(404).end();
        res.type(candidate.photo_mime_type || 'application/octet-stream');
        res.set('Cache-Control', 'private, max-age=300');
        res.set('Referrer-Policy', 'no-referrer');
        return res.send(candidate.photo_data);
    } catch (error) {
        if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') return res.status(401).end();
        console.error('Candidate photo load error:', error);
        return res.status(500).end();
    }
});

app.get('/api/events/:eventId/media/:kind', async (req, res) => {
    try {
        const event = table('events').findById(req.params.eventId);
        const media = req.params.kind === 'banner'
            ? { data: event?.registration_banner_data, mime: event?.registration_banner_mime_type }
            : { data: event?.organizer_photo_data, mime: event?.organizer_photo_mime_type };
        if (!media.data) return res.status(404).end();
        res.type(media.mime || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(media.data);
    } catch (error) {
        console.error('Event media load error:', error);
        return res.status(500).end();
    }
});

app.get('/api/volunteers/:volunteerId/photo', async (req, res) => {
    try {
        const accessToken = String(req.query?.accessToken || '');
        const accessPayload = accessToken ? jwt.verify(accessToken, getJwtSecret()) : null;
        if (accessPayload?.scope !== 'volunteer-photo' || String(accessPayload.volunteerId) !== String(req.params.volunteerId)) {
            return res.status(401).end();
        }

        const volunteer = table('volunteers').findById(req.params.volunteerId);
        if (!volunteer?.photo_data) return res.status(404).end();
        res.type(volunteer.photo_mime_type || 'application/octet-stream');
        res.set('Cache-Control', 'no-store');
        return res.send(volunteer.photo_data);
    } catch (error) {
        if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') return res.status(401).end();
        console.error('Volunteer photo load error:', error);
        return res.status(500).end();
    }
});

app.get('/api/clients/:clientId/logo', async (req, res) => {
    try {
        const client = table('clients').findById(req.params.clientId);
        if (!client?.logo_data) return res.status(404).end();
        res.type(client.logo_mime_type || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(client.logo_data);
    } catch (error) {
        console.error('Client logo load error:', error);
        return res.status(500).end();
    }
});

app.post('/api/registration-intents', registrationRateLimiter, upload.single('photo'), async (req, res) => {
    try {
        const requestedEventId = Number(req.body?.event_id || 0) || null;
        const event = getActiveEventPaymentConfig(requestedEventId);
        if (!event) {
            return res.status(403).json({
                error: requestedEventId
                    ? 'This event is not active or registration is currently closed.'
                    : 'Registration is currently closed. No new payment can be started.'
            });
        }

        const payload = normalizeCandidatePayload(req.body);
        if (req.body?.dob && !payload.birthDate) {
            return res.status(400).json({ error: 'Invalid Date of Birth. Please use DD-MM-YYYY.' });
        }
        if (!payload.marriageType) {
            return res.status(400).json({ error: 'Marriage status is required.' });
        }
        if (!payload.educationCategory || !EDUCATION_CATEGORY_OPTIONS.includes(payload.educationCategory)) {
            return res.status(400).json({ error: 'Please select a valid education category.' });
        }

        validateProfilePhotoUpload(req.file, { required: false });

        let { intent } = await reserveRegistrationIntent({ event, payload });
        if (req.file) {
            const photoStorage = getPhotoStorage(req.file);
            intent = await updateRegistrationIntent(intent.intent_id, {
                ...photoStorage,
                photo_validation_status: 'valid',
                photo_validated_at: new Date(),
                failure_reason: null
            });
        } else if (String(intent.photo_validation_status || '') !== 'valid') {
            throw createRegistrationError('Please upload a clear solo photo before payment.', 400, 'photo_validation_failed');
        }

        res.cookie('registrationIntent', createRegistrationIntentCookie(intent.intent_id), getRegistrationIntentCookieOptions());
        return res.status(201).json({
            message: 'Ready for payment.',
            intentId: intent.intent_id
        });
    } catch (error) {
        console.error('Registration intent error:', error);
        return res.status(error.status || 500).json({
            error: error.publicMessage || 'Registration details could not be saved before payment.',
            code: error.code || null,
            details: error.status ? null : getRegistrationFailureMessage(error)
        });
    }
});

app.post('/api/register', registrationRateLimiter, upload.none(), async (req, res) => {
    try {
        const intentId = Number(req.body?.registration_intent_id || req.body?.intentId || 0);
        const orderId = String(req.body?.razorpay_order_id || '').trim();
        const paymentId = String(req.body?.razorpay_payment_id || '').trim();
        const signature = String(req.body?.razorpay_signature || '').trim();
        const plainPassword = String(req.body?.password || '');

        if (!intentId) {
            return res.status(400).json({
                error: 'Registration session is required before saving registration.'
            });
        }

        const intent = table('registration_intents').findById(intentId);
        if (!intent) {
            return res.status(404).json({
                error: 'Registration session was not found. Do not pay again; contact the organizer with your payment ID.'
            });
        }
        if (!hasValidRegistrationIntentCookie(req.cookies?.registrationIntent, intentId)) {
            return res.status(403).json({ error: 'Registration session could not be verified. Please submit the form again.' });
        }
        const event = table('events').findById(intent.event_id);
        const isFreeEvent = getEventRegistrationAmount(event) === 0;
        if (!isFreeEvent && (!orderId || !paymentId || !signature)) {
            return res.status(400).json({
                error: 'Payment verification is required before saving a paid registration.'
            });
        }
        if (String(intent.razorpay_order_id || '') !== orderId) {
            return res.status(400).json({
                error: 'Payment order does not match the saved registration session. Do not pay again; contact the organizer with your payment ID.'
            });
        }

        if (!isFreeEvent) {
            const credentials = resolveRazorpayCredentials({
                activeEventConfig: event,
                fallbackConfig: getRazorpayConfig()
            });
            if (!credentials.keySecret) {
                return res.status(500).json({ error: credentials.error || 'Razorpay verification is not configured.' });
            }
            if (!verifyRazorpaySignature({ orderId, paymentId, signature, keySecret: credentials.keySecret })) {
                return res.status(400).json({ error: 'Invalid payment verification data.' });
            }
        }

        if (plainPassword && intent.password_hash) {
            const passwordMatches = await bcrypt.compare(plainPassword, intent.password_hash);
            if (!passwordMatches) {
                return res.status(400).json({
                    error: 'Registration password does not match the details saved before payment. Do not pay again; contact the organizer with your payment ID.'
                });
            }
        }

        const finalization = await finalizeRegistrationIntent({
            intentId,
            orderId,
            paymentId,
            signature,
            plainPassword
        });

        if (finalization.status === 'conflict') {
            return res.status(409).json({ error: finalization.message });
        }
        if (finalization.status !== 'completed' || !finalization.candidate) {
            return res.status(202).json({
                status: 'recovery_pending',
                message: finalization.message || 'Payment is confirmed and registration recovery is in progress. Do not pay again.'
            });
        }

        const candidate = finalization.candidate;
        const registrationCode = getCandidateEventRegistrationCode(candidate.batch_id, event.event_id)
            || null;
        const emailDelivery = finalization.alreadyFinalized || !plainPassword
            ? {
                sent: null,
                message: finalization.alreadyFinalized
                    ? 'Registration was already saved for this payment.'
                    : 'Registration was saved. Confirmation email delivery will be retried automatically.'
            }
            : await sendRegistrationSuccessEmail({
                to: candidate.email,
                fullName: [candidate.first_name, candidate.middle_name, candidate.last_name].filter(Boolean).join(' '),
                userId: candidate.email,
                password: plainPassword,
                batchId: registrationCode,
                eventName: event?.event_name,
                orderId,
                paymentId,
                paymentDate: candidate.payment_date || new Date().toLocaleString('en-GB')
            });

        const accessToken = jwt.sign({ id: candidate.batch_id, email: candidate.email, role: ROLE_CANDIDATE }, getJwtSecret(), { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: candidate.batch_id, email: candidate.email, role: ROLE_CANDIDATE }, getRefreshSecret(), { expiresIn: '7d' });
        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
        res.clearCookie('registrationIntent', {
            secure: isProduction,
            sameSite: process.env.COOKIE_SAME_SITE || 'lax',
            path: '/api'
        });

        return res.status(finalization.alreadyFinalized ? 200 : 201).json({
            message: finalization.alreadyFinalized ? 'Registration already saved for this payment.' : 'Registered successfully!',
            accessToken,
            candidateId: candidate.batch_id,
            registrationCode,
            batchId: registrationCode,
            user: sanitizeCandidateProfile(candidate),
            email: emailDelivery
        });
    } catch (error) {
        console.error('Registration finalization error:', error);
        return res.status(error.status || 500).json({
            error: error.publicMessage || 'Payment was received, but registration finalization needs recovery.',
            details: error.status ? null : 'Do not pay again. Keep your payment ID and contact the organizer.'
        });
    }
});

app.post('/api/register-legacy', registrationRateLimiter, upload.single('photo'), async (req, res) => {
    let insertedCandidateId = null;
    try {
        const activeEvents = table('events')
            .find((event) => event.is_active && event.registration_cutoff_date && new Date(event.registration_cutoff_date) >= new Date(new Date().setHours(0, 0, 0, 0)))
            .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

        if (activeEvents.length === 0) {
            return res.status(403).json({
                error: 'Registration is currently closed. There is no active event at this time.'
            });
        }

        const eventId = activeEvents[0].event_id;
        const activeEventName = activeEvents[0].event_name;
        const activeEventConfig = getActiveEventPaymentConfig();
        const payload = normalizeCandidatePayload(req.body);
        const { email, password } = payload;

        if (req.body?.dob && !payload.birthDate) {
            return res.status(400).json({ error: 'Invalid Date of Birth. Please use DD-MM-YYYY.' });
        }

        if (!payload.marriageType) {
            return res.status(400).json({ error: 'Marriage status is required' });
        }

        const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
        const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
        const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ error: 'Payment verification is required before saving registration.' });
        }

        const credentialConfig = resolveRazorpayCredentials({
            activeEventConfig,
            fallbackConfig: getRazorpayConfig()
        });

        if (!credentialConfig.keySecret) {
            return res.status(500).json({ error: credentialConfig.error || 'Razorpay credentials are not configured.' });
        }

        const signatureSecret = credentialConfig.keySecret;

        if (!verifyRazorpaySignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature, keySecret: signatureSecret })) {
            return res.status(400).json({ error: 'Invalid payment verification data.' });
        }

        // Idempotency and recovery: if same payment/email already created candidate, return success.
        const existingByPayment = table('candidates')
            .find((c) => c.razorpay_payment_id === razorpayPaymentId || c.razorpay_order_id === razorpayOrderId)
            .sort((a, b) => Number(b.batch_id) - Number(a.batch_id));

        const existingByEmail = table('candidates')
            .find((c) => String(c.email || '').toLowerCase() === email.toLowerCase())
            .sort((a, b) => Number(b.batch_id) - Number(a.batch_id));

        const existingCandidate = existingByPayment[0] || existingByEmail[0] || null;
        if (existingCandidate) {
            const samePayment =
                String(existingCandidate.razorpay_payment_id || '') === razorpayPaymentId ||
                String(existingCandidate.razorpay_order_id || '') === razorpayOrderId;
            const alreadyCaptured = String(existingCandidate.payment_status || '').toLowerCase() === 'captured';

            if (samePayment || alreadyCaptured) {
                const candidateRoleId = getRoleIdByName(ROLE_CANDIDATE);
                const existingCred = table('auth_credentials').findOne(
                    (c) => String(c.user_id) === String(existingCandidate.batch_id) ||
                        String(c.email || '').toLowerCase() === String(existingCandidate.email || email).toLowerCase()
                );

                if (!existingCred && candidateRoleId) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await table('auth_credentials').insert({
                        user_id: existingCandidate.batch_id,
                        email: existingCandidate.email || email,
                        password: hashedPassword,
                        role_id: candidateRoleId,
                        is_active: true
                    });
                }

                const createdCandidate = table('candidates').findById(existingCandidate.batch_id);
                await ensureCandidateEventMembership(createdCandidate, activeEvents[0], createdCandidate.registration_date || new Date());
                const registrationCode = getCandidateEventRegistrationCode(createdCandidate.batch_id, eventId)
                    || null;

                const tokenEmail = existingCandidate.email || email;
                const accessToken = jwt.sign({ id: existingCandidate.batch_id, email: tokenEmail, role: ROLE_CANDIDATE }, getJwtSecret(), { expiresIn: '15m' });
                const refreshToken = jwt.sign({ id: existingCandidate.batch_id, email: tokenEmail, role: ROLE_CANDIDATE }, getRefreshSecret(), { expiresIn: '7d' });

                res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
                return res.status(200).json({
                    message: 'Registration already saved for this payment.',
                    accessToken,
                    candidateId: existingCandidate.batch_id,
                    registrationCode,
                    batchId: registrationCode,
                    user: sanitizeCandidateProfile(createdCandidate)
                });
            }

            return res.status(409).json({ error: 'Email already registered' });
        }

        const existingAuth = table('auth_credentials').findOne(
            (c) => String(c.email || '').toLowerCase() === email.toLowerCase()
        );

        if (existingAuth) {
            return res.status(409).json({ error: 'Email already registered in login credentials' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        validateProfilePhotoUpload(req.file, { required: true });
        const photoStorage = getPhotoStorage(req.file);
        const paymentDate = new Date();
        const paymentDetails = {
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature,
            amount: getEventRegistrationAmount(activeEventConfig),
            currency: getRazorpayConfig().currency,
            capturedAt: paymentDate.toISOString()
        };

        const sanitizedExpectations = Array.isArray(payload.expectations)
            ? payload.expectations
                .map((item) => String(item || '').trim())
                .filter((item) => item && item.toLowerCase() !== 'undefined')
            : [];

        const candidateRoleId = getRoleIdByName(ROLE_CANDIDATE);
        if (!candidateRoleId) {
            return res.status(500).json({ error: 'Candidate role is not configured.' });
        }

        if (!payload.educationCategory || !EDUCATION_CATEGORY_OPTIONS.includes(payload.educationCategory)) {
            return res.status(400).json({ error: 'Please select a valid education category.' });
        }

        const createdCandidate = await table('candidates').insert({
            event_id: eventId,
            email,
            first_name: payload.firstName,
            middle_name: payload.middleName,
            last_name: payload.lastName,
            gender: payload.gender,
            marriage_type: payload.marriageType,
            address_line: payload.address,
            pincode: payload.pincode,
            city_village: payload.city,
            tehsil: payload.tehsil,
            district: payload.district,
            state: payload.state,
            location_state_id: payload.stateId || null,
            location_district_id: payload.districtId || null,
            location_subdistrict_id: payload.subdistrictId || null,
            location_master_id: payload.locationId || null,
            mobile_number: payload.mobile,
            whatsapp_number: payload.whatsapp,
            height: payload.height,
            education_qualification: payload.education,
            education_details: payload.educationDetails,
            education_category: payload.educationCategory,
            job_business_title: payload.job,
            annual_income: payload.income,
            job_business_location: payload.jobLocation,
            mamekul: payload.mamekul,
            birth_date: payload.birthDate,
            birth_time: payload.birthTime,
            birth_place: payload.birthPlace,
            complexion: payload.complexion,
            blood_group: payload.bloodGroup,
            gotra: payload.gotra,
            zodiac: payload.zodiac,
            gan: payload.gan,
            nadi: payload.nadi,
            charan: payload.charan,
            nakshatra: payload.nakshatra,
            selected_expectations: sanitizedExpectations.length ? sanitizedExpectations : null,
            other_expectations: payload.customExpectation || null,
            photo_path: null,
            ...photoStorage,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
            payment_status: 'captured',
            payment_details: paymentDetails,
            payment_date: paymentDate,
            attended_active_event: payload.attendedActiveEvent || null,
            will_attend_event: payload.willAttendEvent || null,
            attendee_count: payload.attendeeCount || null,
            is_active: true,
            registration_date: paymentDate,
            updated_at: paymentDate
        });
        insertedCandidateId = createdCandidate.batch_id;
        await table('candidates').updateById(insertedCandidateId, {
            photo_path: candidatePhotoPath(insertedCandidateId)
        });
        const savedCandidate = table('candidates').findById(insertedCandidateId) || createdCandidate;
        await ensureCandidateEventMembership(savedCandidate, activeEvents[0], paymentDate);
        const eventRegistrationCode = getCandidateEventRegistrationCode(insertedCandidateId, eventId) || null;

        // No real transactions with Sheets: if the auth-credentials insert
        // below fails, undo the candidate insert so we don't leave an
        // orphaned/unusable registration behind.
        try {
            await table('auth_credentials').insert({
                user_id: createdCandidate.batch_id,
                email,
                password: hashedPassword,
                role_id: candidateRoleId,
                is_active: true
            });
        } catch (credError) {
            await table('candidates').removeById(createdCandidate.batch_id).catch(() => {});
            throw credError;
        }

        const emailDelivery = await sendRegistrationSuccessEmail({
            to: email,
            fullName: [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(' '),
            userId: email,
            password,
            batchId: eventRegistrationCode,
            eventName: activeEventName,
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            paymentDate: paymentDate.toLocaleString('en-GB')
        });

        if (emailDelivery.sent) {
            console.log(`Registration email sent to ${email} for batch ${eventRegistrationCode}`);
        } else {
            console.warn(`Registration email not sent to ${email} for batch ${eventRegistrationCode}: ${emailDelivery.message}`);
        }

        const accessToken = jwt.sign({ id: createdCandidate.batch_id, email, role: ROLE_CANDIDATE }, getJwtSecret(), { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: createdCandidate.batch_id, email, role: ROLE_CANDIDATE }, getRefreshSecret(), { expiresIn: '7d' });

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
        res.status(201).json({ message: 'Registered successfully!', accessToken, candidateId: createdCandidate.batch_id, registrationCode: eventRegistrationCode, batchId: eventRegistrationCode, user: sanitizeCandidateProfile(savedCandidate), email: emailDelivery });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration could not be saved.', details: getRegistrationFailureMessage(error) });
    }
});

app.post('/api/payment/order', paymentRateLimiter, async (req, res) => {
    try {
        const intentId = Number(req.body?.intentId || req.body?.registration_intent_id || 0);
        if (!intentId) {
            return res.status(400).json({ error: 'Registration details must be saved before payment can begin.' });
        }
        if (!hasValidRegistrationIntentCookie(req.cookies?.registrationIntent, intentId)) {
            return res.status(403).json({ error: 'Registration session could not be verified. Please submit the form again.' });
        }

        const order = await createPaymentOrderForIntent({
            intentId,
            purpose: req.body?.purpose
        });

        return res.json(order);
    } catch (error) {
        console.error('Create payment order error:', error);
        return res.status(error.status || 500).json({
            error: error.publicMessage || 'Payment order could not be created.',
            code: error.code || null,
            details: error.status ? null : 'Your registration details are saved. Please try payment again; do not submit a second registration.'
        });
    }
});

app.post('/api/payment/order-legacy', paymentRateLimiter, (_req, res) => res.status(410).json({
    error: 'This legacy payment endpoint is no longer available. Start payment from the current registration flow.'
}));

app.post('/api/payment/webhook', async (req, res) => {
    const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
        return res.status(503).json({ error: 'Razorpay webhook is not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!verifyRazorpayWebhookSignature({ rawBody: req.rawBody, signature, webhookSecret })) {
        return res.status(401).json({ error: 'Invalid Razorpay webhook signature.' });
    }

    try {
        if (req.body?.event !== 'payment.captured') {
            return res.status(200).json({ received: true });
        }

        const payment = req.body?.payload?.payment?.entity;
        const orderId = String(payment?.order_id || '').trim();
        const paymentId = String(payment?.id || '').trim();
        if (!orderId || !paymentId) {
            return res.status(400).json({ error: 'Razorpay webhook did not include an order or payment ID.' });
        }

        const intent = findRegistrationIntentByOrder(orderId);
        if (!intent) {
            return res.status(200).json({ received: true, tracked: false });
        }

        const finalization = await finalizeRegistrationIntent({
            intentId: intent.intent_id,
            orderId,
            paymentId,
            signature: ''
        });

        if (finalization.status === 'completed' || finalization.status === 'conflict') {
            return res.status(200).json({ received: true, status: finalization.status });
        }

        return res.status(500).json({
            error: finalization.message || 'Registration finalization is pending; please retry this webhook.'
        });
    } catch (error) {
        console.error('Razorpay webhook error:', error);
        return res.status(500).json({ error: 'Webhook processing failed; please retry this webhook.' });
    }
});

app.get('/api/events/active-banner', async (_req, res) => {
    try {
        const events = table('events')
            .find((event) => event.is_active)
            .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

        if (events.length === 0) {
            return res.status(404).json({ error: 'No active event found' });
        }

        const event = events[0];
        let client = null;
        try {
            client = table('clients').findOne((item) => String(item.client_id) === String(event.client_id));
        } catch (_) {
            // Client lookup is optional for legacy event records.
        }
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
                venue: event.venue,
                eventTime: event.event_time || 'सकाळी ९:०० ते दु. ५:०० पर्यंत',
                organizerName: event.organizer_name,
                organizerPhone: event.organizer_phone,
                communityName: client?.client_name || '',
                officeAddress: event.office_address || client?.address || '',
                officePhone: event.organizer_phone || client?.phone_number || '',
                registrationOpen: isRegistrationOpen,
                organizerPhoto: event.organizer_photo,
                registrationBannerPath: event.registration_banner_path
            }
        });
    } catch (error) {
        console.error('Active banner fetch error:', error);
        return res.status(500).json({ error: 'Failed to load active event banner' });
    }
});

app.post('/api/login', loginRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        const cred = table('auth_credentials').findOne(
            (c) => String(c.email || '').toLowerCase() === String(email || '').toLowerCase()
        );

        if (!cred || !cred.is_active) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const roleRow = cred.role_id ? table('roles').findById(cred.role_id) : null;
        const roleName = normalizeRoleName(roleRow?.role_name);
        if (!roleRow?.is_active || ![ROLE_SUPER_USER, ROLE_ADMIN, ROLE_CANDIDATE].includes(roleName)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, cred.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isAdmin = roleName === ROLE_SUPER_USER || roleName === ROLE_ADMIN;
        const isSuperUser = roleName === ROLE_SUPER_USER;

        let userProfile = {
            id: cred.user_id,
            email,
            isAdmin,
            isSuperUser,
            roleName,
            role_id: cred.role_id
        };

        if (isAdmin && cred.user_id) {
            const admin = table('admin_users').findById(cred.user_id);
            if (!admin || admin.is_active === false) {
                return res.status(401).json({ error: 'Account is inactive' });
            }
            if (admin) {
                const client = admin.client_id
                    ? table('clients').findById(admin.client_id)
                    : null;
                userProfile = {
                    ...userProfile,
                    ...admin,
                    client_name: client?.client_name || ''
                };
            }
        } else if (cred.user_id) {
            const candidate = table('candidates').findById(cred.user_id);
            if (!candidate || candidate.is_active === false) {
                return res.status(401).json({ error: 'Account is inactive' });
            }
            userProfile = { ...userProfile, ...sanitizeCandidateProfile(candidate) };
        }

        userProfile.email = userProfile.email || cred.email;
        if (userProfile.photo_url && !userProfile.photo_path) userProfile.photo_path = userProfile.photo_url;

        const accessToken = jwt.sign({ id: cred.user_id, email: cred.email, role: roleName }, getJwtSecret(), { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: cred.user_id, email: cred.email, role: roleName }, getRefreshSecret(), { expiresIn: '7d' });

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
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

        const payload = normalizeCandidatePayload(req.body || {});
        let photoStorage = null;
        if (req.file) {
            validateProfilePhotoUpload(req.file);
            photoStorage = getPhotoStorage(req.file);
        }

        const patch = {
            gender: payload.gender,
            marriage_type: payload.marriageType,
            address_line: payload.address,
            pincode: payload.pincode,
            city_village: payload.city,
            tehsil: payload.tehsil,
            district: payload.district,
            state: payload.state,
            mobile_number: payload.mobile,
            whatsapp_number: payload.whatsapp,
            height: payload.height,
            education_qualification: payload.education,
            education_details: payload.educationDetails,
            education_category: payload.educationCategory,
            job_business_title: payload.job,
            annual_income: payload.income,
            job_business_location: payload.jobLocation,
            mamekul: payload.mamekul,
            birth_time: payload.birthTime,
            birth_place: payload.birthPlace,
            complexion: payload.complexion,
            blood_group: payload.bloodGroup,
            gotra: payload.gotra,
            zodiac: payload.zodiac,
            gan: payload.gan,
            nadi: payload.nadi,
            charan: payload.charan,
            nakshatra: payload.nakshatra,
            selected_expectations: payload.expectations.length ? payload.expectations : null,
            other_expectations: payload.customExpectation || null,
            attended_active_event: payload.attendedActiveEvent || null,
            will_attend_event: payload.willAttendEvent || null,
            attendee_count: payload.attendeeCount || null,
            location_state_id: payload.stateId || null,
            location_district_id: payload.districtId || null,
            location_subdistrict_id: payload.subdistrictId || null,
            location_master_id: payload.locationId || null,
            updated_at: new Date()
        };
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')) {
            patch.is_active = req.body.is_active === true || req.body.is_active === 'true';
        }
        if (photoStorage) {
            Object.assign(patch, photoStorage, { photo_path: candidatePhotoPath(id) });
        }

        const updated = await table('candidates').updateById(id, patch);
        if (!updated) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        res.json({ message: 'Profile updated successfully!', user: sanitizeCandidateProfile(updated) });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Refresh access token using httpOnly refresh cookie
app.post('/auth/refresh', refreshRateLimiter, async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    try {
        const payload = jwt.verify(token, getRefreshSecret());
        const cred = table('auth_credentials').findOne((item) => String(item.user_id) === String(payload.id || ''));
        const roleRow = cred?.role_id ? table('roles').findById(cred.role_id) : null;
        const roleName = normalizeRoleName(roleRow?.role_name);
        if (!cred?.is_active || !roleRow?.is_active || ![ROLE_SUPER_USER, ROLE_ADMIN, ROLE_CANDIDATE].includes(roleName)) {
            return res.status(401).json({ error: 'Account is inactive or unavailable' });
        }
        if (roleName === ROLE_CANDIDATE) {
            const candidate = table('candidates').findById(payload.id);
            if (!candidate || candidate.is_active === false) return res.status(401).json({ error: 'Candidate account is inactive' });
        }
        if (roleName === ROLE_ADMIN || roleName === ROLE_SUPER_USER) {
            const admin = table('admin_users').findById(payload.id);
            if (!admin || admin.is_active === false) return res.status(401).json({ error: 'Admin account is inactive' });
        }

        const accessToken = jwt.sign({ id: payload.id, email: cred.email, role: roleName }, getJwtSecret(), { expiresIn: '15m' });
        const newRefresh = jwt.sign({ id: payload.id, email: cred.email, role: roleName }, getRefreshSecret(), { expiresIn: '7d' });
        res.cookie('refreshToken', newRefresh, getRefreshCookieOptions());
        res.json({ accessToken });
    } catch (e) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Logout: clear refresh cookie
app.post('/auth/logout', (req, res) => {
    res.clearCookie('refreshToken', getRefreshCookieOptions());
    res.json({ message: 'Logged out' });
});

app.get('/api/pincode/:pincode', async (req, res) => {
    const { pincode } = req.params;
    if (!/^[0-9]{6}$/.test(pincode)) {
        return res.status(400).json({ error: 'Invalid pincode' });
    }

    try {
        const matches = table('location_master').find((lm) => normalizePincodeValue(lm.pincode) === pincode && isActiveFlag(lm.is_active));

        if (matches.length === 0) {
            return res.status(404).json({ error: 'Pincode not found' });
        }

        const locations = matches
            .map((lm) => {
                const state = table('state_master').findById(lm.state_id);
                const district = table('district_master').findById(lm.district_id);
                const subdistrict = table('subdistrict_master').findById(lm.subdistrict_id);
                return {
                    locationId: lm.location_id,
                    pincode: lm.pincode,
                    stateId: state?.state_id,
                    state: state?.state_name || '',
                    districtId: district?.district_id,
                    district: district?.district_name || '',
                    subdistrictId: subdistrict?.subdistrict_id,
                    city: lm.city,
                    tehsil: subdistrict?.subdistrict_name || '',
                    postOffice: lm.post_office,
                    villageNameLocal: lm.village_name_local || '',
                    displayCity: lm.village_name_local || lm.post_office || lm.city,
                    displayLabel: [lm.post_office, lm.village_name_local || lm.city, subdistrict?.subdistrict_name].filter(Boolean).join(' - ')
                };
            })
            .sort((a, b) => (a.city || '').localeCompare(b.city || '') || (a.postOffice || '').localeCompare(b.postOffice || ''));

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
    }
});

app.get('/api/master/education', async (_req, res) => {
    try {
        const rows = table('education_master')
            .find((e) => e.is_active)
            .sort((a, b) => a.qualification.localeCompare(b.qualification) || (a.sort_order - b.sort_order) || a.education_detail.localeCompare(b.education_detail));

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
    }
});

app.get('/api/master/expectations', async (_req, res) => {
    try {
        const rows = table('expectation_master')
            .find((e) => e.is_active)
            .sort((a, b) => a.expectation_name.localeCompare(b.expectation_name));

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
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        const gender = String(req.query.gender || '').trim();
        const marriageType = String(req.query.marriageType || '').trim();
        const district = String(req.query.district || '').trim().toLowerCase();
        const interaction = String(req.query.interaction || '').trim().toLowerCase();
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

        const adminClientId = getAdminClientId(req);
        const isCandidate = normalizeRoleName(req.role) === ROLE_CANDIDATE;
        const loggedInCandidate = isCandidate ? table('candidates').findById(req.userId) : null;
        const candidateEventIds = getCandidateActiveEventIds(loggedInCandidate);
        const candidateGender = loggedInCandidate?.gender === 'Bride' ? 'Groom' : loggedInCandidate?.gender === 'Groom' ? 'Bride' : null;
        if (isCandidate && candidateEventIds.length === 0) {
            return res.status(403).json({ error: 'Online Suchi access requires an active event subscription.' });
        }
        let rows = table('candidates').all().filter((c) => {
            if (c.is_active === false) return false;
            const sharesEvent = candidateEventIds.some((eventId) => getCandidateActiveEventIds(c).some((candidateEventId) => String(candidateEventId) === String(eventId)));
            if (isCandidate) {
                if (!sharesEvent || String(c.batch_id) === String(req.userId)) return false;
                if (candidateGender && c.gender !== candidateGender) return false;
                return true;
            }
            if (isSuperUserRequest(req)) return true;
            if (!adminClientId) return false;
            return candidateBelongsToClient(c, adminClientId);
        });

        if (gender === 'Bride' || gender === 'Groom') {
            rows = rows.filter((c) => c.gender === gender);
        }
        if (marriageType === 'First Marriage' || marriageType === 'Re Marriage') {
            rows = rows.filter((c) => c.marriage_type === marriageType);
        }
        if (district) {
            rows = rows.filter((c) => (c.district || '').toLowerCase().includes(district));
        }
        if (hasIncomeMin && !Number.isNaN(incomeMin) && incomeMin > 0) {
            rows = rows.filter((c) => (Number.parseInt(c.annual_income, 10) || 0) >= incomeMin);
        }
        if (hasIncomeMax && !Number.isNaN(incomeMax) && incomeMax > 0) {
            rows = rows.filter((c) => (Number.parseInt(c.annual_income, 10) || 0) <= incomeMax);
        }
        if (hasAgeMin && !Number.isNaN(ageMin) && ageMin >= 18) {
            rows = rows.filter((c) => c.birth_date && calcAge(c.birth_date) >= ageMin);
        }
        if (hasAgeMax && !Number.isNaN(ageMax) && ageMax >= 18) {
            rows = rows.filter((c) => c.birth_date && calcAge(c.birth_date) <= ageMax);
        }
        if (q) {
            rows = rows.filter((c) => {
                const haystacks = [
                    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' '),
                    String(c.batch_id || ''),
                    c.mobile_number,
                    c.whatsapp_number,
                    c.education_qualification,
                    c.job_business_title,
                    c.job_business_location,
                    c.city_village,
                    c.district,
                    c.state,
                    c.address_line
                ];
                return haystacks.some((value) => String(value || '').toLowerCase().includes(q));
            });
        }

        if (isCandidate && interaction === 'shortlisted') {
            rows = rows.filter((c) => getCandidateInteractionState(req.userId, c.batch_id).isShortlisted);
        }
        if (isCandidate && interaction === 'mutual') {
            rows = rows.filter((c) => getCandidateInteractionState(req.userId, c.batch_id).isMutual);
        }

        const total = rows.length;
        rows = rows.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0) || Number(b.batch_id) - Number(a.batch_id));
        const visibleEventIds = isCandidate
            ? candidateEventIds
            : isSuperUserRequest(req)
                ? null
                : table('events').all()
                    .filter((event) => String(event.client_id) === String(adminClientId))
                    .map((event) => event.event_id);
        const paged = rows.slice(offset, offset + limit).map((c) => {
            const interactionState = isCandidate
                ? getCandidateInteractionState(req.userId, c.batch_id)
                : { isShortlisted: false, hasShortlistedYou: false, isMutual: false, isLiked: false, hasLikedYou: false };
            return serializeOnlineSuchiProfile(c, interactionState, isCandidate, visibleEventIds);
        });

        res.json({ profiles: paged, page, limit, total });
    } catch (error) {
        console.error('Online Suchi search error:', error);
        res.status(500).json({ error: 'Failed to search profiles' });
    }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

app.get('/api/admin/users', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const requestedClientId = scopedClientId(req, req.query.clientId);
        const visibleEventIds = requestedClientId
            ? table('events').all()
                .filter((event) => String(event.client_id) === String(requestedClientId))
                .map((event) => event.event_id)
            : null;
        const users = table('candidates').all()
            .filter((candidate) => isSuperUserRequest(req)
                ? (!requestedClientId || candidateBelongsToClient(candidate, requestedClientId))
                : (!!requestedClientId && candidateBelongsToClient(candidate, requestedClientId)))
            .sort((a, b) => Number(b.batch_id) - Number(a.batch_id))
            .map((c) => ({
                id: c.batch_id,
                first_name: c.first_name,
                middle_name: c.middle_name,
                last_name: c.last_name,
                mobile: c.mobile_number,
                whatsapp: c.whatsapp_number,
                email: c.email,
                gender: c.gender,
                marriage_type: c.marriage_type,
                city: c.city_village,
                district: c.district,
                state: c.state,
                education: c.education_qualification,
                job: c.job_business_title,
                payment_status: c.payment_status,
                registration_date: c.registration_date,
                registered_events: getRegisteredEventSummaries(c, visibleEventIds),
                is_active: c.is_active
            }));
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:userId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        const candidate = table('candidates').findById(userId);
        if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || !candidateBelongsToClient(candidate, adminClientId))) {
            return res.status(403).json({ error: 'This candidate belongs to another client.' });
        }
        const { first_name, middle_name, last_name, mobile_number, whatsapp_number, email, gender, marriage_type } = req.body;
        const patch = {
            first_name: String(first_name || '').trim(), middle_name: String(middle_name || '').trim(),
            last_name: String(last_name || '').trim(), mobile_number: String(mobile_number || '').trim(),
            whatsapp_number: String(whatsapp_number || '').trim(), email: String(email || '').trim(),
            gender: String(gender || '').trim(), marriage_type: String(marriage_type || '').trim(), updated_at: new Date()
        };
        await table('candidates').updateById(userId, patch);
        await logActivity(req.userId, 'UPDATE_CANDIDATE', 'candidates', userId, candidate, patch);
        res.json({ message: 'Candidate profile updated successfully.' });
    } catch (error) {
        console.error('Error updating candidate:', error);
        res.status(500).json({ error: 'Failed to update candidate profile' });
    }
});

app.get('/api/admin/my-clients', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const clientId = getAdminClientId(req);
        if (!clientId) return res.json({ clients: [] });
        const clients = await db.query(
            `SELECT client_id, client_name, address, phone_number, contact_email, public_slug,
                    homepage_enabled, homepage_title, homepage_intro, homepage_content,
                    registration_form_config, is_active
             FROM clients WHERE client_id = ? AND is_active = TRUE`,
            [clientId]
        );
        const domains = await db.query(
            `SELECT domain_id, client_id, hostname, is_primary, is_active
             FROM client_domains WHERE client_id = ? AND is_active = TRUE
             ORDER BY is_primary DESC, domain_id ASC`,
            [clientId]
        );
        clients.forEach((client) => {
            client.domains = domains;
            client.custom_domain = domains[0]?.hostname || '';
        });
        return res.json({ clients });
    } catch (error) {
        console.error('Error fetching admin client scope:', error);
        return res.status(500).json({ error: 'Failed to fetch client scope' });
    }
});

app.get('/api/admin/admins', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const requestedClientId = scopedClientId(req, req.query.clientId);
        const mappings = await db.query('SELECT admin_id, client_id FROM client_admin_mapping WHERE is_active = TRUE');
        const clientByAdminId = new Map(mappings.map((mapping) => [String(mapping.admin_id), mapping.client_id]));
        const admins = table('admin_users').all()
            .filter((admin) => !requestedClientId || admin.is_super_user || String(clientByAdminId.get(String(admin.admin_id))) === String(requestedClientId))
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .map((admin) => {
                const cred = table('auth_credentials').findOne((c) => String(c.user_id) === String(admin.admin_id));
                return {
                    id: admin.admin_id,
                    first_name: admin.name,
                    last_name: '',
                    phone_number: admin.phone_number,
                    whatsapp_number: admin.whatsapp_number,
                    photo_url: admin.photo_url,
                    address: admin.address,
                    birthdate: admin.birthdate,
                    is_super_user: admin.is_super_user,
                    is_active: admin.is_active,
                    email: cred?.email || '',
                    role_name: admin.is_super_user ? ROLE_SUPER_USER : ROLE_ADMIN,
                    created_at: admin.created_at
                };
            });
        res.json({ admins });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

app.get('/api/admin/sftp', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (_req, res) => {
    try {
        const rows = await db.query(`SELECT config_id, host, port, username, remote_path, auth_method, is_enabled,
                                            encrypted_password, encrypted_private_key FROM sftp_config WHERE config_id = 1`);
        const config = rows[0];
        if (!config) return res.json({ success: true, configured: false, config: null });
        return res.json({ success: true, configured: true, config: {
            config_id: config.config_id, host: config.host, port: config.port, username: config.username,
            remote_path: config.remote_path, auth_method: config.auth_method, is_enabled: !!config.is_enabled,
            password_configured: !!config.encrypted_password, private_key_configured: !!config.encrypted_private_key
        }});
    } catch (error) {
        console.error('SFTP settings fetch failed:', error);
        return res.status(500).json({ error: 'Unable to load SFTP settings.' });
    }
});

app.put('/api/admin/sftp', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    const { host, port, username, password, private_key: privateKey, remote_path: remotePath, auth_method: authMethod, is_enabled: isEnabled } = req.body || {};
    if (!host || !username || !['password', 'private_key'].includes(authMethod)) {
        return res.status(400).json({ error: 'Host, username, and a valid authentication method are required.' });
    }
    try {
        const existingRows = await db.query('SELECT encrypted_password, encrypted_private_key FROM sftp_config WHERE config_id = 1');
        const existing = existingRows[0] || {};
        await db.query(`INSERT INTO sftp_config
            (config_id, host, port, username, encrypted_password, encrypted_private_key, remote_path, auth_method, is_enabled, updated_by)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE host = VALUES(host), port = VALUES(port), username = VALUES(username),
                encrypted_password = VALUES(encrypted_password), encrypted_private_key = VALUES(encrypted_private_key),
                remote_path = VALUES(remote_path), auth_method = VALUES(auth_method), is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)`,
        [host, Number(port) || 22, username, password ? encryptSftpSecret(password) : existing.encrypted_password || null,
            privateKey ? encryptSftpSecret(privateKey) : existing.encrypted_private_key || null,
            remotePath || '/', authMethod, !!isEnabled, req.userId]);
        return res.json({ success: true, message: 'SFTP settings saved.' });
    } catch (error) {
        console.error('SFTP settings save failed:', error);
        return res.status(500).json({ error: 'Unable to save SFTP settings.' });
    }
});

app.post('/api/admin/sftp/test', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    const { host, port, username, password, private_key: privateKey, auth_method: authMethod } = req.body || {};
    const client = new SftpClient();
    try {
        if (!host || !username || !['password', 'private_key'].includes(authMethod)) {
            return res.status(400).json({ error: 'Host, username, and a valid authentication method are required.' });
        }
        await client.connect({ host, port: Number(port) || 22, username, ...(authMethod === 'private_key' ? { privateKey } : { password }) });
        return res.json({ success: true, message: 'SFTP connection succeeded.' });
    } catch (error) {
        console.error('SFTP connection test failed:', error);
        return res.status(400).json({ success: false, error: 'SFTP connection failed. Verify the supplied settings.' });
    } finally {
        await client.end().catch(() => {});
    }
});

app.get('/api/admin/payment-gateway', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const targetClientId = scopedClientId(req, req.query.clientId);
        if (!targetClientId) return res.json({ success: true, configured: false, config: null });
        if (!matchesAdminClientScope(req, targetClientId)) return res.status(403).json({ error: 'This payment gateway belongs to another client.' });

        const gateways = getClientPaymentGateways(targetClientId);
        return res.json({
            success: true,
            configured: gateways.length > 0,
            config: gateways.length === 1 ? toPaymentGatewayResponse(gateways[0], targetClientId) : null,
            gateways: gateways.map((gateway) => toPaymentGatewayResponse(gateway, targetClientId))
        });
    } catch (error) {
        console.error('Payment gateway settings fetch failed:', error);
        return res.status(500).json({ error: 'Unable to load payment gateway settings.' });
    }
});

app.put('/api/admin/payment-gateway', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    const { config_id: requestedConfigId, client_id: requestedClientId, gateway_name: gatewayName, provider, key_id: keyId, key_secret: keySecret, is_enabled: isEnabled } = req.body || {};
    const targetClientId = scopedClientId(req, requestedClientId);
    if (!targetClientId) return res.status(400).json({ error: 'Select a client before saving payment gateway settings.' });
    if (!matchesAdminClientScope(req, targetClientId)) return res.status(403).json({ error: 'This payment gateway belongs to another client.' });
    if (!table('clients').findById(targetClientId)) return res.status(404).json({ error: 'Client not found.' });
    if (provider && String(provider).toLowerCase() !== 'razorpay') return res.status(400).json({ error: 'Only Razorpay is supported.' });

    const requestedConfig = requestedConfigId ? table('client_payment_gateway').findById(requestedConfigId) : null;
    if (requestedConfigId && !requestedConfig) return res.status(404).json({ error: 'Payment gateway not found.' });
    if (requestedConfig && String(requestedConfig.client_id) !== String(targetClientId)) {
        return res.status(403).json({ error: 'This payment gateway belongs to another client.' });
    }

    const existing = requestedConfig;
    const nextKeyId = keyId === undefined ? existing?.key_id || null : String(keyId || '').trim() || null;
    const nextKeySecret = keySecret ? String(keySecret).trim() : existing?.key_secret || null;
    const nextGatewayName = String(gatewayName || existing?.gateway_name || `Gateway ${existing?.config_id || 'new'}`).trim();
    const enabled = isEnabled === true || isEnabled === 'true';
    if (enabled && (!nextKeyId || !nextKeySecret)) {
        return res.status(400).json({ error: 'Add both the Razorpay Key ID and Key Secret before enabling the gateway.' });
    }

    try {
        const payload = {
            client_id: targetClientId,
            gateway_name: nextGatewayName,
            provider: 'razorpay',
            key_id: nextKeyId,
            key_secret: nextKeySecret ? encryptSftpSecret(nextKeySecret) : null,
            is_enabled: enabled,
            updated_by: req.userId,
            updated_at: new Date()
        };
        let saved;
        if (existing) {
            saved = await table('client_payment_gateway').updateById(existing.config_id, payload);
            const { key_secret: _existingKeySecret, ...safeExisting } = existing;
            await logActivity(req.userId, 'UPDATE', 'client_payment_gateway', existing.config_id, safeExisting, {
                client_id: targetClientId,
                provider: 'razorpay',
                key_id: nextKeyId,
                is_enabled: enabled
            });
        } else {
            saved = await table('client_payment_gateway').insert({
                ...payload,
                created_by: req.userId,
                created_at: new Date()
            });
            await logActivity(req.userId, 'CREATE', 'client_payment_gateway', saved.config_id, null, {
                client_id: targetClientId,
                provider: 'razorpay',
                key_id: nextKeyId,
                is_enabled: enabled
            });
        }
        const gateways = getClientPaymentGateways(targetClientId);
        return res.json({
            success: true,
            message: 'Payment gateway settings saved.',
            config: toPaymentGatewayResponse(saved, targetClientId),
            gateways: gateways.map((gateway) => toPaymentGatewayResponse(gateway, targetClientId))
        });
    } catch (error) {
        console.error('Payment gateway settings save failed:', error);
        return res.status(500).json({ error: 'Unable to save payment gateway settings.' });
    }
});

app.delete('/api/admin/payment-gateway/:configId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const gateway = table('client_payment_gateway').findById(req.params.configId);
        if (!gateway) return res.status(404).json({ error: 'Payment gateway not found.' });
        if (!matchesAdminClientScope(req, gateway.client_id)) return res.status(403).json({ error: 'This payment gateway belongs to another client.' });

        const assignedEvents = table('events').find((event) => String(event.payment_gateway_id) === String(gateway.config_id));
        if (assignedEvents.length > 0) {
            return res.status(409).json({ error: 'This gateway is assigned to an event. Assign another gateway before deleting it.' });
        }

        await table('client_payment_gateway').removeById(gateway.config_id);
        await logActivity(req.userId, 'DELETE', 'client_payment_gateway', gateway.config_id, {
            client_id: gateway.client_id,
            gateway_name: gateway.gateway_name,
            key_id: gateway.key_id,
            is_enabled: gateway.is_enabled
        }, null);
        return res.json({ success: true, message: 'Payment gateway deleted.' });
    } catch (error) {
        console.error('Payment gateway delete failed:', error);
        return res.status(500).json({ error: 'Unable to delete payment gateway.' });
    }
});

const isAdminDomainHostname = (hostname) => hostname.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname);

app.get('/api/admin/client-domains', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const targetClientId = scopedClientId(req, req.query.clientId);
        if (!targetClientId) return res.json({ success: true, domains: [] });
        if (!matchesAdminClientScope(req, targetClientId)) return res.status(403).json({ error: 'These domains belong to another client.' });
        return res.json({
            success: true,
            domains: table('client_domains')
                .find((domain) => String(domain.client_id) === String(targetClientId))
                .sort((first, second) => Number(second.is_primary) - Number(first.is_primary) || Number(first.domain_id) - Number(second.domain_id))
        });
    } catch (error) {
        console.error('Client domain list failed:', error);
        return res.status(500).json({ error: 'Unable to load client domains.' });
    }
});

app.post('/api/admin/client-domains', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { client_id: requestedClientId, hostname: requestedHostname, is_primary: requestedPrimary } = req.body || {};
        const targetClientId = scopedClientId(req, requestedClientId);
        const hostname = normalizePublicHostname(requestedHostname);
        if (!targetClientId) return res.status(400).json({ error: 'Select a client before adding a domain.' });
        if (!matchesAdminClientScope(req, targetClientId)) return res.status(403).json({ error: 'This domain belongs to another client.' });
        if (!table('clients').findById(targetClientId)) return res.status(404).json({ error: 'Client not found.' });
        if (!isAdminDomainHostname(hostname)) return res.status(400).json({ error: 'Enter a valid domain such as community.example.com.' });

        const duplicate = table('client_domains').findOne((domain) => normalizePublicHostname(domain.hostname) === hostname);
        if (duplicate && String(duplicate.client_id) !== String(targetClientId)) {
            return res.status(409).json({ error: 'This domain is already assigned to another client.' });
        }
        if (duplicate) return res.status(409).json({ error: 'This domain is already configured for this client.' });

        const existingDomains = table('client_domains').find((domain) => String(domain.client_id) === String(targetClientId));
        const isPrimary = requestedPrimary === true || requestedPrimary === 'true' || existingDomains.length === 0;
        if (isPrimary) {
            await Promise.all(existingDomains.filter((domain) => domain.is_primary).map((domain) => table('client_domains').updateById(domain.domain_id, { is_primary: false })));
        }

        const created = await table('client_domains').insert({
            client_id: targetClientId,
            hostname,
            is_primary: isPrimary,
            is_active: true,
            created_by: req.userId,
            created_at: new Date(),
            updated_at: new Date()
        });
        return res.status(201).json({ success: true, domain: created, message: 'Client domain added.' });
    } catch (error) {
        console.error('Client domain create failed:', error);
        return res.status(500).json({ error: 'Unable to add client domain.' });
    }
});

app.delete('/api/admin/client-domains/:domainId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const domain = table('client_domains').findById(req.params.domainId);
        if (!domain) return res.status(404).json({ error: 'Client domain not found.' });
        if (!matchesAdminClientScope(req, domain.client_id)) return res.status(403).json({ error: 'This domain belongs to another client.' });
        await table('client_domains').removeById(domain.domain_id);
        if (domain.is_primary) {
            const replacement = table('client_domains')
                .find((item) => String(item.client_id) === String(domain.client_id))
                .sort((first, second) => Number(first.domain_id) - Number(second.domain_id))[0];
            if (replacement) await table('client_domains').updateById(replacement.domain_id, { is_primary: true });
        }
        return res.json({ success: true, message: 'Client domain removed.' });
    } catch (error) {
        console.error('Client domain delete failed:', error);
        return res.status(500).json({ error: 'Unable to remove client domain.' });
    }
});

const resolveEventPaymentGatewayId = (clientId, requestedGatewayId) => {
    if (requestedGatewayId === undefined || requestedGatewayId === null || String(requestedGatewayId).trim() === '') {
        return { gatewayId: null };
    }

    const gateway = table('client_payment_gateway').findById(requestedGatewayId);
    if (!gateway) return { error: 'Selected payment gateway was not found.' };
    if (String(gateway.client_id) !== String(clientId)) {
        return { error: 'Selected payment gateway belongs to another client.' };
    }
    return { gatewayId: gateway.config_id };
};

app.post('/api/admin/events', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.fields([{ name: 'organizer_photo', maxCount: 1 }, { name: 'registration_banner', maxCount: 1 }]), async (req, res) => {
    try {
        const { client_id, event_name, venue, office_address, event_time, start_date, end_date, registration_cutoff_date, organizer_name, organizer_phone, organizer_whatsapp, razorpay_registration_amount, payment_gateway_id: requestedGatewayId } = req.body;

        const targetClientId = scopedClientId(req, client_id);
        if (!targetClientId) return res.status(400).json({ error: 'Select a client before creating an event.' });
        if (!isSuperUserRequest(req)) {
            const activePlan = getActiveClientPlan(targetClientId);
            const maxActiveEvents = Number(activePlan?.plan?.max_active_events || 0);
            const activeEventCount = table('events').all().filter((event) =>
                String(event.client_id) === String(targetClientId) && isActiveFlag(event.is_active)
            ).length;
            if (maxActiveEvents > 0 && activeEventCount >= maxActiveEvents) {
                return res.status(403).json({ error: `Your client plan allows a maximum of ${maxActiveEvents} active event${maxActiveEvents === 1 ? '' : 's'}.` });
            }
        }
        const gatewaySelection = resolveEventPaymentGatewayId(targetClientId, requestedGatewayId);
        if (gatewaySelection.error) return res.status(400).json({ error: gatewaySelection.error });
        const amountValue = String(razorpay_registration_amount ?? '').trim();
        const registrationAmount = amountValue === '' ? 0 : Number(amountValue);
        if (!Number.isFinite(registrationAmount) || registrationAmount < 0) {
            return res.status(400).json({ error: 'Registration fee must be zero or a valid positive amount.' });
        }
        if (registrationAmount > 0 && getClientPaymentGateways(targetClientId).length > 1 && !gatewaySelection.gatewayId) {
            return res.status(400).json({ error: 'Select one payment gateway for this paid event.' });
        }
        const created = await table('events').insert({
            client_id: targetClientId, event_name, venue, office_address, event_time, start_date, end_date, registration_cutoff_date,
            organizer_name, organizer_phone, organizer_whatsapp,
            payment_gateway_id: gatewaySelection.gatewayId,
            razorpay_registration_amount: registrationAmount,
            is_active: true,
            created_by: req.userId,
            created_at: new Date(),
            updated_at: new Date()
        });

        const organizerPhoto = req.files?.organizer_photo?.[0];
        const registrationBanner = req.files?.registration_banner?.[0];
        if (organizerPhoto) validateProfilePhotoUpload(organizerPhoto);
        if (registrationBanner) validateProfilePhotoUpload(registrationBanner);
        await table('events').updateById(created.event_id, {
            organizer_photo: eventMediaPath(created.event_id, 'organizer'),
            registration_banner_path: eventMediaPath(created.event_id, 'banner'),
            ...(organizerPhoto ? {
                organizer_photo_data: organizerPhoto.buffer,
                organizer_photo_mime_type: organizerPhoto.mimetype
            } : {}),
            ...(registrationBanner ? {
                registration_banner_data: registrationBanner.buffer,
                registration_banner_mime_type: registrationBanner.mimetype
            } : {})
        });

        await logActivity(req.userId, 'CREATE', 'events', created.event_id, null, { event_name, venue });
        res.status(201).json({ message: 'Event created successfully!' });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

app.get('/api/admin/events', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const targetClientId = scopedClientId(req, req.query.clientId);
        const events = table('events').all()
            .filter((event) => matchesAdminClientScope(req, targetClientId ? event.client_id : null)
                && (!isSuperUserRequest(req) || !targetClientId || String(event.client_id) === String(targetClientId)))
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .map(({ razorpay_key_id: _legacyKeyId, razorpay_key_secret: _legacyKeySecret,
                payment_gateway_secret: _gatewaySecret, organizer_photo_data: _organizerPhotoData,
                registration_banner_data: _registrationBannerData, ...event }) => ({
                ...event,
                payment_gateway_name: event.payment_gateway_id
                    ? table('client_payment_gateway').findById(event.payment_gateway_id)?.gateway_name || 'Assigned gateway'
                    : ''
            }));
        res.json({ events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.put('/api/admin/events/:eventId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.fields([{ name: 'organizer_photo', maxCount: 1 }, { name: 'registration_banner', maxCount: 1 }]), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { client_id, event_name, venue, office_address, event_time, start_date, end_date, registration_cutoff_date, organizer_name, organizer_phone, organizer_whatsapp, razorpay_registration_amount, payment_gateway_id: requestedGatewayId } = req.body;

        const existingEvent = table('events').findById(eventId);
        if (!existingEvent) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingEvent.client_id) !== String(adminClientId))) {
            return res.status(403).json({ error: 'This event belongs to another client.' });
        }

        const nextClientId = client_id || existingEvent.client_id || null;
        if (!nextClientId) return res.status(400).json({ error: 'Select a client before updating an event.' });
        const gatewaySelection = resolveEventPaymentGatewayId(nextClientId, requestedGatewayId);
        if (gatewaySelection.error) return res.status(400).json({ error: gatewaySelection.error });

        const organizerPhoto = req.files?.organizer_photo?.[0];
        const registrationBanner = req.files?.registration_banner?.[0];
        if (organizerPhoto) validateProfilePhotoUpload(organizerPhoto);
        if (registrationBanner) validateProfilePhotoUpload(registrationBanner);

        const amountValue = String(razorpay_registration_amount ?? '').trim();
        const nextAmount = amountValue === ''
            ? (existingEvent.razorpay_registration_amount === null || existingEvent.razorpay_registration_amount === undefined
                ? null
                : Number(existingEvent.razorpay_registration_amount))
            : Number(amountValue);
        if (nextAmount !== null && (!Number.isFinite(nextAmount) || nextAmount < 0)) {
            return res.status(400).json({ error: 'Registration fee must be zero or a valid positive amount.' });
        }
        if (nextAmount > 0 && getClientPaymentGateways(nextClientId).length > 1 && !gatewaySelection.gatewayId) {
            return res.status(400).json({ error: 'Select one payment gateway for this paid event.' });
        }

        const patch = {
            client_id: nextClientId, event_name, venue, office_address, event_time, start_date, end_date, registration_cutoff_date,
            organizer_name, organizer_phone, organizer_whatsapp,
            payment_gateway_id: gatewaySelection.gatewayId,
            razorpay_registration_amount: nextAmount,
            updated_at: new Date()
        };
        if (organizerPhoto) Object.assign(patch, {
            organizer_photo: eventMediaPath(eventId, 'organizer'),
            organizer_photo_data: organizerPhoto.buffer,
            organizer_photo_mime_type: organizerPhoto.mimetype
        });
        if (registrationBanner) Object.assign(patch, {
            registration_banner_path: eventMediaPath(eventId, 'banner'),
            registration_banner_data: registrationBanner.buffer,
            registration_banner_mime_type: registrationBanner.mimetype
        });

        await table('events').updateById(eventId, patch);
        await logActivity(req.userId, 'UPDATE', 'events', eventId, existingEvent, { event_name, venue });
        res.json({ message: 'Event updated successfully!' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

app.get('/api/admin/volunteer-groups', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const targetClientId = scopedClientId(req, req.query.clientId);
        const groups = table('volunteer_groups').all().filter((group) => matchesAdminClientScope(req, targetClientId ? group.client_id : null)
            && (!isSuperUserRequest(req) || !targetClientId || String(group.client_id) === String(targetClientId))).sort((a, b) => a.group_name.localeCompare(b.group_name));
        res.json({ groups });
    } catch (error) {
        console.error('Error fetching volunteer groups:', error);
        res.status(500).json({ error: 'Failed to fetch volunteer groups' });
    }
});

app.post('/api/admin/volunteer-groups', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { client_id, group_name, adhyaksha_name, khajindar_name, upadhyaksha_name, sachiv_name, upasachiv_name, is_active } = req.body;
        if (!String(group_name || '').trim()) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const duplicate = table('volunteer_groups').findOne(
            (g) => g.group_name.toLowerCase() === String(group_name).trim().toLowerCase()
        );
        if (duplicate) {
            return res.status(409).json({ error: 'Group name already exists' });
        }

        const created = await table('volunteer_groups').insert({
            client_id: scopedClientId(req, client_id),
            group_name: String(group_name).trim(),
            adhyaksha_name: String(adhyaksha_name || '').trim() || null,
            khajindar_name: String(khajindar_name || '').trim() || null,
            upadhyaksha_name: String(upadhyaksha_name || '').trim() || null,
            sachiv_name: String(sachiv_name || '').trim() || null,
            upasachiv_name: String(upasachiv_name || '').trim() || null,
            is_active: is_active !== false,
            update_user: req.userId || null,
            created_at: new Date(),
            updated_at: new Date()
        });
        await logActivity(req.userId, 'CREATE_VOLUNTEER_GROUP', 'volunteer_groups', created.group_id, null, { group_name });
        res.status(201).json({ message: 'Volunteer group created successfully!' });
    } catch (error) {
        console.error('Error creating volunteer group:', error);
        res.status(500).json({ error: 'Failed to create volunteer group' });
    }
});

app.put('/api/admin/volunteer-groups/:groupId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { groupId } = req.params;
        const { client_id, group_name, adhyaksha_name, khajindar_name, upadhyaksha_name, sachiv_name, upasachiv_name, is_active } = req.body;
        if (!String(group_name || '').trim()) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const duplicate = table('volunteer_groups').findOne(
            (g) => String(g.group_id) !== String(groupId) && g.group_name.toLowerCase() === String(group_name).trim().toLowerCase()
        );
        if (duplicate) {
            return res.status(409).json({ error: 'Group name already exists' });
        }

        const existingGroup = table('volunteer_groups').findById(groupId);
        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingGroup?.client_id) !== String(adminClientId))) return res.status(403).json({ error: 'This group belongs to another client.' });
        await table('volunteer_groups').updateById(groupId, {
            client_id: scopedClientId(req, client_id) || existingGroup?.client_id || null,
            group_name: String(group_name).trim(),
            adhyaksha_name: String(adhyaksha_name || '').trim() || null,
            khajindar_name: String(khajindar_name || '').trim() || null,
            upadhyaksha_name: String(upadhyaksha_name || '').trim() || null,
            sachiv_name: String(sachiv_name || '').trim() || null,
            upasachiv_name: String(upasachiv_name || '').trim() || null,
            is_active: is_active !== false,
            update_user: req.userId || null,
            updated_at: new Date()
        });
        await logActivity(req.userId, 'UPDATE_VOLUNTEER_GROUP', 'volunteer_groups', groupId, null, { group_name });
        res.json({ message: 'Volunteer group updated successfully!' });
    } catch (error) {
        console.error('Error updating volunteer group:', error);
        res.status(500).json({ error: 'Failed to update volunteer group' });
    }
});

app.delete('/api/admin/volunteer-groups/:groupId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const existingGroup = table('volunteer_groups').findById(req.params.groupId);
        const adminClientId = getAdminClientId(req);
        if (!existingGroup) return res.status(404).json({ error: 'Volunteer group not found' });
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingGroup.client_id) !== String(adminClientId))) return res.status(403).json({ error: 'This group belongs to another client.' });
        await table('volunteer_groups').removeById(req.params.groupId);
        await logActivity(req.userId, 'DELETE_VOLUNTEER_GROUP', 'volunteer_groups', req.params.groupId, existingGroup, null);
        res.json({ message: 'Volunteer group deleted successfully!' });
    } catch (error) {
        console.error('Error deleting volunteer group:', error);
        res.status(500).json({ error: 'Failed to delete volunteer group' });
    }
});

app.put('/api/admin/deactivate-user/:userId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        const candidate = table('candidates').findById(userId);
        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || !candidateBelongsToClient(candidate, adminClientId))) return res.status(403).json({ error: 'This candidate belongs to another client.' });
        await table('candidates').updateById(userId, { is_active: false });
        await logActivity(req.userId, 'DEACTIVATE_USER', 'candidates', userId, null, { reason });
        res.json({ message: 'User deactivated successfully!' });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

app.put('/api/admin/activate-user/:userId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        const candidate = table('candidates').findById(userId);
        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || !candidateBelongsToClient(candidate, adminClientId))) return res.status(403).json({ error: 'This candidate belongs to another client.' });
        await table('candidates').updateById(userId, { is_active: true });
        await logActivity(req.userId, 'ACTIVATE_USER', 'candidates', userId, null, {});
        res.json({ message: 'User activated successfully!' });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({ error: 'Failed to activate user' });
    }
});

app.post('/api/admin/create-admin', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    let createdAdminId = null;
    try {
        const { client_id, volunteer_id, name, email, password, phone_number, role_name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingCred = table('auth_credentials').findOne(
            (c) => String(c.email || '').toLowerCase() === String(email).toLowerCase()
        );
        if (existingCred) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        const normalizedRole = normalizeRoleName(role_name || ROLE_ADMIN);
        if (![ROLE_ADMIN, ROLE_SUPER_USER].includes(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const roleId = getRoleIdByName(normalizedRole);
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
            const volunteer = table('volunteers').findById(volunteer_id);
            if (!volunteer) {
                return res.status(404).json({ error: 'Selected volunteer not found' });
            }
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
            return res.status(400).json({ error: 'Select a volunteer or provide a valid admin name' });
        }

        const createdAdmin = await table('admin_users').insert({
            client_id: normalizedRole === ROLE_SUPER_USER ? null : (client_id || null),
            volunteer_id: volunteer_id || null,
            name: adminProfile.name,
            phone_number: adminProfile.phone_number,
            whatsapp_number: adminProfile.whatsapp_number,
            photo_url: adminProfile.photo_url,
            birthdate: adminProfile.birthdate,
            address: adminProfile.address,
            is_super_user: normalizedRole === ROLE_SUPER_USER,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        });
        createdAdminId = createdAdmin.admin_id;

        try {
            await table('auth_credentials').insert({
                email,
                password: passwordHash,
                user_id: createdAdmin.admin_id,
                role_id: roleId,
                is_active: true
            });
        } catch (credError) {
            await table('admin_users').removeById(createdAdmin.admin_id).catch(() => {});
            throw credError;
        }

        if (volunteer_id && normalizedRole !== ROLE_SUPER_USER && client_id) {
            await table('volunteers').updateById(volunteer_id, { client_id: Number(client_id) });
        }

        await logActivity(req.userId, 'CREATE_ADMIN', 'admin_users', createdAdmin.admin_id, null, { email, role_name: normalizedRole, volunteer_id: volunteer_id || null });
        res.status(201).json({
            success: true,
            message: 'Admin created successfully!',
            admin_id: createdAdmin.admin_id,
            email
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ error: 'Failed to create admin' });
    }
});

app.delete('/api/admin/deactivate-admin/:adminId', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    try {
        const { adminId } = req.params;
        if (String(req.userId) === String(adminId)) {
            return res.status(400).json({ error: 'You cannot deactivate your own super-user account.' });
        }
        await table('admin_users').updateById(adminId, { is_active: false });

        const cred = table('auth_credentials').findOne((c) => String(c.user_id) === String(adminId));
        if (cred) {
            await table('auth_credentials').updateById(cred.id, { is_active: false });
        }

        await logActivity(req.userId, 'DEACTIVATE_ADMIN', 'admin_users', adminId, null, {});
        res.json({ message: 'Admin deactivated successfully!' });
    } catch (error) {
        console.error('Error deactivating admin:', error);
        res.status(500).json({ error: 'Failed to deactivate admin' });
    }
});

app.put('/api/admin/activate-admin/:adminId', verifyToken, requireAnyRole(ROLE_SUPER_USER), async (req, res) => {
    try {
        const { adminId } = req.params;
        const admin = table('admin_users').findById(adminId);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });

        await table('admin_users').updateById(adminId, { is_active: true });
        const cred = table('auth_credentials').findOne((c) => String(c.user_id) === String(adminId));
        if (cred) await table('auth_credentials').updateById(cred.id, { is_active: true });

        await logActivity(req.userId, 'ACTIVATE_ADMIN', 'admin_users', adminId, null, {});
        res.json({ message: 'Admin activated successfully!' });
    } catch (error) {
        console.error('Error activating admin:', error);
        res.status(500).json({ error: 'Failed to activate admin' });
    }
});

app.put('/api/admin/events/:eventId/status', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { is_active } = req.body;
        const existingEvent = table('events').findById(eventId);
        const adminClientId = getAdminClientId(req);
        if (!existingEvent) return res.status(404).json({ error: 'Event not found' });
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingEvent.client_id) !== String(adminClientId))) return res.status(403).json({ error: 'This event belongs to another client.' });
        await table('events').updateById(eventId, { is_active: !!is_active });
        await logActivity(req.userId, 'EVENT_STATUS', 'events', eventId, null, { is_active: !!is_active });
        res.json({ message: 'Event status updated successfully!' });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({ error: 'Failed to update event status' });
    }
});

app.get('/api/admin/activity-logs', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const requestedClientId = isSuperUserRequest(req) ? req.query.clientId : getAdminClientId(req);
        if (isSuperUserRequest(req) && !requestedClientId) return res.json({ logs: [] });
        const logs = table('activity_logs').all()
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .map((log) => {
                const admin = log.admin_id ? table('admin_users').findById(log.admin_id) : null;
                return {
                    client_id: getActivityLogClientId(log),
                    id: log.log_id,
                    first_name: admin?.name || null,
                    last_name: admin?.name || null,
                    action: log.action,
                    table_name: log.table_name,
                    record_id: log.record_id,
                    created_at: log.created_at
                };
            })
            .filter((log) => String(log.client_id || '') === String(requestedClientId))
            .slice(0, 100);
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/admin/volunteers', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const targetClientId = scopedClientId(req, req.query.clientId);
        const includeUnassigned = normalizeRoleName(req.role) === ROLE_SUPER_USER && req.query.includeUnassigned === 'true';
        const volunteers = table('volunteers').all().filter((volunteer) => matchesAdminClientScope(req, targetClientId ? volunteer.client_id : null)
            && (!isSuperUserRequest(req) || !targetClientId || String(volunteer.client_id) === String(targetClientId) || (includeUnassigned && !volunteer.client_id)))
            .sort((a, b) => Number(b.volunteer_id) - Number(a.volunteer_id))
            .map((v) => {
                const group = v.group_id ? table('volunteer_groups').findById(v.group_id) : null;
                const { photo_data: _photoData, photo_mime_type: _photoMimeType, ...safeVolunteer } = v;
                return {
                    ...safeVolunteer,
                    photo_url: v.photo_data || v.photo_url ? volunteerPhotoAccessPath(v.volunteer_id) : null,
                    group_name: group?.group_name || null
                };
            });
        res.json({ volunteers });
    } catch (error) {
        console.error('Error fetching volunteers:', error);
        res.status(500).json({ error: 'Failed to fetch volunteers' });
    }
});

app.post('/api/admin/volunteers', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.single('photo'), async (req, res) => {
    try {
        const { client_id, volunteer_name, email, address, whatsapp_number, birthdate, main_profession, group_id } = req.body;
        if (!volunteer_name) {
            return res.status(400).json({ error: 'Volunteer name is required' });
        }

        if (req.file) validateProfilePhotoUpload(req.file);
        const created = await table('volunteers').insert({
            client_id: scopedClientId(req, client_id),
            volunteer_name,
            address: address || '',
            photo_url: null,
            photo_data: req.file?.buffer || null,
            photo_mime_type: req.file?.mimetype || null,
            email: email || '',
            whatsapp_number: whatsapp_number || '',
            birthdate: birthdate || null,
            main_profession: main_profession || '',
            group_id: group_id || null,
            is_active: true,
            update_user: req.userId || null,
            update_date: new Date()
        });
        if (req.file) {
            await table('volunteers').updateById(created.volunteer_id, {
                photo_url: volunteerPhotoPath(created.volunteer_id)
            });
        }
        await logActivity(req.userId, 'CREATE_VOLUNTEER', 'volunteers', created.volunteer_id, null, { volunteer_name });
        res.status(201).json({ message: 'Volunteer created successfully!' });
    } catch (error) {
        console.error('Error creating volunteer:', error);
        res.status(500).json({ error: 'Failed to create volunteer' });
    }
});

app.put('/api/admin/volunteers/:volunteerId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), upload.single('photo'), async (req, res) => {
    try {
        const { volunteerId } = req.params;
        const { client_id, volunteer_name, email, address, whatsapp_number, birthdate, main_profession, is_active, group_id } = req.body;
        const existingVolunteer = table('volunteers').findById(volunteerId);
        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingVolunteer?.client_id) !== String(adminClientId))) return res.status(403).json({ error: 'This volunteer belongs to another client.' });
        if (req.file) validateProfilePhotoUpload(req.file);

        const patch = {
            client_id: scopedClientId(req, client_id) || existingVolunteer?.client_id || null,
            volunteer_name: volunteer_name || '',
            email: email || '',
            address: address || '',
            whatsapp_number: whatsapp_number || '',
            birthdate: birthdate || null,
            main_profession: main_profession || '',
            group_id: group_id || null,
            is_active: !!is_active,
            update_user: req.userId || null,
            update_date: new Date()
        };
        if (req.file) Object.assign(patch, {
            photo_url: volunteerPhotoPath(volunteerId),
            photo_data: req.file.buffer,
            photo_mime_type: req.file.mimetype
        });

        await table('volunteers').updateById(volunteerId, patch);
        await logActivity(req.userId, 'UPDATE_VOLUNTEER', 'volunteers', volunteerId, null, { volunteer_name, is_active: !!is_active });
        res.json({ message: 'Volunteer updated successfully!' });
    } catch (error) {
        console.error('Error updating volunteer:', error);
        res.status(500).json({ error: 'Failed to update volunteer' });
    }
});

app.delete('/api/admin/volunteers/:volunteerId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const existingVolunteer = table('volunteers').findById(req.params.volunteerId);
        const adminClientId = getAdminClientId(req);
        if (!existingVolunteer) return res.status(404).json({ error: 'Volunteer not found' });
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingVolunteer.client_id) !== String(adminClientId))) return res.status(403).json({ error: 'This volunteer belongs to another client.' });
        const assignments = table('volunteer_team_assignments').find((assignment) => String(assignment.volunteer_id) === String(req.params.volunteerId));
        for (const assignment of assignments) await table('volunteer_team_assignments').removeById(assignment.assignment_id);

        const normalizedVolunteerName = String(existingVolunteer.volunteer_name || '').trim().toLowerCase();
        const normalizedVolunteerEmail = String(existingVolunteer.email || '').trim().toLowerCase();
        const volunteerPhones = [existingVolunteer.whatsapp_number, existingVolunteer.mobile_number, existingVolunteer.mobile]
            .filter(Boolean)
            .map((value) => String(value).replace(/\D/g, ''));
        const linkedAdmins = table('admin_users').all().filter((admin) => {
            if (admin.is_super_user) return false;
            const linkedByVolunteerId = String(admin.volunteer_id || '') === String(req.params.volunteerId);
            const sameName = String(admin.name || '').trim().toLowerCase() === normalizedVolunteerName;
            const adminPhones = [admin.phone_number, admin.whatsapp_number]
                .filter(Boolean)
                .map((value) => String(value).replace(/\D/g, ''));
            const samePhone = volunteerPhones.length > 0 && adminPhones.some((phone) => volunteerPhones.includes(phone));
            const credential = table('auth_credentials').findOne((item) => String(item.user_id) === String(admin.admin_id));
            const sameEmail = normalizedVolunteerEmail && String(credential?.email || '').trim().toLowerCase() === normalizedVolunteerEmail;
            return linkedByVolunteerId || sameEmail || (sameName && (samePhone || volunteerPhones.length === 0));
        });
        for (const admin of linkedAdmins) {
            await table('admin_users').updateById(admin.admin_id, { is_active: false });
            const credential = table('auth_credentials').findOne((item) => String(item.user_id) === String(admin.admin_id));
            if (credential) await table('auth_credentials').updateById(credential.id, { is_active: false });
            await logActivity(req.userId, 'DEACTIVATE_ADMIN_AFTER_VOLUNTEER_DELETE', 'admin_users', admin.admin_id, null, { volunteer_id: req.params.volunteerId });
        }
        await table('volunteers').removeById(req.params.volunteerId);
        await logActivity(req.userId, 'DELETE_VOLUNTEER', 'volunteers', req.params.volunteerId, existingVolunteer, null);
        res.json({ message: linkedAdmins.length ? 'Volunteer deleted and linked admin login disabled.' : 'Volunteer deleted successfully!' });
    } catch (error) {
        console.error('Error deleting volunteer:', error);
        res.status(500).json({ error: 'Failed to delete volunteer' });
    }
});

app.get('/api/admin/teams', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const targetClientId = scopedClientId(req, req.query.clientId);
        const teams = table('teams').all().filter((team) => matchesAdminClientScope(req, targetClientId ? team.client_id : null)
            && (!isSuperUserRequest(req) || !targetClientId || String(team.client_id) === String(targetClientId))).sort((a, b) => Number(b.team_id) - Number(a.team_id));
        const assignments = table('volunteer_team_assignments').all().filter((assignment) => matchesAdminClientScope(req, targetClientId ? assignment.client_id : null)
            && (!isSuperUserRequest(req) || !targetClientId || String(assignment.client_id) === String(targetClientId))).map((a) => {
            const volunteer = table('volunteers').findById(a.volunteer_id);
            return { ...a, volunteer_name: volunteer?.volunteer_name || null };
        });
        res.json({ teams, assignments });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

app.post('/api/admin/teams', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { client_id, team_name } = req.body;
        if (!team_name) {
            return res.status(400).json({ error: 'Team name is required' });
        }
        const created = await table('teams').insert({ client_id: scopedClientId(req, client_id), team_name, is_active: true, created_at: new Date() });
        await logActivity(req.userId, 'CREATE_TEAM', 'teams', created.team_id, null, { team_name });
        res.status(201).json({ message: 'Team created successfully!' });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

app.put('/api/admin/teams/:teamId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { teamId } = req.params;
        const teamName = String(req.body.team_name || '').trim();
        const existingTeam = table('teams').findById(teamId);
        if (!existingTeam) return res.status(404).json({ error: 'Team not found' });
        if (!teamName) return res.status(400).json({ error: 'Team name is required' });

        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingTeam.client_id) !== String(adminClientId))) {
            return res.status(403).json({ error: 'This team belongs to another client.' });
        }

        const duplicate = table('teams').findOne((team) =>
            String(team.team_id) !== String(teamId)
            && String(team.client_id || '') === String(existingTeam.client_id || '')
            && String(team.team_name || '').trim().toLowerCase() === teamName.toLowerCase()
        );
        if (duplicate) return res.status(409).json({ error: 'Another team already uses this name' });

        await table('teams').updateById(teamId, { team_name: teamName });
        await logActivity(req.userId, 'RENAME_TEAM', 'teams', teamId, existingTeam, { ...existingTeam, team_name: teamName });
        res.json({ message: 'Team renamed successfully!' });
    } catch (error) {
        console.error('Error renaming team:', error);
        res.status(500).json({ error: 'Failed to rename team' });
    }
});

app.delete('/api/admin/teams/:teamId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { teamId } = req.params;
        const existingTeam = table('teams').findById(teamId);
        if (!existingTeam) return res.status(404).json({ error: 'Team not found' });

        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || String(existingTeam.client_id) !== String(adminClientId))) {
            return res.status(403).json({ error: 'This team belongs to another client.' });
        }

        const assignments = table('volunteer_team_assignments').find((assignment) => String(assignment.team_id) === String(teamId));
        for (const assignment of assignments) {
            await table('volunteer_team_assignments').removeById(assignment.assignment_id);
        }
        await table('teams').removeById(teamId);
        await logActivity(req.userId, 'DELETE_TEAM', 'teams', teamId, existingTeam, null);
        res.json({ message: 'Team deleted successfully!' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

app.post('/api/admin/team-assignments', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const { client_id, volunteer_id, team_id, role_id, is_team_lead, is_team_manager } = req.body;
        if (!volunteer_id || !team_id) {
            return res.status(400).json({ error: 'volunteer_id and team_id are required' });
        }

        await table('volunteer_team_assignments').upsertByKeys(['volunteer_id', 'team_id'], {
            client_id: scopedClientId(req, client_id),
            volunteer_id,
            team_id,
            role_id: role_id || null,
            is_team_lead: !!is_team_lead,
            is_team_manager: !!is_team_manager,
            assigned_by: req.userId || null,
            assigned_at: new Date()
        });
        await logActivity(req.userId, 'ASSIGN_TEAM', 'volunteer_team_assignments', null, null, { volunteer_id, team_id, role_id });
        res.json({ message: 'Team assignment saved successfully!' });
    } catch (error) {
        console.error('Error assigning volunteer to team:', error);
        res.status(500).json({ error: 'Failed to assign volunteer to team' });
    }
});

app.delete('/api/admin/team-assignments/:assignmentId', verifyToken, requireAnyRole(ROLE_SUPER_USER, ROLE_ADMIN), async (req, res) => {
    try {
        const assignment = table('volunteer_team_assignments').findById(req.params.assignmentId)
            || table('volunteer_team_assignments').findOne((row) =>
                String(row.volunteer_id) === String(req.query.volunteerId)
                && String(row.team_id) === String(req.query.teamId)
            );
        if (!assignment) return res.status(404).json({ error: 'Team assignment not found' });

        const adminClientId = getAdminClientId(req);
        if (!isSuperUserRequest(req) && (!adminClientId || String(assignment.client_id) !== String(adminClientId))) {
            return res.status(403).json({ error: 'This assignment belongs to another client.' });
        }

        await table('volunteer_team_assignments').removeById(assignment.assignment_id);
        await logActivity(req.userId, 'REMOVE_TEAM_ASSIGNMENT', 'volunteer_team_assignments', assignment.assignment_id, assignment, null);
        res.json({ message: 'Volunteer removed from team successfully!' });
    } catch (error) {
        console.error('Error removing volunteer from team:', error);
        res.status(500).json({ error: 'Failed to remove volunteer from team' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/uploads')) {
            return next();
        }
        return res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Start Server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
        await initMySqlDb();
        await ensureCoreSetup();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on http://localhost:${PORT}`);
            void recoverPendingRegistrationIntents();
            const recoveryTimer = setInterval(() => {
                void recoverPendingRegistrationIntents();
            }, 60_000);
            recoveryTimer.unref();
        });
    } catch (error) {
        console.error('Startup failed:', error);
        process.exit(1);
    }
};

startServer();
