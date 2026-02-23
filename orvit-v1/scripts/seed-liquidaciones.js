// Seed script: Full example data for cost breakdowns + liquidaciones
const { Client } = require("pg");

const c = new Client({
  connectionString:
    "postgres://postgres.zytwjqxaztnukzyaqkpb:ryRD5KUfDu53Ste6@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
});

async function main() {
  await c.connect();
  console.log("Connected to database\n");

  // ============================================================
  // 1. Create SalesRep records
  // ============================================================
  console.log("=== 1. Creating Sales Reps ===");

  // Check if they exist already
  const existingReps = await c.query(`SELECT id FROM sales_reps`);
  if (existingReps.rows.length === 0) {
    await c.query(`
      INSERT INTO sales_reps (nombre, email, telefono, "zonaId", comision, "cuotaMensual", "ventasMes", "ventasAnio", "companyId", "isActive", "createdAt", "updatedAt")
      VALUES
        ('Messi', 'messi@test.com', '351-555-0001', NULL, 5.00, 500000.00, 0, 0, 3, true, NOW(), NOW()),
        ('Lucas Russo', 'lucas@test.com', '351-555-0002', NULL, 4.50, 400000.00, 0, 0, 3, true, NOW(), NOW()),
        ('Sebastian Carranza', 'seba@test.com', '351-555-0003', NULL, 5.50, 600000.00, 0, 0, 3, true, NOW(), NOW())
    `);
    console.log("  Created 3 sales reps: Messi (5%), Lucas Russo (4.5%), Sebastian Carranza (5.5%)");
  } else {
    console.log("  Sales reps already exist, skipping");
  }

  // ============================================================
  // 2. Update sales to have comisionPorcentaje
  // ============================================================
  console.log("\n=== 2. Updating sales with comision data ===");

  // Set comisionPorcentaje=5% for all Messi's sales (sellerId=1)
  const updSales = await c.query(`
    UPDATE sales
    SET "comisionPorcentaje" = 5.00,
        "comisionMonto" = total * 0.05
    WHERE "sellerId" = 1 AND "comisionPorcentaje" IS NULL
  `);
  console.log(`  Updated ${updSales.rowCount} sales with 5% comision for Messi`);

  // Assign some sales without seller to Lucas Russo (userId=8) and Carranza (userId=7)
  // Sales 38,39,40 are big ones without seller - assign to Lucas and Seba
  await c.query(`
    UPDATE sales SET "sellerId" = 8, "comisionPorcentaje" = 4.50, "comisionMonto" = total * 0.045
    WHERE id IN (38, 35) AND "sellerId" IS NULL
  `);
  console.log("  Assigned sales 38,35 to Lucas Russo (userId=8)");

  await c.query(`
    UPDATE sales SET "sellerId" = 7, "comisionPorcentaje" = 5.50, "comisionMonto" = total * 0.055
    WHERE id IN (39, 40, 36) AND "sellerId" IS NULL
  `);
  console.log("  Assigned sales 39,40,36 to Sebastian Carranza (userId=7)");

  // ============================================================
  // 3. Cost breakdowns for quote items (materiales de construcción)
  // ============================================================
  console.log("\n=== 3. Creating cost breakdowns for quote items ===");

  const existingQB = await c.query(
    `SELECT COUNT(*) FROM quote_item_cost_breakdowns`
  );
  if (parseInt(existingQB.rows[0].count) === 0) {
    // Bloques de Hormigón 20x20x40 - $150/u (quote item 1)
    // Desglose: Material $100 + Flete $30 + Tarima $20
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (1, 'Material (Bloque)', 100.00, 1),
        (1, 'Flete', 30.00, 2),
        (1, 'Tarima', 20.00, 3)
    `);

    // Cemento Portland 50kg - $1200/u (quote item 2)
    // Desglose: Producto $950 + Flete $200 + Palletizado $50
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (2, 'Producto', 950.00, 1),
        (2, 'Flete', 200.00, 2),
        (2, 'Palletizado', 50.00, 3)
    `);

    // Arena Fina x m3 - $4500/m3 (quote item 3)
    // Desglose: Material $3200 + Flete $1000 + Descarga $300
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (3, 'Material', 3200.00, 1),
        (3, 'Flete', 1000.00, 2),
        (3, 'Descarga', 300.00, 3)
    `);

    // Ladrillos Cerámicos - $85/u (quote item 4)
    // Desglose: Material $60 + Flete $15 + Tarima $10
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (4, 'Material', 60.00, 1),
        (4, 'Flete', 15.00, 2),
        (4, 'Tarima', 10.00, 3)
    `);

    // Hierro 8mm x 12m - $2800/u (quote item 5)
    // Desglose: Material $2200 + Flete $400 + Mano de obra $200
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (5, 'Material', 2200.00, 1),
        (5, 'Flete', 400.00, 2),
        (5, 'Mano de obra', 200.00, 3)
    `);

    // Hierro 10mm x 12m - $4200/u (quote item 6)
    // Desglose: Material $3400 + Flete $500 + Mano de obra $300
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (6, 'Material', 3400.00, 1),
        (6, 'Flete', 500.00, 2),
        (6, 'Mano de obra', 300.00, 3)
    `);

    // Cemento Portland 50kg - $1200/u (quote item 7)
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (7, 'Producto', 950.00, 1),
        (7, 'Flete', 200.00, 2),
        (7, 'Palletizado', 50.00, 3)
    `);

    // Piedra Partida x m3 - $5200/m3 (quote item 8)
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (8, 'Material', 3800.00, 1),
        (8, 'Flete', 1100.00, 2),
        (8, 'Descarga', 300.00, 3)
    `);

    // Malla Electrosoldada 15x15cm - $8500/u (quote item 9)
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (9, 'Material', 6500.00, 1),
        (9, 'Flete', 1500.00, 2),
        (9, 'Mano de obra', 500.00, 3)
    `);

    // Cal Hidratada 25kg - $650/u (quote item 10)
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (10, 'Producto', 480.00, 1),
        (10, 'Flete', 120.00, 2),
        (10, 'Embalaje', 50.00, 3)
    `);

    // Membrana Asfáltica 4mm - $15000/u (quote item 11)
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (11, 'Material', 11000.00, 1),
        (11, 'Flete', 2500.00, 2),
        (11, 'Instalación', 1500.00, 3)
    `);

    // Bigger quotes (20-23) - construction materials with higher prices
    // Quote item 14: Bloques $8500/u
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (14, 'Material', 5500.00, 1),
        (14, 'Flete', 2000.00, 2),
        (14, 'Tarima', 1000.00, 3)
    `);

    // Quote item 15: Arena Fina $12000/m3
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (15, 'Material', 8500.00, 1),
        (15, 'Flete', 2500.00, 2),
        (15, 'Descarga', 1000.00, 3)
    `);

    // Quote item 16: Ladrillos $15000/u
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (16, 'Material', 10000.00, 1),
        (16, 'Flete', 3000.00, 2),
        (16, 'Tarima', 2000.00, 3)
    `);

    // Quote item 18: Hierro 8mm $45000/u
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (18, 'Material', 32000.00, 1),
        (18, 'Flete', 8000.00, 2),
        (18, 'Mano de obra', 5000.00, 3)
    `);

    // Quote item 20: Malla $28000/u
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (20, 'Material', 20000.00, 1),
        (20, 'Flete', 5000.00, 2),
        (20, 'Mano de obra', 3000.00, 3)
    `);

    // Quote item 21: Membrana $35000/u
    await c.query(`
      INSERT INTO quote_item_cost_breakdowns ("quoteItemId", concepto, monto, orden) VALUES
        (21, 'Material', 25000.00, 1),
        (21, 'Flete', 6000.00, 2),
        (21, 'Instalación', 4000.00, 3)
    `);

    console.log("  Created cost breakdowns for 17 quote items");
  } else {
    console.log("  Quote breakdowns already exist, skipping");
  }

  // ============================================================
  // 4. Cost breakdowns for sale items
  // ============================================================
  console.log("\n=== 4. Creating cost breakdowns for sale items ===");

  const existingSB = await c.query(
    `SELECT COUNT(*) FROM sale_item_cost_breakdowns`
  );
  if (parseInt(existingSB.rows[0].count) === 0) {
    // Create breakdowns for Messi's sales items
    // Products: Aceite ($2520), Arroz ($1190), Fideos ($770), Harina ($560), Azúcar ($910)

    // For each sale item with Aceite de Girasol 1.5L @ $2520
    // Desglose: Producto $1800 + Flete $500 + Embalaje $220
    const aceiteItems = [1, 4, 8, 13, 16, 20, 25, 28, 32, 37];
    for (const itemId of aceiteItems) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 1800.00, 1),
          ($1, 'Flete', 500.00, 2),
          ($1, 'Embalaje', 220.00, 3)
      `,
        [itemId]
      );
    }

    // Arroz Largo Fino 1kg @ $1190
    // Desglose: Producto $850 + Flete $250 + Embalaje $90
    const arrozItems = [2, 5, 9, 14, 17, 21, 26, 29, 33, 38];
    for (const itemId of arrozItems) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 850.00, 1),
          ($1, 'Flete', 250.00, 2),
          ($1, 'Embalaje', 90.00, 3)
      `,
        [itemId]
      );
    }

    // Fideos Spaghetti 500g @ $770
    // Desglose: Producto $550 + Flete $150 + Embalaje $70
    const fideosItems = [3, 6, 10, 15, 18, 22, 27, 30, 34, 39];
    for (const itemId of fideosItems) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 550.00, 1),
          ($1, 'Flete', 150.00, 2),
          ($1, 'Embalaje', 70.00, 3)
      `,
        [itemId]
      );
    }

    // Harina 000 1kg @ $560
    // Desglose: Producto $380 + Flete $130 + Embalaje $50
    const harinaItems = [7, 11, 19, 23, 31, 35];
    for (const itemId of harinaItems) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 380.00, 1),
          ($1, 'Flete', 130.00, 2),
          ($1, 'Embalaje', 50.00, 3)
      `,
        [itemId]
      );
    }

    // Azúcar 1kg @ $910
    // Desglose: Producto $650 + Flete $180 + Embalaje $80
    const azucarItems = [12, 24, 36];
    for (const itemId of azucarItems) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 650.00, 1),
          ($1, 'Flete', 180.00, 2),
          ($1, 'Embalaje', 80.00, 3)
      `,
        [itemId]
      );
    }

    // Also breakdowns for lower-priced Aceite ($2340) items (sales 20-27)
    const aceite2Items = [40, 42, 45, 49, 54, 56, 59, 63];
    for (const itemId of aceite2Items) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 1680.00, 1),
          ($1, 'Flete', 460.00, 2),
          ($1, 'Embalaje', 200.00, 3)
      `,
        [itemId]
      );
    }

    // Arroz $1105 items
    const arroz2Items = [41, 43, 46, 50, 55, 57, 60, 64];
    for (const itemId of arroz2Items) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 790.00, 1),
          ($1, 'Flete', 230.00, 2),
          ($1, 'Embalaje', 85.00, 3)
      `,
        [itemId]
      );
    }

    // Fideos $715 items
    const fideos2Items = [44, 47, 51, 58, 61, 65];
    for (const itemId of fideos2Items) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 510.00, 1),
          ($1, 'Flete', 140.00, 2),
          ($1, 'Embalaje', 65.00, 3)
      `,
        [itemId]
      );
    }

    // Harina $520 items
    const harina2Items = [48, 52, 62, 66];
    for (const itemId of harina2Items) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 355.00, 1),
          ($1, 'Flete', 120.00, 2),
          ($1, 'Embalaje', 45.00, 3)
      `,
        [itemId]
      );
    }

    // Azúcar $845 items
    const azucar2Items = [53, 67];
    for (const itemId of azucar2Items) {
      await c.query(
        `
        INSERT INTO sale_item_cost_breakdowns ("saleItemId", concepto, monto, orden) VALUES
          ($1, 'Producto', 605.00, 1),
          ($1, 'Flete', 165.00, 2),
          ($1, 'Embalaje', 75.00, 3)
      `,
        [itemId]
      );
    }

    console.log(
      "  Created cost breakdowns for 67 sale items (Producto + Flete + Embalaje)"
    );
  } else {
    console.log("  Sale breakdowns already exist, skipping");
  }

  // ============================================================
  // 5. Create Liquidaciones
  // ============================================================
  console.log("\n=== 5. Creating liquidaciones ===");

  const existingLiq = await c.query(
    `SELECT COUNT(*) FROM seller_liquidaciones`
  );
  if (parseInt(existingLiq.rows[0].count) === 0) {
    const now = new Date().toISOString();

    // --- LIQUIDACION 1: PAGADA (Messi, diciembre 2025) ---
    const liq1 = await c.query(
      `
      INSERT INTO seller_liquidaciones (
        numero, "sellerId", estado, "fechaDesde", "fechaHasta",
        "totalVentas", "comisionPorcentaje", "totalComisiones",
        ajustes, "totalLiquidacion", notas, "notasInternas",
        "confirmadoPor", "confirmadoAt", "pagadoPor", "pagadoAt",
        "medioPago", "referenciaPago",
        "companyId", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        'LIQ-2025-00001', 1, 'PAGADA', '2025-12-01', '2025-12-31',
        $1, 5.00, $2,
        0, $2, 'Liquidación de diciembre 2025', 'Pagado por transferencia bancaria',
        2, '2026-01-05T10:00:00.000Z', 2, '2026-01-10T14:30:00.000Z',
        'Transferencia Bancaria', 'TRF-2026-00123',
        3, 2, '2026-01-02T09:00:00.000Z', '2026-01-10T14:30:00.000Z'
      ) RETURNING id
    `,
      [
        // Sales 14-19 are Messi's Dec sales
        // 14: $87664.50, 15: $120697.50, 16: $70724.50, 17: $87664.50, 18: $120697.50, 19: $70724.50
        87664.5 + 120697.5 + 70724.5 + 87664.5 + 120697.5 + 70724.5, // totalVentas = $558173
        (87664.5 + 120697.5 + 70724.5 + 87664.5 + 120697.5 + 70724.5) * 0.05, // totalComisiones = $27908.65
      ]
    );
    const liq1Id = liq1.rows[0].id;
    console.log(`  Created PAGADA liquidacion: LIQ-2025-00001 (id=${liq1Id})`);

    // Items for liquidacion 1 (Dec sales)
    const decSales = [
      {
        saleId: 14,
        numero: "OV-2025-01004",
        cliente: "La Economía",
        fecha: "2025-12-31",
        total: 87664.5,
      },
      {
        saleId: 15,
        numero: "OV-2025-01005",
        cliente: "Dist. Norte",
        fecha: "2025-12-28",
        total: 120697.5,
      },
      {
        saleId: 16,
        numero: "OV-2025-01006",
        cliente: "Com. Sur",
        fecha: "2025-12-25",
        total: 70724.5,
      },
      {
        saleId: 17,
        numero: "OV-2025-01007",
        cliente: "May. Centro",
        fecha: "2025-12-22",
        total: 87664.5,
      },
      {
        saleId: 18,
        numero: "OV-2025-01008",
        cliente: "Min. Express",
        fecha: "2025-12-19",
        total: 120697.5,
      },
      {
        saleId: 19,
        numero: "OV-2025-01009",
        cliente: "La Economía",
        fecha: "2025-12-16",
        total: 70724.5,
      },
    ];

    for (const sale of decSales) {
      await c.query(
        `
        INSERT INTO seller_liquidacion_items (
          "liquidacionId", "saleId", "saleNumero", "clienteNombre",
          "fechaVenta", "totalVenta", "comisionMonto", incluido
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `,
        [
          liq1Id,
          sale.saleId,
          sale.numero,
          sale.cliente,
          sale.fecha,
          sale.total,
          sale.total * 0.05,
        ]
      );
    }
    console.log("  Added 6 items to PAGADA liquidacion");

    // Also add Dec NV sales
    const decNvSales = [
      {
        saleId: 25,
        numero: "NV-2025-02005",
        cliente: "May. Centro",
        fecha: "2026-01-02",
        total: 28405.0,
      },
      {
        saleId: 26,
        numero: "NV-2025-02006",
        cliente: "Min. Express",
        fecha: "2025-12-31",
        total: 35685.0,
      },
      {
        saleId: 27,
        numero: "NV-2025-02007",
        cliente: "La Economía",
        fecha: "2025-12-29",
        total: 50050.0,
      },
    ];

    for (const sale of decNvSales) {
      await c.query(
        `
        INSERT INTO seller_liquidacion_items (
          "liquidacionId", "saleId", "saleNumero", "clienteNombre",
          "fechaVenta", "totalVenta", "comisionMonto", incluido
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `,
        [
          liq1Id,
          sale.saleId,
          sale.numero,
          sale.cliente,
          sale.fecha,
          sale.total,
          sale.total * 0.05,
        ]
      );
    }
    console.log("  Added 3 more NV items to PAGADA liquidacion");

    // Update liq1 totals to include NV sales
    const liq1TotalVentas =
      558173 + 28405 + 35685 + 50050;
    const liq1TotalComisiones = liq1TotalVentas * 0.05;
    await c.query(
      `UPDATE seller_liquidaciones SET "totalVentas" = $1, "totalComisiones" = $2, "totalLiquidacion" = $2 WHERE id = $3`,
      [liq1TotalVentas, liq1TotalComisiones, liq1Id]
    );

    // --- LIQUIDACION 2: CONFIRMADA (Messi, enero 2026) ---
    const janTotalVentas =
      70724.5 + 87664.5 + 120697.5 + 70724.5 + 20540 + 28405 + 35685 + 50050 + 20540;
    const janTotalComisiones = janTotalVentas * 0.05;

    const liq2 = await c.query(
      `
      INSERT INTO seller_liquidaciones (
        numero, "sellerId", estado, "fechaDesde", "fechaHasta",
        "totalVentas", "comisionPorcentaje", "totalComisiones",
        ajustes, "totalLiquidacion", notas, "notasInternas",
        "confirmadoPor", "confirmadoAt",
        "companyId", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        'LIQ-2026-00001', 1, 'CONFIRMADA', '2026-01-01', '2026-01-31',
        $1, 5.00, $2,
        -2500, $3, 'Liquidación de enero 2026', 'Ajuste por devolución parcial OV-2025-01003',
        2, '2026-02-05T11:00:00.000Z',
        3, 2, '2026-02-01T09:00:00.000Z', '2026-02-05T11:00:00.000Z'
      ) RETURNING id
    `,
      [janTotalVentas, janTotalComisiones, janTotalComisiones - 2500]
    );
    const liq2Id = liq2.rows[0].id;
    console.log(
      `  Created CONFIRMADA liquidacion: LIQ-2026-00001 (id=${liq2Id})`
    );

    // Items for Jan liquidacion
    const janSales = [
      {
        saleId: 10,
        numero: "OV-2025-01000",
        cliente: "Dist. Norte",
        fecha: "2026-01-12",
        total: 70724.5,
      },
      {
        saleId: 11,
        numero: "OV-2025-01001",
        cliente: "Com. Sur",
        fecha: "2026-01-09",
        total: 87664.5,
      },
      {
        saleId: 12,
        numero: "OV-2025-01002",
        cliente: "May. Centro",
        fecha: "2026-01-06",
        total: 120697.5,
      },
      {
        saleId: 13,
        numero: "OV-2025-01003",
        cliente: "Min. Express",
        fecha: "2026-01-03",
        total: 70724.5,
      },
      {
        saleId: 20,
        numero: "NV-2025-02000",
        cliente: "May. Centro",
        fecha: "2026-01-12",
        total: 20540.0,
      },
      {
        saleId: 21,
        numero: "NV-2025-02001",
        cliente: "Min. Express",
        fecha: "2026-01-10",
        total: 28405.0,
      },
      {
        saleId: 22,
        numero: "NV-2025-02002",
        cliente: "La Economía",
        fecha: "2026-01-08",
        total: 35685.0,
      },
      {
        saleId: 23,
        numero: "NV-2025-02003",
        cliente: "Dist. Norte",
        fecha: "2026-01-06",
        total: 50050.0,
      },
      {
        saleId: 24,
        numero: "NV-2025-02004",
        cliente: "Com. Sur",
        fecha: "2026-01-04",
        total: 20540.0,
      },
    ];

    for (const sale of janSales) {
      await c.query(
        `
        INSERT INTO seller_liquidacion_items (
          "liquidacionId", "saleId", "saleNumero", "clienteNombre",
          "fechaVenta", "totalVenta", "comisionMonto", incluido
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `,
        [
          liq2Id,
          sale.saleId,
          sale.numero,
          sale.cliente,
          sale.fecha,
          sale.total,
          sale.total * 0.05,
        ]
      );
    }
    console.log("  Added 9 items to CONFIRMADA liquidacion");

    // --- LIQUIDACION 3: BORRADOR (Lucas Russo, febrero 2026) ---
    // Lucas has sales 38 ($1,625,000) and 35 ($195,415)
    const lucasTotalVentas = 1625000 + 195415;
    const lucasTotalComisiones = lucasTotalVentas * 0.045;

    const liq3 = await c.query(
      `
      INSERT INTO seller_liquidaciones (
        numero, "sellerId", estado, "fechaDesde", "fechaHasta",
        "totalVentas", "comisionPorcentaje", "totalComisiones",
        ajustes, "totalLiquidacion", notas,
        "companyId", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        'LIQ-2026-00002', 8, 'BORRADOR', '2026-02-01', '2026-02-21',
        $1, 4.50, $2,
        0, $2, 'Liquidación parcial de febrero 2026',
        3, 2, $3, $3
      ) RETURNING id
    `,
      [lucasTotalVentas, lucasTotalComisiones, now]
    );
    const liq3Id = liq3.rows[0].id;
    console.log(
      `  Created BORRADOR liquidacion: LIQ-2026-00002 (id=${liq3Id})`
    );

    // Items for Lucas liquidacion
    const lucasSales = [
      {
        saleId: 38,
        numero: "OV-2024-00001",
        cliente: "Cliente Excelente SA",
        fecha: "2026-02-07",
        total: 1625000,
      },
      {
        saleId: 35,
        numero: "PED-00000001",
        cliente: "Cliente Excelente SA",
        fecha: "2026-01-01",
        total: 195415,
      },
    ];

    for (const sale of lucasSales) {
      await c.query(
        `
        INSERT INTO seller_liquidacion_items (
          "liquidacionId", "saleId", "saleNumero", "clienteNombre",
          "fechaVenta", "totalVenta", "comisionMonto", incluido
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `,
        [
          liq3Id,
          sale.saleId,
          sale.numero,
          sale.cliente,
          sale.fecha,
          sale.total,
          sale.total * 0.045,
        ]
      );
    }
    console.log("  Added 2 items to BORRADOR liquidacion");

    // --- LIQUIDACION 4: ANULADA (Seba, test anulada) ---
    const liq4 = await c.query(
      `
      INSERT INTO seller_liquidaciones (
        numero, "sellerId", estado, "fechaDesde", "fechaHasta",
        "totalVentas", "comisionPorcentaje", "totalComisiones",
        ajustes, "totalLiquidacion", notas, "notasInternas",
        "companyId", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        'LIQ-2026-00003', 7, 'ANULADA', '2026-01-01', '2026-01-31',
        275000, 5.50, 15125,
        0, 15125, 'Liquidación anulada por error', 'Se anuló porque se incluyeron ventas incorrectas',
        3, 2, '2026-02-10T09:00:00.000Z', '2026-02-12T09:00:00.000Z'
      ) RETURNING id
    `
    );
    const liq4Id = liq4.rows[0].id;
    console.log(
      `  Created ANULADA liquidacion: LIQ-2026-00003 (id=${liq4Id})`
    );

    // Item for anulada
    await c.query(
      `
      INSERT INTO seller_liquidacion_items (
        "liquidacionId", "saleId", "saleNumero", "clienteNombre",
        "fechaVenta", "totalVenta", "comisionMonto", incluido
      ) VALUES ($1, 39, 'OV-2024-00002', 'Cliente Nuevo', '2026-02-07', 275000, 15125, true)
    `,
      [liq4Id]
    );
    console.log("  Added 1 item to ANULADA liquidacion");

    console.log("\n  SUMMARY:");
    console.log("  - LIQ-2025-00001: PAGADA (Messi, Dec 2025, 9 ventas)");
    console.log("  - LIQ-2026-00001: CONFIRMADA (Messi, Jan 2026, 9 ventas)");
    console.log(
      "  - LIQ-2026-00002: BORRADOR (Lucas Russo, Feb 2026, 2 ventas)"
    );
    console.log(
      "  - LIQ-2026-00003: ANULADA (Seba Carranza, Jan 2026, 1 venta)"
    );
  } else {
    console.log("  Liquidaciones already exist, skipping");
  }

  // ============================================================
  // 6. Verify
  // ============================================================
  console.log("\n=== 6. Verification ===");

  const qbCount = await c.query(
    `SELECT COUNT(*) FROM quote_item_cost_breakdowns`
  );
  console.log(`  Quote item breakdowns: ${qbCount.rows[0].count}`);

  const sbCount = await c.query(
    `SELECT COUNT(*) FROM sale_item_cost_breakdowns`
  );
  console.log(`  Sale item breakdowns: ${sbCount.rows[0].count}`);

  const liqCount = await c.query(`SELECT COUNT(*) FROM seller_liquidaciones`);
  console.log(`  Liquidaciones: ${liqCount.rows[0].count}`);

  const liqItemCount = await c.query(
    `SELECT COUNT(*) FROM seller_liquidacion_items`
  );
  console.log(`  Liquidacion items: ${liqItemCount.rows[0].count}`);

  const repCount = await c.query(`SELECT COUNT(*) FROM sales_reps`);
  console.log(`  Sales reps: ${repCount.rows[0].count}`);

  const liqList = await c.query(`
    SELECT numero, estado, "totalVentas", "totalComisiones", "totalLiquidacion"
    FROM seller_liquidaciones ORDER BY id
  `);
  console.log("\n  Liquidaciones detail:");
  liqList.rows.forEach((r) => console.log("  ", JSON.stringify(r)));

  await c.end();
  console.log("\nDone! All seed data created successfully.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
