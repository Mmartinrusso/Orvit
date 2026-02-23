const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado a la base de datos');

    const sqlFile = path.join(__dirname, '../prisma/migrations/manual/add_payroll_module.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Ejecutando migración del módulo de nóminas...');
    await client.query(sql);

    console.log('');
    console.log('============================================');
    console.log('Migración ejecutada exitosamente!');
    console.log('============================================');
    console.log('');
  } catch (error) {
    console.error('Error ejecutando migración:', error.message);
    if (error.detail) console.error('Detalle:', error.detail);
  } finally {
    await client.end();
  }
}

runMigration();
