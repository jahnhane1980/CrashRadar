import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkTables() {
    try {
        const conn = await mysql.createConnection(process.env.DATABASE_URL);
        const [rows] = await conn.execute('SHOW TABLES;');
        const tables = rows.map(r => Object.values(r)[0]);
        console.log("Found tables:", tables);
        
        // Specially check for DIX table
        if (tables.includes('market_data_dix')) {
            console.log("\nTable 'market_data_dix' EXISTS.");
            const [columns] = await conn.execute('DESCRIBE market_data_dix;');
            console.log("Schema for 'market_data_dix':");
            console.table(columns);
        } else {
            console.log("\nTable 'market_data_dix' DOES NOT EXIST.");
        }

        // Check for 13F tables
        const smartMoneyTables = tables.filter(t => t.includes('13f') || t.includes('smart_money'));
        if (smartMoneyTables.length > 0) {
            console.log("\nFound 13F/Smart Money tables:", smartMoneyTables);
            for (const t of smartMoneyTables) {
                const [columns] = await conn.execute(`DESCRIBE ${t};`);
                console.log(`Schema for '${t}':`);
                console.table(columns);
            }
        }

        await conn.end();
    } catch (e) {
        console.error("Database connection failed:", e);
    }
}

checkTables();
