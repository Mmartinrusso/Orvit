/**
 * O2C Migration Script
 * Executes the O2C tables migration directly using pg client
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Use connection without sslmode in URL, configure SSL separately
  const client = new Client({
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.zytwjqxaztnukzyaqkpb',
    password: 'ryRD5KUfDu53Ste6',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Check current database and schema
    const dbInfo = await client.query("SELECT current_database(), current_schema()");
    console.log('Database:', dbInfo.rows[0].current_database);
    console.log('Schema:', dbInfo.rows[0].current_schema);

    // Check if companies table exists (try both cases)
    const tablesCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name ILIKE 'companies' OR table_name ILIKE 'users' OR table_name ILIKE 'clients')
      ORDER BY table_name
    `);
    console.log('Existing core tables:', tablesCheck.rows.map(r => r.table_name).join(', ') || 'NONE FOUND');

    // Check for cash and bank accounts
    const accountTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name ILIKE '%cash%' OR table_name ILIKE '%bank%')
      ORDER BY table_name
    `);
    console.log('Cash/Bank tables:', accountTables.rows.map(r => r.table_name).join(', ') || 'NONE');

    // Check for sale tables
    const saleTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name ILIKE '%sale%'
      ORDER BY table_name
    `);
    console.log('Sale tables:', saleTables.rows.map(r => r.table_name).join(', ') || 'NONE');

    if (tablesCheck.rows.length === 0) {
      console.log('\n⚠️  Core tables not found. Checking all schemas...');
      const allSchemas = await client.query(`
        SELECT DISTINCT table_schema, COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        GROUP BY table_schema
      `);
      console.log('Available schemas:', allSchemas.rows);
    }

    // Read the migration SQL
    const sqlPath = path.join(__dirname, '../prisma/migrations/20260131_o2c_tables_creation/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing O2C migration...');
    console.log('This may take a moment...\n');

    // Execute the SQL
    await client.query(sql);

    console.log('✅ O2C migration executed successfully!');

    // Verify some tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('sales_invoices', 'client_ledger_entries', 'treasury_movements', 'cheques', 'load_orders')
      ORDER BY table_name
    `);

    console.log('\nVerified O2C tables created:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
