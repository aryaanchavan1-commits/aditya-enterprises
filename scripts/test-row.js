require('dotenv').config();
const { createClient } = require('@libsql/client');

async function test() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  const r = await db.execute('SELECT * FROM categories LIMIT 1');
  const row = r.rows[0];
  console.log('typeof row:', typeof row);
  console.log('row keys:', Object.keys(row));
  console.log('row.columns:', JSON.stringify(row.columns));
  console.log('row.id:', row.id);
  console.log('typeof row.id:', typeof row.id);
  const spread = { ...row };
  console.log('spread:', JSON.stringify(spread, (k, v) => typeof v === 'bigint' ? Number(v) : v));
  console.log('spread keys:', Object.keys(spread));
  console.log('row.id value:', row.id);
}
test().catch(e => console.error(e));
