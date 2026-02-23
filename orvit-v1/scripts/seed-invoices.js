// Seed script: Example SalesInvoice records for existing OV sales
const { Client } = require("pg");

const c = new Client({
  connectionString:
    "postgres://postgres.zytwjqxaztnukzyaqkpb:ryRD5KUfDu53Ste6@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

function padNum(n, digits) {
  return String(n).padStart(digits, "0");
}

function buildNumeroCompleto(letra, pv, num) {
  return `FC-${letra} ${padNum(pv, 5)}-${padNum(num, 8)}`;
}

async function main() {
  await c.connect();
  console.log("Connected to database\n");

  // Check if invoices already exist for these specific sales
  const saleIdsToCheck = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
  const existing = await c.query(
    `SELECT COUNT(*) FROM sales_invoices WHERE "saleId" = ANY($1::int[]) AND "companyId" = 3`,
    [saleIdsToCheck]
  );
  if (parseInt(existing.rows[0].count) > 0) {
    console.log(`Already have ${existing.rows[0].count} invoices linked to OV sales.\n`);
    const peek = await c.query(
      `SELECT si."numeroCompleto", si.estado, si.total, si."saldoPendiente", s.numero as sale_numero
       FROM sales_invoices si JOIN sales s ON s.id = si."saleId"
       WHERE si."saleId" = ANY($1::int[]) ORDER BY si.id`,
      [saleIdsToCheck]
    );
    peek.rows.forEach(r => console.log(`  ${r.numerocompleto} | ${r.sale_numero} | ${r.estado} | $${r.total}`));
    await c.end();
    return;
  }

  // Get sales info (OVs from liquidaciones)
  // LIQ-2025-00001 PAGADA: saleIds 14,15,16,17,18,19,25,26,27
  // LIQ-2026-00001 CONFIRMADA: saleIds 10,11,12,13,20,21,22,23,24
  const saleIds = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];

  const salesRes = await c.query(
    `SELECT id, numero, "clientId", total, "fechaEmision", "companyId"
     FROM sales
     WHERE id = ANY($1::int[])
     ORDER BY id`,
    [saleIds]
  );

  console.log(`Found ${salesRes.rows.length} sales to invoice\n`);

  // PAGADA liq sales (already fully paid): 14-19, 25-27 → COBRADA
  const pagadaSaleIds = new Set([14, 15, 16, 17, 18, 19, 25, 26, 27]);

  // CONFIRMADA liq sales (still pending): 10-13, 20-24 → mix: some EMITIDA, some PARCIALMENTE_COBRADA
  const emitidaSaleIds = new Set([10, 12, 20, 22, 24]);
  const parcialSaleIds = new Set([11, 13, 21, 23]);

  // Start counter after existing invoices to avoid unique constraint violation
  const maxNumRes = await c.query(
    `SELECT MAX(CAST(numero AS INTEGER)) as max_num FROM sales_invoices WHERE tipo = 'B' AND "puntoVenta" = '00001' AND "companyId" = 3`
  );
  let invoiceCounter = (parseInt(maxNumRes.rows[0].max_num) || 0) + 1;

  for (const sale of salesRes.rows) {
    const saleId = sale.id;
    const total = parseFloat(sale.total);
    const netoGravado = parseFloat((total / 1.21).toFixed(2));
    const iva21 = parseFloat((total - netoGravado).toFixed(2));

    let estado, saldoPendiente, totalCobrado;

    if (pagadaSaleIds.has(saleId)) {
      estado = "COBRADA";
      totalCobrado = total;
      saldoPendiente = 0;
    } else if (emitidaSaleIds.has(saleId)) {
      estado = "EMITIDA";
      totalCobrado = 0;
      saldoPendiente = total;
    } else if (parcialSaleIds.has(saleId)) {
      estado = "PARCIALMENTE_COBRADA";
      totalCobrado = parseFloat((total * 0.5).toFixed(2));
      saldoPendiente = parseFloat((total - totalCobrado).toFixed(2));
    } else {
      estado = "EMITIDA";
      totalCobrado = 0;
      saldoPendiente = total;
    }

    // fechaEmision = fechaEmision of sale (or fallback to a known date)
    const fechaEmisionStr = sale.fechaEmision
      ? new Date(sale.fechaEmision).toISOString().split("T")[0]
      : "2026-01-15";

    // Vencimiento = +30 dias
    const fechaEmisionDate = new Date(fechaEmisionStr);
    const fechaVencimiento = new Date(fechaEmisionDate);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    const fechaVencimientoStr = fechaVencimiento.toISOString().split("T")[0];

    const numero = padNum(invoiceCounter, 8);
    const puntoVenta = "00001";
    const letra = "B";
    const numeroCompleto = buildNumeroCompleto(letra, "1", invoiceCounter);

    console.log(
      `  Creating invoice ${numeroCompleto} for sale ${sale.numero} (${sale.id}) — ${estado} — $${total}`
    );

    await c.query(
      `INSERT INTO sales_invoices (
        tipo, letra, "puntoVenta", numero, "numeroCompleto",
        "clientId", "saleId", estado,
        "fechaEmision", "fechaVencimiento",
        "netoGravado", "netoNoGravado", exento,
        "iva21", "iva105", "iva27",
        "percepcionIVA", "percepcionIIBB", "otrosImpuestos",
        total, moneda,
        "totalCobrado", "saldoPendiente",
        "condicionesPago",
        "companyId", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        'B', $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9,
        $10, 0, 0,
        $11, 0, 0,
        0, 0, 0,
        $12, 'ARS',
        $13, $14,
        '30 días',
        3, 2, NOW(), NOW()
      )`,
      [
        letra,
        puntoVenta,
        numero,
        numeroCompleto,
        sale.clientId,
        saleId,
        estado,
        fechaEmisionStr,
        fechaVencimientoStr,
        netoGravado,
        iva21,
        total,
        totalCobrado,
        saldoPendiente,
      ]
    );

    invoiceCounter++;
  }

  // Verify
  const countRes = await c.query(
    `SELECT estado, COUNT(*) as count FROM sales_invoices WHERE "companyId" = 3 GROUP BY estado ORDER BY estado`
  );
  console.log("\n=== Invoices created ===");
  countRes.rows.forEach((r) => console.log(`  ${r.estado}: ${r.count}`));

  const allRes = await c.query(
    `SELECT si."numeroCompleto", si.estado, si.total, s.numero as sale_numero
     FROM sales_invoices si
     JOIN sales s ON s.id = si."saleId"
     WHERE si."companyId" = 3
     ORDER BY si.id`
  );
  console.log("\n  Detail:");
  allRes.rows.forEach((r) =>
    console.log(
      `  ${r.numeroCompleto} | ${r.sale_numero} | ${r.estado} | $${r.total}`
    )
  );

  await c.end();
  console.log("\nDone! Invoice seed data created successfully.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
