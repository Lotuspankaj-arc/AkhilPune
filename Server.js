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

// dotenv.config() is disabled in production - Railway injects environment variables directly
// In development, create a .env file or set variables manually
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

