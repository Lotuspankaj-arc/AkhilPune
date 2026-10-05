import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

const filePath = process.argv[2];
const cliArgs = process.argv.slice(3);

const limitArg = cliArgs.find((arg) => arg.startsWith('--limit='));
const importLimit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : null;
const shouldReset = cliArgs.includes('--reset');
const stateArg = cliArgs.find((arg) => arg.startsWith('--state='));
const stateFilter = stateArg ? stateArg.split('=')[1].trim().toUpperCase() : null;

if (!filePath) {
    console.error('Usage: node scripts/import_pincode_master.js <path-to-pincode-json> [--limit=25] [--state=MAHARASHTRA] [--reset]');
    process.exit(1);
}

if (limitArg && (!Number.isInteger(importLimit) || importLimit <= 0)) {
    console.error('The --limit value must be a positive integer.');
    process.exit(1);
}

const toText = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
};

const toPincode = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
    return digits.length === 6 ? digits : null;
};

const normalizeSubdistrictName = (value) => String(value || '').trim();

async function importPincodeMaster() {
    const raw = await fs.readFile(filePath, 'utf8');
    const items = JSON.parse(raw);

    if (!Array.isArray(items)) {
        throw new Error('The JSON file must contain an array of pincode records.');
    }

    if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required.');

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
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
                FOREIGN KEY (state_id) REFERENCES state_master(state_id)
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
                FOREIGN KEY (district_id) REFERENCES district_master(district_id)
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
                FOREIGN KEY (state_id) REFERENCES state_master(state_id),
                FOREIGN KEY (district_id) REFERENCES district_master(district_id),
                FOREIGN KEY (subdistrict_id) REFERENCES subdistrict_master(subdistrict_id)
            )`
        );

        if (shouldReset) {
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');
            await conn.query('TRUNCATE TABLE location_master');
            await conn.query('TRUNCATE TABLE subdistrict_master');
            await conn.query('TRUNCATE TABLE district_master');
            await conn.query('TRUNCATE TABLE state_master');
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        const stateCache = new Map();
        const districtCache = new Map();
        const subdistrictCache = new Map();

        const upsertState = async (stateName) => {
            if (stateCache.has(stateName)) return stateCache.get(stateName);

            const [result] = await conn.query(
                `INSERT INTO state_master (state_name, is_active)
                 VALUES (?, TRUE)
                 ON DUPLICATE KEY UPDATE state_id = LAST_INSERT_ID(state_id), is_active = VALUES(is_active)`,
                [stateName]
            );

            stateCache.set(stateName, result.insertId);
            return result.insertId;
        };

        const upsertDistrict = async (stateId, districtName) => {
            const cacheKey = `${stateId}|${districtName}`;
            if (districtCache.has(cacheKey)) return districtCache.get(cacheKey);

            const [result] = await conn.query(
                `INSERT INTO district_master (state_id, district_name, is_active)
                 VALUES (?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE district_id = LAST_INSERT_ID(district_id), is_active = VALUES(is_active)`,
                [stateId, districtName]
            );

            districtCache.set(cacheKey, result.insertId);
            return result.insertId;
        };

        const upsertSubdistrict = async (districtId, subdistrictName) => {
            const cacheKey = `${districtId}|${subdistrictName}`;
            if (subdistrictCache.has(cacheKey)) return subdistrictCache.get(cacheKey);

            const [result] = await conn.query(
                `INSERT INTO subdistrict_master (district_id, subdistrict_name, is_active)
                 VALUES (?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE subdistrict_id = LAST_INSERT_ID(subdistrict_id), is_active = VALUES(is_active)`,
                [districtId, subdistrictName]
            );

            subdistrictCache.set(cacheKey, result.insertId);
            return result.insertId;
        };

        let importedCount = 0;
        const filteredItems = stateFilter
            ? items.filter((item) => String(item.State || '').trim().toUpperCase() === stateFilter)
            : items;
        const sourceItems = Number.isInteger(importLimit) ? filteredItems.slice(0, importLimit) : filteredItems;

        for (const item of sourceItems) {
            const pincode = toPincode(item.Pincode);
            const state = toText(item.State);
            const district = toText(item.District);
            const city = toText(item.City);
            const postOffice = toText(item.PostOffice);

            if (!pincode || !state || !district || !city || !postOffice) {
                continue;
            }

            const stateId = await upsertState(state);
            const districtId = await upsertDistrict(stateId, district);
            const subdistrictId = await upsertSubdistrict(districtId, normalizeSubdistrictName(item.Taluka_Sub_District));

            await conn.query(
                `INSERT INTO location_master (
                    state_id, district_id, subdistrict_id, pincode, city, post_office, village_name_local, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
                ON DUPLICATE KEY UPDATE
                    village_name_local = VALUES(village_name_local),
                    is_active = VALUES(is_active)`,
                [
                    stateId,
                    districtId,
                    subdistrictId,
                    pincode,
                    city,
                    postOffice,
                    toText(item.Village_Name_Local)
                ]
            );

            importedCount += 1;
        }

        console.log(`Imported ${importedCount} pincode records from ${path.basename(filePath)} using normalized location masters${stateFilter ? ` for state ${stateFilter}` : ''}${Number.isInteger(importLimit) ? ` (limit ${importLimit})` : ''}${shouldReset ? ' after reset' : ''}.`);
    } finally {
        await conn.end();
    }
}

importPincodeMaster().catch((error) => {
    console.error('Failed to import pincode master data:', error.message);
    process.exit(1);
});