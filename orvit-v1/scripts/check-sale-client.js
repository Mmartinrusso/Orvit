const { Client } = require("pg");
const c = new Client({
  connectionString: "postgres://postgres.zytwjqxaztnukzyaqkpb:ryRD5KUfDu53Ste6@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
  ssl: { rejectUnauthorized: false },
});
c.connect().then(async () => {
  const r = await c.query(`SELECT id, numero, "clientId", total FROM sales WHERE id IN (10,11) ORDER BY id`);
  console.log('Keys:', Object.keys(r.rows[0]));
  console.log('Row 0:', r.rows[0]);
  console.log('clientId:', r.rows[0].clientId, '| clientid:', r.rows[0].clientid);
  await c.end();
});
