const { Client } = require('pg');
const c = new Client({
  host: 'ep-bitter-mouse-acyirnt5-pooler.sa-east-1.aws.neon.tech',
  port: 5432,
  user: 'neondb_owner',
  password: 'npg_pwEtn30LQIKJ',
  database: 'neondb',
  ssl: { rejectUnauthorized: false }
});
c.connect()
  .then(() => c.query("UPDATE opportunities SET status='pending', task_id=NULL WHERE status IN ('in_progress','failed')"))
  .then(r => { console.log('Updated:', r.rowCount); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
