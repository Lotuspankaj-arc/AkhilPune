import mysql from 'mysql2/promise';

const TABLE_NAMES = [
    'languages', 'state_master', 'district_master', 'subdistrict_master',
    'location_master', 'education_master', 'expectation_master', 'clients', 'admin_users',
    'events', 'teams', 'roles', 'volunteers', 'volunteer_groups',
    'volunteer_team_assignments', 'candidates', 'candidate_event_registrations', 'subscriptions', 'candidate_interactions', 'registration_intents',
    'auth_credentials', 'activity_logs', 'sftp_config', 'client_admin_mapping', 'client_payment_gateway', 'client_domains',
    'subscription_plans', 'client_subscriptions'
];

const ID_FIELDS = {
    languages: 'language_id', state_master: 'state_id', district_master: 'district_id',
    subdistrict_master: 'subdistrict_id', location_master: 'location_id',
    education_master: 'education_id', expectation_master: 'expectation_id',
    clients: 'client_id',
    admin_users: 'admin_id', events: 'event_id', teams: 'team_id', roles: 'role_id',
    volunteers: 'volunteer_id', volunteer_groups: 'group_id',
    volunteer_team_assignments: 'assignment_id', candidates: 'batch_id', candidate_event_registrations: 'registration_id', subscriptions: 'subscription_id',
    candidate_interactions: 'interaction_id',
    registration_intents: 'intent_id', auth_credentials: 'id', activity_logs: 'log_id', sftp_config: 'config_id', client_payment_gateway: 'config_id', client_domains: 'domain_id',
    subscription_plans: 'plan_id', client_subscriptions: 'client_subscription_id'
};

// Pool will be created lazily after dotenv.config() is called
let pool = null;

// Create pool with current environment configuration
function createPool() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'akhil_pune_bhavsar',
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
            : undefined
    };

    console.log('Database config loaded:', {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password ? '***' : '(empty)',
        database: dbConfig.database
    });

    return mysql.createPool(dbConfig);
}

// Lazy getter for pool
function getPool() {
    if (!pool) {
        pool = createPool();
    }
    return pool;
}

const cache = new Map();
const columns = new Map();
const queues = new Map();
let ready = false;
let readyPromise = null;

const serializeValue = (value) => {
    if (value instanceof Date) return value;
    if (Buffer.isBuffer(value)) return value;
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    return value;
};

const quoteTable = (name) => `\`${name}\``;

const usableEntries = (name, data) => Object.entries(data)
    .filter(([key]) => columns.get(name)?.has(key))
    .map(([key, value]) => [key, serializeValue(value)]);

const lock = (name, operation) => {
    const previous = queues.get(name) || Promise.resolve();
    const current = previous.then(operation, operation);
    queues.set(name, current.catch(() => {}));
    return current;
};

class Table {
    constructor(name) {
        this.name = name;
        this.idField = ID_FIELDS[name];
    }

    all() {
        return (cache.get(this.name) || []).map((row) => ({ ...row }));
    }

    find(predicate) {
        return this.all().filter(predicate);
    }

    findOne(predicate) {
        const row = (cache.get(this.name) || []).find(predicate);
        return row ? { ...row } : null;
    }

    findById(id) {
        if (id === undefined || id === null || id === '') return null;
        return this.findOne((row) => String(row[this.idField]) === String(id));
    }

    async insert(data) {
        return lock(this.name, async () => {
            const entries = usableEntries(this.name, data);
            const fieldNames = entries.map(([field]) => field);
            const values = entries.map(([, value]) => value);
            const placeholders = fieldNames.map(() => '?').join(', ');
            const [result] = await getPool().query(
                `INSERT INTO ${quoteTable(this.name)} (${fieldNames.map((field) => `\`${field}\``).join(', ')}) VALUES (${placeholders})`,
                values
            );
            await this.refresh();
            return this.findById(data[this.idField] || result.insertId);
        });
    }

    async updateById(id, patch) {
        return lock(this.name, async () => {
            const entries = usableEntries(this.name, patch);
            if (entries.length === 0) return this.findById(id);
            const assignments = entries.map(([field]) => `\`${field}\` = ?`).join(', ');
            await getPool().query(
                `UPDATE ${quoteTable(this.name)} SET ${assignments} WHERE \`${this.idField}\` = ?`,
                [...entries.map(([, value]) => value), id]
            );
            await this.refresh();
            return this.findById(id);
        });
    }

    async upsertByKeys(keyFields, data) {
        const existing = this.findOne((row) => keyFields.every((key) => String(row[key] ?? '') === String(data[key] ?? '')));
        return existing ? this.updateById(existing[this.idField], data) : this.insert(data);
    }

    async removeById(id) {
        return lock(this.name, async () => {
            const [result] = await getPool().query(`DELETE FROM ${quoteTable(this.name)} WHERE \`${this.idField}\` = ?`, [id]);
            await this.refresh();
            return result.affectedRows > 0;
        });
    }

    async refresh() {
        const [rows] = await getPool().query(`SELECT * FROM ${quoteTable(this.name)}`);
        cache.set(this.name, rows);
        return rows;
    }
}

const tableInstances = new Map();

export const table = (name) => {
    if (!ready) throw new Error('mysqlDb not initialized yet - call initMySqlDb() first');
    if (!TABLE_NAMES.includes(name)) throw new Error(`Unknown database table: ${name}`);
    if (!tableInstances.has(name)) tableInstances.set(name, new Table(name));
    return tableInstances.get(name);
};

export async function initMySqlDb() {
    if (ready) return;
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
        await getPool().query('SELECT 1');

        const ensureColumnExists = async (tableName, columnName, definitionSql) => {
            const [rows] = await getPool().query(
                'SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
                [tableName, columnName]
            );
            if (Number(rows?.[0]?.column_count || 0) === 0) {
                await getPool().query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definitionSql}`);
            }
        };

        await ensureColumnExists('volunteers', 'main_profession', 'VARCHAR(150) NULL');

        for (const name of TABLE_NAMES) {
            const [tableColumns] = await getPool().query(
                'SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
                [name]
            );
            if (tableColumns.length === 0) throw new Error(`Required MySQL table is missing: ${name}`);
            columns.set(name, new Set(tableColumns.map((column) => column.COLUMN_NAME)));
            await new Table(name).refresh();
        }
        ready = true;
    })();

    return readyPromise;
}

export const closeMySqlDb = () => getPool().end();
export const isReady = () => ready;

// Default export provides direct query access
export default {
    query: async (sql, values) => {
        const [rows] = await getPool().query(sql, values);
        return rows;
    },
    table,
    initMySqlDb,
    closeMySqlDb,
    isReady
};