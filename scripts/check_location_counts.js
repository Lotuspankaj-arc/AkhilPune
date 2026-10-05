import mysql from 'mysql2/promise';

async function checkLocationCounts() {
    if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required.');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'akhil_pune_bhavsar'
    });

    try {
        const [counts] = await conn.query(
            `SELECT 'state_master' AS tbl, COUNT(*) AS cnt FROM state_master
             UNION ALL
             SELECT 'district_master', COUNT(*) FROM district_master
             UNION ALL
             SELECT 'subdistrict_master', COUNT(*) FROM subdistrict_master
             UNION ALL
             SELECT 'location_master', COUNT(*) FROM location_master`
        );

        const [rows] = await conn.query(
            `SELECT lm.location_id, sm.state_name, dm.district_name, sdm.subdistrict_name,
                    lm.pincode, lm.city, lm.post_office, lm.village_name_local
             FROM location_master lm
             JOIN state_master sm ON sm.state_id = lm.state_id
             JOIN district_master dm ON dm.district_id = lm.district_id
             JOIN subdistrict_master sdm ON sdm.subdistrict_id = lm.subdistrict_id
             ORDER BY lm.location_id
             LIMIT 10`
        );

        console.log(JSON.stringify({ counts, rows }, null, 2));
    } finally {
        await conn.end();
    }
}

checkLocationCounts().catch((error) => {
    console.error('Failed to check location counts:', error.message);
    process.exit(1);
});