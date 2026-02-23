// Create liquidaciones permissions in the Permission table
const { Client } = require("pg");

const c = new Client({
  connectionString:
    "postgres://postgres.zytwjqxaztnukzyaqkpb:ryRD5KUfDu53Ste6@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
});

async function main() {
  await c.connect();
  console.log("Connected to database");

  // First check Permission table columns
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Permission' ORDER BY ordinal_position
  `);
  console.log("Permission columns:", cols.rows.map((r) => r.column_name).join(", "));

  // Check existing ventas permissions for reference
  const existing = await c.query(`
    SELECT name, category FROM "Permission"
    WHERE name LIKE 'ventas.%' LIMIT 10
  `);
  console.log("\nExisting ventas permissions:", existing.rows.length);
  existing.rows.forEach((r) => console.log(`  ${r.name} [${r.category}]`));

  // Insert liquidaciones permissions
  const perms = [
    ["ventas.liquidaciones.view", "Ver liquidaciones de vendedores"],
    ["ventas.liquidaciones.create", "Crear liquidaciones de vendedores"],
    ["ventas.liquidaciones.edit", "Editar liquidaciones de vendedores"],
    ["ventas.liquidaciones.delete", "Eliminar liquidaciones de vendedores"],
    ["ventas.liquidaciones.confirm", "Confirmar liquidaciones de vendedores"],
    ["ventas.liquidaciones.pay", "Registrar pago de liquidaciones"],
  ];

  // Also add vendedores resumen permission
  perms.push(["ventas.vendedores.resumen", "Ver resumen de vendedor"]);

  let created = 0;
  for (const [name, description] of perms) {
    const exists = await c.query(
      `SELECT id FROM "Permission" WHERE name = $1`,
      [name]
    );
    if (exists.rows.length === 0) {
      await c.query(
        `INSERT INTO "Permission" (name, description, category, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, 'Ventas', true, NOW(), NOW())`,
        [name, description]
      );
      console.log(`  + Created: ${name}`);
      created++;
    } else {
      console.log(`  = Already exists: ${name}`);
    }
  }

  console.log(`\nDone! Created ${created} permissions.`);
  console.log("ADMIN users will automatically get these permissions.");

  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
