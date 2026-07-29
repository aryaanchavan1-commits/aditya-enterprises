require('dotenv').config();
const { createClient } = require('@libsql/client');

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  const affected = ['categories', 'products', 'sales', 'purchases', 'stock_movements'];
  for (const t of affected) {
    const info = await db.execute('PRAGMA table_info(' + t + ')');
    console.log('=== ' + t + ' ===');
    info.rows.forEach(function(r) {
      console.log('  ' + r.name + ' ' + r.type + (r.pk ? ' PK' : '') + (r.notnull ? ' NOT NULL' : '') + (r.dflt_value ? ' DEFAULT ' + r.dflt_value : ''));
    });
    console.log('');
  }
}
main().catch(console.error);
