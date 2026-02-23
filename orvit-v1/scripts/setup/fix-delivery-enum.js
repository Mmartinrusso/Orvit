#!/usr/bin/env node
/**
 * Script to fix DeliveryStatus enum by removing PARCIAL
 * Executes SQL migration directly using pg driver
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Accept self-signed certificates
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    console.log('📋 Reading migration SQL...');
    const sqlPath = path.join(__dirname, '../prisma/migrations/fix_delivery_status_enum.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚙️  Executing migration...');
    await client.query(sql);

    console.log('✅ Migration completed successfully!');
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
