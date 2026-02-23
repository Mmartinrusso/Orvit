const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgres://postgres.zytwjqxaztnukzyaqkpb:ryRD5KUfDu53Ste6@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
c.connect().then(async () => {
  // Check what sale-related tables exist
  const r = await c.query(`SELECT tablename FROM pg_tables WHERE tablename ILIKE '%sale%' ORDER BY tablename`);
  console.log('Sale tables:', r.rows.map(x => x.tablename));

  // Check constraint info for sales_invoices
  const fk = await c.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'sales_invoices' AND c.contype = 'f'
  `);
  console.log('FK constraints:', fk.rows);

  // Check sales table IDs
  const s = await c.query(`SELECT id, numero FROM sales WHERE id IN (10,11,12,13,14,15) ORDER BY id`);
  console.log('Sales rows:', s.rows);

  // Check Sale table (capital S) if it exists
  try {
    const s2 = await c.query(`SELECT id FROM "Sale" LIMIT 5`);
    console.log('Sale (capital) rows:', s2.rows);
  } catch (e) {
    console.log('No "Sale" table:', e.message);
  }

  await c.end();
});
