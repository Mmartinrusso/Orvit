-- Seed: Mismo material de distintos proveedores
-- Esto crea un ejemplo de "Cemento Portland x 50kg" vendido por 2 proveedores distintos

DO $$
DECLARE
    v_company_id INT := 3;
    v_supply_id INT;
    v_supplier1_id INT;
    v_supplier2_id INT;
    v_warehouse_id INT;
    v_supplier_item1_id INT;
    v_supplier_item2_id INT;
BEGIN
    -- Obtener o crear el supply "Cemento Portland"
    SELECT id INTO v_supply_id FROM supplies
    WHERE company_id = v_company_id AND name = 'Cemento Portland x 50kg'
    LIMIT 1;

    IF v_supply_id IS NULL THEN
        INSERT INTO supplies (company_id, code, name, unit_measure, is_active, created_at, updated_at)
        VALUES (v_company_id, 'CEM-001', 'Cemento Portland x 50kg', 'UN', true, NOW(), NOW())
        RETURNING id INTO v_supply_id;
        RAISE NOTICE 'Supply creado con id: %', v_supply_id;
    ELSE
        UPDATE supplies SET code = 'CEM-001' WHERE id = v_supply_id AND code IS NULL;
        RAISE NOTICE 'Supply existente con id: %', v_supply_id;
    END IF;

    -- Obtener primeros 2 proveedores existentes (Holcim y Cantesur)
    SELECT id INTO v_supplier1_id FROM suppliers
    WHERE company_id = v_company_id
    ORDER BY id LIMIT 1;

    SELECT id INTO v_supplier2_id FROM suppliers
    WHERE company_id = v_company_id AND id != v_supplier1_id
    ORDER BY id LIMIT 1;

    RAISE NOTICE 'Proveedor 1: %, Proveedor 2: %', v_supplier1_id, v_supplier2_id;

    -- Obtener depósito
    SELECT id INTO v_warehouse_id FROM warehouses
    WHERE "companyId" = v_company_id AND "isActive" = true
    ORDER BY "isDefault" DESC NULLS LAST, id
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        INSERT INTO warehouses ("companyId", codigo, nombre, "isDefault", "isActive", "createdAt", "updatedAt")
        VALUES (v_company_id, 'DEP-01', 'Depósito Principal', true, true, NOW(), NOW())
        RETURNING id INTO v_warehouse_id;
    END IF;

    RAISE NOTICE 'Depósito: %', v_warehouse_id;

    -- Crear SupplierItem para proveedor 1
    SELECT id INTO v_supplier_item1_id FROM "SupplierItem"
    WHERE "supplierId" = v_supplier1_id AND "supplyId" = v_supply_id AND "companyId" = v_company_id
    LIMIT 1;

    IF v_supplier_item1_id IS NULL THEN
        INSERT INTO "SupplierItem" (
            "supplierId", "supplyId", nombre, descripcion, unidad,
            "codigoProveedor", "precioUnitario", activo, "companyId", "createdAt", "updatedAt"
        )
        VALUES (
            v_supplier1_id, v_supply_id, 'Cemento Portland x 50kg', 'Cemento tipo I', 'UN',
            'HOL-CEM-001', 8500.00, true, v_company_id, NOW(), NOW()
        )
        RETURNING id INTO v_supplier_item1_id;
    END IF;

    RAISE NOTICE 'SupplierItem 1: %', v_supplier_item1_id;

    -- Crear SupplierItem para proveedor 2
    SELECT id INTO v_supplier_item2_id FROM "SupplierItem"
    WHERE "supplierId" = v_supplier2_id AND "supplyId" = v_supply_id AND "companyId" = v_company_id
    LIMIT 1;

    IF v_supplier_item2_id IS NULL THEN
        INSERT INTO "SupplierItem" (
            "supplierId", "supplyId", nombre, descripcion, unidad,
            "codigoProveedor", "precioUnitario", activo, "companyId", "createdAt", "updatedAt"
        )
        VALUES (
            v_supplier2_id, v_supply_id, 'Cemento Portland x 50kg', 'Cemento Portland tipo I', 'UN',
            'CAN-CEM-999', 8200.00, true, v_company_id, NOW(), NOW()
        )
        RETURNING id INTO v_supplier_item2_id;
    END IF;

    RAISE NOTICE 'SupplierItem 2: %', v_supplier_item2_id;

    -- Crear StockLocation para proveedor 1
    INSERT INTO "StockLocation" (
        "warehouseId", "supplierItemId", cantidad, "cantidadReservada",
        "stockMinimo", "stockMaximo", "companyId"
    )
    VALUES (
        v_warehouse_id, v_supplier_item1_id, 50, 0, 10, 100, v_company_id
    )
    ON CONFLICT ("warehouseId", "supplierItemId")
    DO UPDATE SET cantidad = "StockLocation".cantidad + 50;

    -- Crear StockLocation para proveedor 2
    INSERT INTO "StockLocation" (
        "warehouseId", "supplierItemId", cantidad, "cantidadReservada",
        "stockMinimo", "stockMaximo", "companyId"
    )
    VALUES (
        v_warehouse_id, v_supplier_item2_id, 30, 0, 10, 100, v_company_id
    )
    ON CONFLICT ("warehouseId", "supplierItemId")
    DO UPDATE SET cantidad = "StockLocation".cantidad + 30;

    -- Crear movimientos de stock
    INSERT INTO "StockMovement" (
        tipo, cantidad, "cantidadAnterior", "cantidadPosterior",
        "costoUnitario", "costoTotal", "supplierItemId", "warehouseId",
        "sourceNumber", motivo, notas, "docType", "companyId", "createdBy", "createdAt"
    )
    VALUES
    (
        'ENTRADA_RECEPCION', 50, 0, 50, 8500.00, 425000.00,
        v_supplier_item1_id, v_warehouse_id,
        'SEED-001', 'Ingreso inicial de prueba', 'Material de Proveedor 1', 'T1',
        v_company_id, 1, NOW()
    ),
    (
        'ENTRADA_RECEPCION', 30, 0, 30, 8200.00, 246000.00,
        v_supplier_item2_id, v_warehouse_id,
        'SEED-002', 'Ingreso inicial de prueba', 'Material de Proveedor 2', 'T1',
        v_company_id, 1, NOW()
    );

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'SEED COMPLETADO!';
    RAISE NOTICE 'Supply: % (Cemento Portland x 50kg, Cod: CEM-001)', v_supply_id;
    RAISE NOTICE 'Proveedor 1: SupplierItem % - 50 UN a $8500', v_supplier_item1_id;
    RAISE NOTICE 'Proveedor 2: SupplierItem % - 30 UN a $8200', v_supplier_item2_id;
    RAISE NOTICE 'Ambos items apuntan al MISMO Supply pero de distintos proveedores';
    RAISE NOTICE '===========================================';

END $$;
