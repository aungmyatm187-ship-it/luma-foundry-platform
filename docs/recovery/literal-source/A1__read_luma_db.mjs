import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL unavailable');
const db = await mysql.createConnection(url);
for (const table of ['collaborationGoals', 'collaborationProducts', 'collaborationHandoffs', 'collaborationWorkItems', 'collaborationDecisions']) {
  try {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY updatedAt DESC LIMIT 100`);
    const safe = rows.map((row) => {
      const copy = { ...row };
      for (const key of Object.keys(copy)) {
        if (/email|openId|token|secret|password/i.test(key)) delete copy[key];
      }
      return copy;
    });
    console.log(`--- ${table} ---`);
    console.log(JSON.stringify(safe, null, 2));
  } catch (error) {
    console.log(`--- ${table} ERROR ---`);
    console.log(error.message);
  }
}
await db.end();
